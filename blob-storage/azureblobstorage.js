/*jshint esversion: 6 */
module.exports = function (RED) {

    var Client = require('azure-storage');
    var fs = require('fs');
    var path = require('path');
    var clientBlobService = null;
    var clientAccountName = "";
    var clientAccountKey = "";
    var clientContainerName = "";
    var clientBlobName = "";
    var node = null;
    var nodeConfig = null;

    var statusEnum = {
        disconnected: { color: "red", text: "Disconnected" },
        sending: { color: "green", text: "Sending" },
        sent: { color: "blue", text: "Sent message" },
        error: { color: "grey", text: "Error" },
        receiving: { color: "yellow", text: "Receiving" },
        received: { color: "green", text: "Received message" }
    };

    var setStatus = function (status) {
        node.status({ fill: status.color, shape: "dot", text: status.text });
    };

    var updateBlob = function (container, blob, file) {
        node.log('Updating Blob');
        // 
    };

    var deleteBlob = function (container, blob) {
        node.log('deleting blob');
        clientBlobService.deleteBlob(container, blob, function(err, result, response){
            if (err) {
                node.error('Error while trying to delete blob:' + err.toString());
                setStatus(statusEnum.error);
            } else {
                node.log('Blob deleted');
                setStatus(statusEnum.sent);
                node.send('Blob deleted');
            } 
        });   
    };

    var disconnectFrom = function () { 
         if (clientBlobService) { 
             node.log('Disconnecting from Azure'); 
             clientBlobService.removeAllListeners(); 
             clientBlobService = null; 
             setStatus(statusEnum.disconnected); 
         } 
     };


    // Main function called by Node-RED    
    function AzureBlobStorage(config) {
        // Store node for further use
        node = this;
        nodeConfig = config;

        // Create the Node-RED node
        RED.nodes.createNode(this, config);
        clientAccountName = this.credentials.accountname;
        clientAccountKey = this.credentials.key;
        clientContainerName = this.credentials.container;
        
        var blobService = Client.createBlobService(clientAccountName, clientAccountKey);

        this.on('input', function (msg) {
            node.log("Uploading blob...");
            var messageJSON = null;
            if(!this.credentials.blob)
            {
                clientBlobName = msg.blobname;
            }
            else
            {
                clientBlobName = this.credentials.blob;
            }
            clientAccountName = this.credentials.accountname;
            clientAccountKey = this.credentials.key;
            clientContainerName = this.credentials.container;
            // if (!this.credentials.blob) {
            //     var nameObject = path.parse(msg.payload);
            //     clientBlobName = nameObject.base;
            // }
            
            // Sending data to Azure Blob Storage
            setStatus(statusEnum.sending);
            createContainer(clientContainerName, blobService, function() {

                uploadBlob(msg.payload, blobService, clientContainerName, clientBlobName, function () {

                    node.log("Upload completed!");

                });
            }); 
        });

        this.on('close', function () {
            disconnectFrom(this);
        });
    }

    function createContainer (containerName, blobservice, callback) {
        // Create the container
        blobservice.createContainerIfNotExists(containerName, function(error) {
            if (error) {
                node.log(error);
            }
            else {
                node.log("Container '"+ containerName +"' ready for blob creation");
                callback();
            }
        });
    }

    function uploadBlob(file, blobService, containerName, blobName, callback) {
        blobService.createBlockBlobFromLocalFile(containerName, blobName, file, function (error) {
            if (error) {
                node.log(error);
            }
            else {
                node.log("Blob '" + blobName + "' uploaded");
                node.send("Blob '" + blobName + "' uploaded in container '" + containerName +"'");
                callback();
            }
        });
    }

    function AzureBlobStorageDownload(config) {
        // Store node for further use
        node = this;
        nodeConfig = config;

        // Create the Node-RED node
        RED.nodes.createNode(this, config);
        clientAccountName = node.credentials.accountname;
        clientAccountKey = node.credentials.key;
        clientContainerName = node.credentials.container;
        clientBlobName = node.credentials.blob;
        var blobservice = Client.createBlobService(clientAccountName, clientAccountKey);
        var destinationFile;

        this.on('input', function (msg) {
            node.log('Downloading blob...');
            // Sending order to Azure Blob Storage
            //createContainer(clientContainerName);
            setStatus(statusEnum.receiving);

            node.log("msg.payload" + msg.payload);
            if (msg.payload) {
                destinationFile = msg.payload;
            }
            else {
                const fileName = clientBlobName.replace('.txt', '.downloaded.txt');
                destinationFile = path.join(__dirname, fileName);
            }
            
            node.log("destinationFile" + destinationFile);
            downloadBlob(blobservice, clientContainerName, clientBlobName, destinationFile, function() {
                node.log("Download completed!");
            });   
            setStatus(statusEnum.received);
        });

        this.on('close', function () {
            disconnectFrom(this);
        });
    }

    function downloadBlob(blobservice, containerName, blobName, fileName, callback) {
        blobservice.getBlobToLocalFile(containerName, blobName, fileName, function (error2) {
            if (error2) {
                node.log(error2);
            }
            else {
                node.log("Blob '"+ blobName + "' is downloaded successfully!");
                node.send("Blob '" + blobName + "' is downloaded successfully at '" + path.dirname(fileName) +"'");
                callback();
            }
        });
    }

    // Registration of the node into Node-RED
    RED.nodes.registerType("Save Blob", AzureBlobStorage, {
        credentials: {
            accountname: { type: "text" },
            key: { type: "text" },
            container: { type: "text" },
            blob: { type: "text" },
        },
        defaults: {
            name: { value: "Save in Blob Storage" },
        }
    });

    // Registration of the node into Node-RED to download
    RED.nodes.registerType("Get Blob", AzureBlobStorageDownload, {
        credentials: {
            accountname: { type: "text" },
            key: { type: "text" },
            container: { type: "text" },
            blob: { type: "text" },
        },
        defaults: {
            name: { value: "Get Blob Storage" },
        }
    });


    // Helper function to print results in the console
    function printResultFor(op) {
        return function printResult(err, res) {
            if (err) node.error(op + ' error: ' + err.toString());
            if (res) node.log(op + ' status: ' + res.constructor.name);
        };
    }
};
