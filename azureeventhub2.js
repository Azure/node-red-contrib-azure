module.exports = function (RED) {

    var EventHubClient = require('azure-event-hubs').Client;
    var Promise = require('bluebird');
    var receiveAfterTime = Date.now() - 5000;
    var client = null;
    var clientConnectionString = null;
    var clientPath = "";
    var backupnode = null;

    var statusEnum = {
        disconnected: { color: "red", text: "Disconnected" },
        connected: { color: "green", text: "Connected" },
        sent: { color: "blue", text: "Sent message" },
        received: { color: "yellow", text: "Received" },
        error: { color: "grey", text: "Error" }
    };

    var setStatus = function (node, status) {
        node.status({ fill: status.color, shape: "dot", text: status.text });
    }

    var sendEvent = function (eventBody) {
        return function (sender) {
            backupnode.log('Sending Event: ' + eventBody);
            return sender.send(eventBody);
         };
    };

    var sendMessageToEventHub = function (node, cs, path, message, reconnect) {
        if (!client || reconnect) {
            node.log('Connection to Event Hub not established or configuration changed. Reconnecting.');
            // Update the connection string
            clientConnectionString = cs;
            // update the protocol
            clientPath = path;

            // If client was previously connected, disconnect first
            if (client)
                disconnectFromEventHub(node);

            // Connect the Event Hub
            connectToEventHub(node, message, cs, path);
        } else {
            sendEvent(node, message);
        }
    };

    var printError = function (err) {
         backupnode.log(err.message);
    };

    var OutputEvent = function (ehEvent) {
        backupnode.log('Event Received: ');
        backupnode.send(ehEvent.body);
    };

    var disconnectFromEventHub = function (node) {
        if (client) {
            node.log('Disconnecting from Azure Event Hub');
            //client.removeAllListeners();
            client.close(printResultFor('close'));
            client = null;
            setStatus(node, statusEnum.disconnected);
        }
    };

    var connectToEventHub = function (node, pendingMessage, cs, path) {
        node.log('Connecting to Azure Event Hub:\n   Connection string :' + cs);
        client = EventHubClient.fromConnectionString(cs, path)

        client.open()
            .then(client.getPartitionIds.bind(client))
            .then(function (partitionIds) {
                return Promise.map(partitionIds, function (partitionId) {
                return client.createReceiver('$Default', partitionId, { 'startAfterTime' : receiveAfterTime}).then(function(receiver) {
                    receiver.on('errorReceived', printError);
                    receiver.on('message', OutputEvent);
                });
                });
            })
            .then(function() {
                return client.createSender();
            })
            .then(sendEvent(pendingMessage))
            .catch(printError);

            setStatus(node, statusEnum.connected);
    };

    // Main function called by Node-RED    
    function AzureEventHubNode(config) {
        // Store node for further use
        var node = this;
        backupnode = node;
        //nodeConfig = config;

        // Create the Node-RED node
        RED.nodes.createNode(this, config);
        node.on('input', function (msg) {

            var messageJSON = null;

            if (typeof (msg.payload) != "string") {
                node.log("JSON");
                messageJSON = msg.payload;
            } else {
                node.log("String");
                //Converting string to JSON Object
                //Sample string: {connectionString: "cs", eventPath: "/message", "deviceId": "name", "key": "jsadhjahdue7230-=13", "protocol": "amqp", "data": "25"}
                messageJSON = JSON.parse(msg.payload);
            }

            // Sending data to Azure Event Hub Hub
            sendMessageToEventHub(node, messageJSON.connectionString, messageJSON.eventPath, messageJSON.data);
        });

        node.on('close', function () {
            disconnectFromEventHub(node, this);
        });

    }

    // Registration of the node into Node-RED
    RED.nodes.registerType("azureeventhub", AzureEventHubNode, {
        defaults: {
            name: { value: "Azure Event Hub" }
        }
    });

    // Helper function to print results in the console
    function printResultFor(node, op) {
        return function printResult(err, res) {
            if (err) node.error(op + ' error: ' + err.toString());
            if (res) node.log(op + ' status: ' + res.constructor.name);
        };
    }
}