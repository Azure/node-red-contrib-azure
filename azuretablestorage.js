module.exports = function (RED) {

    var Client = require('azure-storage');
    var globaltable = null;
    var client = null;
    var clientConnectionString = "";
    var accountName = "";
    var AccessKey = "";
    var node = null;
    var nodeConfig = null;

    var statusEnum = {
        disconnected: { color: "red", text: "Disconnected" },
        sending: { color: "green", text: "Sending" },
        sent: { color: "blue", text: "Sent message" },
        error: { color: "grey", text: "Error" }
    };

    var setStatus = function (status) {
        node.status({ fill: status.color, shape: "dot", text: status.text });
    }

    var sendData = function (table, pkey, rkey, description) {
        node.log('Saving data into Azure Table Storage :\n   data: ' + pkey + " - " + rkey);
        // Create a message and send it to the Azure Table Storage
        var entGen = azure.TableUtilities.entityGenerator;
        var now = new Date();
        var entity = {
            PartitionKey: pkey,
            RowKey: rkey,
            description: description,
            dueDate: entGen.DateTime(new Date(Date.UTC(now.getUTCFullYear, now.getUTCMonth, now.getUTCDay))),
        };
        client.insertEntity(table, entity, function(err, result, response) {
            if (err) {
                node.error('Error while trying to save data:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                node.log('data saved.');
                setStatus(statusEnum.sent);
                node.send("data saved");
            }
        });
    };

    var readData = function (table, pkey, rkey) {
        node.log('Reading data from Azure Table Storage :\n   data: ' + pkey + " - " + rkey);
        client.retrieveEntity(table, pkey, rkey, function(error, result, response) {
            if (!error) {
                return result;
            }
});
    };

    var disconnectFrom = function () { 
         if (client) { 
             node.log('Disconnecting from Azure IoT Hub'); 
             client.removeAllListeners(); 
             client.close(printResultFor('close')); 
             client = null; 
             setStatus(statusEnum.disconnected); 
         } 
     } 


    function createTable(tableName) {
        var tableService = Client.createTableService();
        client = tableService;
        tableService.createTableIfNotExists(tableName, function(error, result, response) {
        if (!error) {
                // result contains true if created; false if already exists
                globaltable = tableName;
                return tableName;
         }
         else {
             node.error(error);
         }
        });
    }

    // Main function called by Node-RED    
    function AzureTableStorage(config) {
        // Store node for further use
        node = this;
        nodeConfig = config;

        // Create the Node-RED node
        RED.nodes.createNode(this, config);
        this.on('input', function (msg) {

            //Converting string to JSON Object
            //Sample string: {"tableName": "name", "action": "I" "partitionKey": "part1", "rowKey": "row1", "description": "data"}
            var messageJSON = JSON.parse(msg.payload);
            
            // Sending data to Azure Table Storage
            if (action === "I") {
                node.log('Trying to insert entity');
                var tableselect = createTable(messageJSON.tableName);
                sendData(tableselect, messageJSON.partitionKey, messageJSON.rowKey, messageJSON.description);
            } else if (action === "R"){
                node.log('Trying to read entity');
                var tableselect = createTable(messageJSON.tableName);
                var result = readData(tableselect, messageJSON.partitionKey, messageJSON.rowKey);
                node.send(result);
            } else if (action === "Q"){
                node.log('Trying to query data');
            }


            setStatus(statusEnum.sending);
        });

        this.on('close', function () {
            disconnectFrom(this);
        });
    }

    // Registration of the node into Node-RED
    RED.nodes.registerType("azuretablestorage", AzureTableStorage, {
        credentials: {
            connectionstring: { type: "text" },
            accountname: { type: "text"},
            accesskey: { type: "text" }    
        },
        defaults: {
            name: { value: "Azure Table Storage" },
        }
    });


    // Helper function to print results in the console
    function printResultFor(op) {
        return function printResult(err, res) {
            if (err) node.error(op + ' error: ' + err.toString());
            if (res) node.log(op + ' status: ' + res.constructor.name);
        };
    }
}