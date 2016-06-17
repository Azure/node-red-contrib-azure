module.exports = function (RED) {

    var Client = require('azure-storage');
    var globaltable = null;
    var clientTableService = null;
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
        clientTableService.insertEntity(table, entity, function(err, result, response) {
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
        clientTableService.retrieveEntity(table, pkey, rkey, function(err, result, response) {
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

    var deleteTable = function (table) {
        node.log("Deleting table");
        clientTableService.deleteTable(table, function (err) {
             if (err) {
                node.error('Error while trying to delete table:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                node.log('table deleted');
                setStatus(statusEnum.sent);
                node.send('table deleted');
            }   
        });
    }

    var uptadeEntity = function (table, pkey, rkey, data) {
        node.log('updating entity');
        var entity = {
            PartitionKey: entGen.String(pkey),
            RowKey: entGen.String(rkey),
            data: entGen.String(data),
        };
        clientTableService.insertOrReplaceEntity(table, entity, function(err, result, response){
            if (err) {
                node.error('Error while trying to update entity:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                node.log('entity updated');
                setStatus(statusEnum.sent);
                node.send('entity updated');
            } 
        });   
    }

    var deleteEntity = function (table, pkey, rkey, data) {
        node.log('deleting entity');
        var entity = {
            PartitionKey: entGen.String(pkey),
            RowKey: entGen.String(rkey),
            data: entGen.String(data),
        };
        clientTableService.deleteEntity(table, entity, function(err, result, response){
            if (err) {
                node.error('Error while trying to delete entity:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                node.log('entity deleted');
                setStatus(statusEnum.sent);
                node.send('entity deleted');
            } 
        });   
    }

    var queryEntity = function (table, fromcolumn, where, selectdata) {
        node.log('query entity');
        var query = new Client.TableQuery()
            .top(1)
            .where(fromcolumn + ' eq ?', where);
        clientTableService.queryEntities(table, query, null, function(err, result, response){
            if (err) {
                node.error('Error while trying to query entity:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                //node.log(JSON.stringify(result.entries.data));
                //setStatus(statusEnum.sent);
                //node.send(result.entries.data._);
            } 
        });   
    }

    var disconnectFrom = function () { 
         if (clientTableService) { 
             node.log('Disconnecting from Azure'); 
             clientTableService.removeAllListeners(); 
             clientTableService = null; 
             setStatus(statusEnum.disconnected); 
         } 
     } 


    function createTable(tableName) {
        node.log('Creating a table if not exists');
        var tableService = Client.createTableService(clientConnectionString);
        clientTableService = tableService;
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
            node.log('Received the input: ' + messageJSON.tableName);
            var action = messageJSON.action;
            // Sending data to Azure Table Storage
            setStatus(statusEnum.sending);
            switch (action) {
                case "I":
                    node.log('Trying to insert entity');
                    var tableselect = createTable(messageJSON.tableName);
                    senddata(messageJSON.tableName, messageJSON.partitionKey, messageJSON.rowKey, messageJSON.data);
                    break;
                case "R":
                    node.log('Trying to read entity');
                    var tableselect = createTable(messageJSON.tableName);
                    readdata(messageJSON.tableName, messageJSON.partitionKey, messageJSON.rowKey);
                    break;
                case "DT":
                    node.log('Trying to delete table');
                    var tableselect = createTable(messageJSON.tableName);
                    deleteTable(messageJSON.tableName);
                    break;
                case "Q":
                    //node.log('Trying to query data');
                    //var tableselect = createTable(messageJSON.tableName);
                    //queryEntity(messageJSON.tableName, messageJSON.fromColumn, messageJSON.where, messageJSON.selectData);
                    break;
                case "U":
                    node.log('trying to update entity');
                    var tableselect = createTable(messageJSON.tableName);
                    uptadeEntity(messageJSON.tableName, messageJSON.partitionKey, messageJSON.rowKey, messageJSON.data);
                    break;
                case "D":
                    node.log('trying to delete entity');
                    var tableselect = createTable(messageJSON.tableName);
                    deleteEntity(messageJSON.tableName, messageJSON.partitionKey, messageJSON.rowKey, messageJSON.data);
                    break;
                default:
                    node.log('action was not detected');
                    node.error('action was not detected');
                    setStatus(statusEnum.error);
                    break;
            }    
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