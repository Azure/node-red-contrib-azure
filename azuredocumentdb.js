module.exports = function (RED) {

    var DocumentDBClient = require('documentdb').DocumentClient
    var client = null;
    var dbendpoint = "";
    var dbkey = "";
    var dbName = "";
    var databaseUrl = "";
    var collectionName = "";
    var collectionUrl = "";
    var messageJSON = "";
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

    function listDatabases(callback) {
        var queryIterator = client.readDatabases().toArray(function (err, dbs) {
            if (err) {
                setStatus(statusEnum.error);
                node.error('Completed with error ' +JSON.stringify(err));
                node.log('Completed with error ' +JSON.stringify(err));
            }
            callback(dbs);
        });
    }


//---------------------------------------------------------- COLLECTIONS--------------------------------------------------------------------
function getCollection() {
    console.log(`Getting collection:\n${collectionName}\n`);
    var colldef = {id : collectionName};
    return new Promise((resolve, reject) => {
        client.readCollection(collectionUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createCollection(databaseUrl, colldef, { offerThroughput: 400 }, (err, created) => {
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

function listCollections(databaseUrl, callback) {
    var queryIterator = client.readCollections(databaseUrl).toArray(function (err, cols) {
        if (err) {
            setStatus(statusEnum.error);
            node.error('Completed with error ' +JSON.stringify(err));
            node.log('Completed with error ' +JSON.stringify(err));
        } else {            
            node.log(cols.length + ' Collections found');
            callback(cols);
        }
    });
}

function deleteCollection(collectionId, callback) {
    var collLink = databaseUrl + '/colls/' + collectionId;
    client.deleteCollection(collLink, function (err) {
        if (err) {
            setStatus(statusEnum.error);
            node.error('Completed with error ' +JSON.stringify(err));
            node.log('Completed with error ' +JSON.stringify(err));
        } else {
            callback();
        }
    });
}

function readCollectionById(collectionId, callback) {
    var collLink = databaseUrl + '/colls/' + collectionId;
    client.readCollection(collLink, function (err, coll) {
        if (err) {
            setStatus(statusEnum.error);
            node.error('Completed with error ' +JSON.stringify(err));
            node.log('Completed with error ' +JSON.stringify(err));;
        } else {
            callback(coll);
        }
    });
}

//---------------------------------------------------------- GENERAL--------------------------------------------------------------------
    var disconnectFrom = function () { 
         if (client) { 
             node.log('Disconnecting from Azure DocumentDB'); 
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
            var messageJSON = null;
            if (typeof (msg.payload) != "string") {
                node.log("JSON");
                messageJSON = msg.payload;
            } else {
                node.log("String");
                //Converting string to JSON Object
                //Sample string: {"dbname": "name", "action": "C"}
                messageJSON = JSON.parse(msg.payload);
            }
            var action = messageJSON.action;
            if  (action != "L")
            {
                dbName = messageJSON.dbname;
                databaseUrl = `dbs/${dbName}`;
            }
            // Sending action to Azure DocumentDB
            setStatus(statusEnum.sending);
            switch (action) {
                case "C":
                    node.log('Trying to create database');
                    getDatabase().then((resolve) => { 
                        node.log('Completed successfully: -> ' + JSON.stringify(resolve));
                        setStatus(statusEnum.sent);
                        node.send(messageJSON.dbname); 
                    }).catch((error) => { 
                        setStatus(statusEnum.error);
                        node.error('Completed with error ' +JSON.stringify(error));
                        node.log('Completed with error ' +JSON.stringify(error));
                    });
                    break;
                case "L":
                    node.log('Trying to list databases');
                    var listNames = [];
                    listDatabases(function (dbs) {
                        setStatus(statusEnum.sent);
                        if (dbs.length == 1) {
                            node.send(dbs[0].id)
                        } else {
                            for (var i = 0; i < dbs.length; i++) {
                                listNames.push(dbs[i].id);
                            }
                            node.send(JSON.stringify(listNames));
                        }
                    });
                    break;
                case "D":
                    node.log('Trying to delete database');
                    deleteDatabase().then((resolve) => { 
                        setStatus(statusEnum.sent);
                        node.log('Delete successfully: -> ' + JSON.stringify(resolve));
                     }).catch((error) => { 
                        setStatus(statusEnum.error);
                        node.error('Completed with error ' +JSON.stringify(error));
                        node.log('Completed with error ' +JSON.stringify(error));
                    });
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

            var messageJSON = null;

            if (typeof (msg.payload) != "string") {
                node.log("JSON");
                messageJSON = msg.payload;
            } else {
                node.log("String");
                //Converting string to JSON Object
                //Sample string: {"dbname": "name", "collName": "colletionName", "action": "C"}
                messageJSON = JSON.parse(msg.payload);
            }
            var action = messageJSON.action;
            if  (action != "L")
            {
                dbName = messageJSON.dbname;
                collectionName = messageJSON.collName;
                databaseUrl = `dbs/${dbName}`;
                collectionUrl = `${databaseUrl}/colls/${collectionName}`;
            }
            // Sending action to Azure DocumentDB
            setStatus(statusEnum.sending);
            switch (action) {
                case "C":
                    node.log('Trying to create Collection');
                    getDatabase().then(() => getCollection()).then((resolve) => { 
                        node.log('Completed successfully ' + JSON.stringify(resolve));
                        setStatus(statusEnum.sent);
                        node.send(collectionName); 
                    }).catch((error) => { 
                        setStatus(statusEnum.error);
                        node.error('Completed with error ' +JSON.stringify(error));
                        node.log('Completed with error ' +JSON.stringify(error));
                    });
                    break;
                case "L":
                    node.log('Trying to list Collections');
                    var listNames = [];
                    listCollections(databaseUrl, function (cols) {
                        setStatus(statusEnum.sent);
                        if (cols.length == 1) {
                            node.send(cols[0].id)
                        } else {
                            for (var i = 0; i < cols.length; i++) {
                                listNames.push(cols[i].id);
                            }
                            node.send(JSON.stringify(listNames));
                        }
                    });
                    break;
                case "D":
                    node.log('Trying to delete Collection');
                    deleteCollection(collectionName, function () {
                        setStatus(statusEnum.sent);
                        node.log('Collection \'' + collectionId + '\'deleted');
                        node.send('Collection \'' + collectionId + '\'deleted');
                    });
                    break;
                case "R":
                    node.log('Trying to read Collection');
                    readCollectionById(collectionName, function (result) {
                        if (result) {
                            setStatus(statusEnum.sent);
                            node.log('Collection with id of \'' + collectionName + '\' was found its _self is \'' + result._self + '\'');
                            node.send(result._self);
                        }
                    });
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

    function DocumentDDocuments(config) {
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

            var messageJSON = null;

            if (typeof (msg.payload) != "string") {
                node.log("JSON");
                messageJSON = msg.payload;
            } else {
                node.log("String");
                //Converting string to JSON Object
                //Sample string: {"dbname": "name", "collName": "colletionName", "action": "C", "doc" : "doc address? doc as JSON? doc at Local?"}
                messageJSON = JSON.parse(msg.payload);
            }
            var action = messageJSON.action;
            if  (action != "L")
            {
                dbName = messageJSON.dbname;
                collectionName = messageJSON.collName;
                databaseUrl = `dbs/${dbName}`;
                collectionUrl = `${databaseUrl}/colls/${collectionName}`;
            }
            // Sending action to Azure DocumentDB
            setStatus(statusEnum.sending);
            switch (action) {
                case "C":
                    node.log('Trying to create Document');
                    break;
                case "L":
                    node.log('Trying to list Documents');
                    break;
                case "D":
                    node.log('Trying to delete Documents');
                    break;
                case "R":
                    node.log('Trying to read document');
                    break;
                case "Q":
                    node.log('Trying to query document');
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

    // Registration of the node into Node-RED to manage Databases
    RED.nodes.registerType("Database", DocumentDBDatabase, {
        credentials: {
            endpoint: { type: "text" },
            authkey: { type: "text" },
        },
        defaults: {
            name: { value: "Azure DocumentDB - Database" },
        }
    });

    // Registration of the node into Node-RED to manage Collections
    RED.nodes.registerType("Collections", DocumentDBCollections, {
        credentials: {
            endpoint: { type: "text" },
            authkey: { type: "text" },
        },
        defaults: {
            name: { value: "Azure DocumentDB - Collections" },
        }
    });

    // Registration of the node into Node-RED to manage Documents
    RED.nodes.registerType("Documents", DocumentDBDocuments, {
        credentials: {
            endpoint: { type: "text" },
            authkey: { type: "text" },
        },
        defaults: {
            name: { value: "Azure DocumentDB - Documents" },
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