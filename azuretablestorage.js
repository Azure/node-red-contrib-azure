module.exports = function (RED) {

    var Client = require('azure-storage');
    var globaltable = null;
    var client = null;
    var clientConnectionString = "";
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

    var senddata = function (table, pkey, rkey, data) {
        node.log('Saving data into Azure Table Storage :\n   data: ' + pkey + " - " + rkey + " - " + data + " - " + table);
        // Create a message and send it to the Azure Table Storage
        var entGen = Client.TableUtilities.entityGenerator;
        node.log('creating entity...');
        var entity = {
            PartitionKey: entGen.String(pkey),
            RowKey: entGen.String(rkey),
            data: entGen.String(data),
        };
        node.log('entity created successfully');
        client.insertEntity(table, entity, function(err, result, response) {
            node.log('trying to insert');
            if (err) {
                node.error('Error while trying to save data:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                node.log('data saved.');
                setStatus(statusEnum.sent);
                node.send('data saved.');
            }
        });
    };

    var readdata = function (table, pkey, rkey) {
        node.log('Reading data from Azure Table Storage :\n   data: ' + pkey + " - " + rkey);
        client.retrieveEntity(table, pkey, rkey, function(err, result, response) {
            if (err) {
                node.error('Error while trying to read data:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                node.log(result.data._);
                setStatus(statusEnum.sent);
                node.send(result.data._);
            }
        });
    };

    var disconnectFrom = function () { 
         if (client) { 
             node.log('Disconnecting from Azure'); 
             client.removeAllListeners(); 
             client = null; 
             setStatus(statusEnum.disconnected); 
         } 
     } 


    function createTable(tableName) {
        node.log('Creating a table if not exists');
        //var tableService = Client.createTableService('DefaultEndpointsProtocol=https;AccountName=holsml;AccountKey=/tR+1C8P30gpkl2n7EZXka+zWz4xDLl6+8iKFXGVTQvoLW1X9Y7H8YCl8ZbGkIWaXrmRtkqWe3VXK+PJS3t4+w==');
        var tableService = Client.createTableService(clientConnectionString);
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
        clientConnectionString = node.credentials.connectionstring;

        this.on('input', function (msg) {
            //Converting string to JSON Object
            //Sample string: {"tableName": "name", "action": "I" "partitionKey": "part1", "rowKey": "row1", "data": "data"}
            var messageJSON = JSON.parse(msg.payload);
            node.log('Received the input:' + messageJSON.tableName);
            var action = messageJSON.action;
            // Sending data to Azure Table Storage
            if (action === "I") {
                node.log('Trying to insert entity');
                var tableselect = createTable(messageJSON.tableName);
                senddata(messageJSON.tableName, messageJSON.partitionKey, messageJSON.rowKey, messageJSON.data);
            } else if (action === "R"){
                node.log('Trying to read entity');
                var tableselect = createTable(messageJSON.tableName);
                readdata(messageJSON.tableName, messageJSON.partitionKey, messageJSON.rowKey);
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