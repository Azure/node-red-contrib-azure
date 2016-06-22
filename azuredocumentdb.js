module.exports = function (RED) {

    var DocumentDBClient = require('documentdb').DocumentClient
    var client = null;
    var dbendpoint = "";
    var dbkey = "";
    var dbName = "";
    var databaseUrl = "";
    var collectionUrl = "";
    var node = null;
    var nodeConfig = null;
    var HttpStatusCodes = { NOTFOUND: 404 };

    var statusEnum = {
        disconnected: { color: "red", text: "Disconnected" },
        sending: { color: "green", text: "Sending" },
        sent: { color: "blue", text: "Sent message" },
        error: { color: "grey", text: "Error" }
    };

    var setStatus = function (status) {
        node.status({ fill: status.color, shape: "dot", text: status.text });
    }


//---------------------------------------------------------- DATABASE--------------------------------------------------------------------
    function getDatabase(callback) {
    node.log(`Getting database:\n${dbName}\n`);
    var dbdef = {id : dbName};
        return new Promise((resolve, reject) => {
            client.readDatabase(databaseUrl, (err, result) => {
                if (err) {
                    if (err.code == HttpStatusCodes.NOTFOUND) {
                        client.createDatabase(dbdef, (err, created) => {
                            if (err) reject(err)
                            else resolve(created);
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(result);
                }
            });
        });
    }

    function deleteDatabase(callback) {
    node.log(`Getting database:\n${dbName}\n`);
        return new Promise((resolve, reject) => {
            client.readDatabase(databaseUrl, (err, result) => {
                if (err) {
                    if (err.code == HttpStatusCodes.NOTFOUND) {
                        client.deleteDatabase(databaseUrl, (err) => {
                            if (err) reject(err)
                            else resolve(null);
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(result);
                }
            });
        });
    }

    function findDatabaseById(databaseId, callback) {
    var querySpec = {
        query: 'SELECT * FROM root r WHERE  r.id = @id',
        parameters: [
            {
                name: '@id',
                value: databaseId
            }
        ]
    };
    client.queryDatabases(querySpec).toArray(function (err, results) {
        if (err) {
            handleError(err);
        }
        
        if (results.length === 0) {
            // no error occured, but there were no results returned 
            // indicating no database exists matching the query            
            // so, explictly return null
            callback(null, null);
        } else {
            // we found a database, so return it
            callback(null, results[0]);
        }
    });
};



//---------------------------------------------------------- COLLECTIONS--------------------------------------------------------------------
function getCollection() {
    console.log(`Getting collection:\n${config.collection.id}\n`);

    return new Promise((resolve, reject) => {
        client.readCollection(collectionUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createCollection(databaseUrl, config.collection, { offerThroughput: 400 }, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve(result);
            }
        });
    });
}



//---------------------------------------------------------- GENERAL--------------------------------------------------------------------
    var disconnectFrom = function () { 
         if (client) { 
             node.log('Disconnecting from Azure DocumentDB'); 
             client.removeAllListeners(); 
             client = null; 
             setStatus(statusEnum.disconnected); 
         } 
     } 

    // Main function called by Node-RED    
    function DocumentDBDatabase(config) {
        // Store node for further use
        node = this;
        nodeConfig = config;

        // Create the Node-RED node
        RED.nodes.createNode(this, config);
        dbendpoint = node.credentials.endpoint;
        dbkey = node.credentials.authkey;

        this.on('input', function (msg) {
            client = new DocumentDBClient(dbendpoint, { "masterKey": dbkey });
            dbName = msg.payload;
            databaseUrl = `dbs/${dbName}`;
            node.log("Creating Database if not exists");
            // working with database 

            //creating
            //getDatabase().then((resolve) => { node.log('Completed successfully: -> ' + JSON.stringify(resolve)); });

            //deleting
            //deleteDatabase().then((resolve) => { node.log('Completed successfully: -> ' + JSON.stringify(resolve)); });

        });

        this.on('close', function () {
            disconnectFrom(this);
        });
    }

    function DocumentDBCollections(config) {
        // Store node for further use
        node = this;
        nodeConfig = config;

        // Create the Node-RED node
        RED.nodes.createNode(this, config);
        dbendpoint = node.credentials.endpoint;
        dbkey = node.credentials.authkey;

        this.on('input', function (msg) {
            //working with collections
            client = new DocumentDBClient(dbendpoint, { "masterKey": dbkey });
            dbName = msg.payload;
            databaseUrl = `dbs/${dbName}`;
            var collectionUrl = `${databaseUrl}/colls/${config.collection.id}`;
        });

        this.on('close', function () {
            disconnectFrom(this);
        });
    }

    // Registration of the node into Node-RED
    RED.nodes.registerType("Database", DocumentDBDatabase, {
        credentials: {
            endpoint: { type: "text" },
            authkey: { type: "text" },
        },
        defaults: {
            name: { value: "Azure DocumentDB - Database" },
        }
    });

    // Registration of the node into Node-RED to download
    RED.nodes.registerType("Collections", DocumentDBCollections, {
        credentials: {
            endpoint: { type: "text" },
            authkey: { type: "text" },
        },
        defaults: {
            name: { value: "Azure DocumentDB - Collections" },
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