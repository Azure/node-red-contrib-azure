module.exports = function (RED) {

    var Client = require('azure-iot-device').Client;
    var Registry = require('azure-iothub').Registry;
    var Message = require('azure-iot-device').Message;

    var Protocols = {
        amqp: require('azure-iot-device-amqp').Amqp,
        mqtt: require('azure-iot-device-mqtt').Mqtt,
        http: require('azure-iot-device-http').Http,
        amqpWs: require('azure-iot-device-amqp-ws').AmqpWs
    };

    var EventHubClient = require('azure-event-hubs').Client;

    var client = null;
    var clientConnectionString = "";
    var newConnectionString = "";
    var newProtocol = "";
    var clientProtocol = "";

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

    var sendData = function (node, data) {
        node.log('Sending Message to Azure IoT Hub :\n   Payload: ' + JSON.stringify(data));
        // Create a message and send it to the IoT Hub every second
        var message = new Message(JSON.stringify(data));
        client.sendEvent(message, function (err, res) {
            if (err) {
                node.error('Error while trying to send message:' + err.toString());
                setStatus(node, statusEnum.error);
            } else {
                node.log('Message sent.');
                node.send({payload: "Message sent."});
                setStatus(node, statusEnum.sent);
            }
        });
    };

    var sendMessageToIoTHub = function (node, message, reconnect) {
        if (!client || reconnect) {
            node.log('Connection to IoT Hub not established or configuration changed. Reconnecting.');
            // Update the connection string
            clientConnectionString = newConnectionString;
            // update the protocol
            clientProtocol = newProtocol;

            // If client was previously connected, disconnect first
            if (client)
                disconnectFromIoTHub(node);

            // Connect the IoT Hub
            connectToIoTHub(node, message);
        } else {
            sendData(node, message);
        }
    };

    var connectToIoTHub = function (node, pendingMessage) {
        node.log('Connecting to Azure IoT Hub:\n   Protocol: ' + newProtocol + '\n   Connection string :' + newConnectionString);
        client = Client.fromConnectionString(newConnectionString, Protocols[newProtocol]);
        client.open(function (err) {
            if (err) {
                node.error('Could not connect: ' + err.message);
                setStatus(node, statusEnum.disconnected);
                // works for me..
                client = undefined;
            } else {
                node.log('Connected to Azure IoT Hub.');
                setStatus(node, statusEnum.connected);

                // Check if a message is pending and send it 
                if (pendingMessage) {
                    node.log('Message is pending. Sending it to Azure IoT Hub.');
                    // Send the pending message
                    sendData(node, pendingMessage);
                }

                client.on('message', function (msg) {
                    // We received a message
                    node.log('Message received from Azure IoT Hub\n   Id: ' + msg.messageId + '\n   Payload: ' + msg.data);
                    var outpuMessage = new Message();
                    outpuMessage.payload = msg.data;
                    setStatus(node, statusEnum.received);
                    node.log(JSON.stringify(outpuMessage));
                    node.send(outpuMessage);
                    client.complete(msg, printResultFor(node,'Completed'));
                });

                client.on('error', function (err) {
                    node.error(err.message);

                });

                client.on('disconnect', function () {
                    disconnectFromIoTHub(node);
                });
            }
        });
    };

    var disconnectFromIoTHub = function (node) {
        if (client) {
            node.log('Disconnecting from Azure IoT Hub');
            client.removeAllListeners();
            client.close(printResultFor(node, 'close'));
            client = null;
            setStatus(node, statusEnum.disconnected);
        }
    };

    function nodeConfigUpdated(cs, proto) {
        return ((clientConnectionString != cs) || (clientProtocol != proto));
    }

    // Main function called by Node-RED    
    function AzureIoTHubNode(config) {
        // Store node for further use
        var node = this;
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
                //Sample string: {"deviceId": "name", "key": "jsadhjahdue7230-=13", "protocol": "amqp", "data": "25"}
                messageJSON = JSON.parse(msg.payload);
            }

            //Creating connectionString
            //Sample
            //HostName=sample.azure-devices.net;DeviceId=sampleDevice;SharedAccessKey=wddU//P8fdfbSBDbIdghZAoSSS5gPhIZREhy3Zcv0JU=
            newConnectionString = "HostName=" + node.credentials.hostname + ";DeviceId=" + messageJSON.deviceId + ";SharedAccessKey=" + messageJSON.key
	    if( typeof messageJSON.protocol !== 'undefined'){
            	newProtocol = messageJSON.protocol;
	    } else {
		newProtocol = config.protocol;
	    }

            // Sending data to Azure IoT Hub Hub using specific connectionString
            sendMessageToIoTHub(node, messageJSON.data, nodeConfigUpdated(newConnectionString, newProtocol));
        });

        node.on('close', function () {
            disconnectFromIoTHub(node, this);
        });

    }

    function IoTHubRegistry(config) {
        RED.nodes.createNode(this, config);

        var node = this;

        node.on('input', function (msg) {
            if (typeof (msg.payload) == 'string') {
                msg.payload = JSON.parse(msg.payload);
            }

            var registry = Registry.fromConnectionString(node.credentials.connectionString);

            registry.create(msg.payload, function (err, device) {
                if (err) {
                    node.error('Error while trying to create a new device: ' + err.toString());
                    setStatus(node, statusEnum.error);
                } else {
                    node.log("Device created: " + JSON.stringify(device));
                    node.log("Device ID: " + device.deviceId + " - primaryKey: " + device.authentication.SymmetricKey.primaryKey + " - secondaryKey: " + device.authentication.SymmetricKey.secondaryKey);
                    node.send("Device ID: " + device.deviceId + " - primaryKey: " + device.authentication.SymmetricKey.primaryKey + " - secondaryKey: " + device.authentication.SymmetricKey.secondaryKey);
                }
            });
        });

        node.on('close', function () {
            disconnectFromIoTHub(node, this);
        });
    }

    var disconnectFromEventHub = function( node ){
        if( node.reconnectTimer ){
            clearTimeout( node.reconnectTimer );
            node.reconnectTimer = null;
        }
        if (node.client) {
            node.log('Disconnecting from Azure IoT Hub');
            node.client.close();
            node.client = null;
            setStatus(node, statusEnum.disconnected);
        }
    };

    var connectToEventHub = function( node, connectionString ){
        // Open connection
        node.client = EventHubClient.fromConnectionString(connectionString);

        node.client.open()
            .then(node.client.getPartitionIds.bind(node.client))
            .then((partitionIds)=>{
            return Promise.all( partitionIds.map( (partitionId)=> {
                return node.client.createReceiver('$Default', partitionId, { 'startAfterTime' : Date.now()}).then(function(receiver) {
                    node.log('Created Event Hub partition receiver: ' + partitionId);
                    // Allthough 'errorReceived' event is defined in azure-event-hubs function documentation, it does not appear to throw one when disconnected
                    receiver.on('errorReceived', function( err ){
                        node.log('Receiver error: ', err.message);
                        setStatus(node, statusEnum.error);
                    });
                    receiver.on('message', function( message ){
                        setStatus(node, statusEnum.received);
                        let msg = {
                            deviceId: message.annotations["iothub-connection-device-id"],
                            //topic: message.properties.subject||message.properties.to,
                            payload: message.body
                        };
                        node.send(msg);
                    });
                });
            }));
        }).then(()=>{
            node.log("Connected to each partition receiver - ready to receive data!");
            setStatus(node, statusEnum.connected);
            // Since EventHubClient does not provide any mechanism to catch disconnection nor override AMQP retry policy, the only available option is to listen to it's private _amqp member directly
            node.client._amqp.once('connection:closed', function(){
                node.log("AMQP disconnected");
                process.nextTick(()=>{
                    disconnectFromEventHub(node);
                    connectToEventHub( node, connectionString );
                });
            });
        }).catch(function(error){
            node.log("Event Hub connection threw an error: " + error.message);
            disconnectFromEventHub(node);
            node.reconnectTimer = setTimeout( function(){
                node.reconnectTimer = null;
                if( !node.client ) connectToEventHub( node, connectionString );
            }, 30000);
        });
    };

    function AzureIoTHubReceiverNode(config) {
        // Store node for further use
        var node = this;
        this.client = null;
        this.reconnectTimer = null;

        // Create the Node-RED node
        RED.nodes.createNode(this, config);

        setStatus(node, statusEnum.disconnected);

        connectToEventHub( this, node.credentials.connectionString );

        node.on('close', function() {
            disconnectFromEventHub(node);
        });
    }

    function AzureIoTHubDeviceTwin(config){
        RED.nodes.createNode(this, config);

        var node = this;

        node.on('input', function (msg) {
            var registry = Registry.fromConnectionString(node.credentials.connectionString);

            if( typeof msg.payload === "string" ) var query = registry.createQuery("SELECT * FROM devices WHERE deviceId ='" + msg.payload + "'");
            else var query = registry.createQuery("SELECT * FROM devices");

            query.nextAsTwin( function(err, results){
                if (err) {
                    node.error('Error while trying to retrieve device twins: ' + err.message);
                    msg.error = err;
                    delete msg.payload;
                    node.send(msg);
                } else {
                    msg.payload = results;
                    disconnectFromIoTHub(node, this);
                    node.send(msg);
                }
            });
        });

        node.on('close', function () {
            disconnectFromIoTHub(node, this);
        });
    }

    // Registration of the node into Node-RED
    RED.nodes.registerType("azureiothub", AzureIoTHubNode, {
        credentials: {
            hostname: { type: "text" }
        },
        defaults: {
            name: { value: "Azure IoT Hub" },
            protocol: { value: "amqp" }
        }
    });

    // Registration of the node into Node-RED
    RED.nodes.registerType("azureiothubregistry", IoTHubRegistry, {
        credentials: {
            connectionString: { type: "text" }
        },
        defaults: {
            name: { value: "Azure IoT Hub Registry" },
        }
    });

    RED.nodes.registerType("azureiothubreceiver", AzureIoTHubReceiverNode, {
        credentials: {
            connectionString: { type: "text" }
        },
        defaults: {
            name: { value: "Azure IoT Hub Receiver" }
        }
    });

    RED.nodes.registerType("azureiothubdevicetwin", AzureIoTHubDeviceTwin, {
        credentials: {
            connectionString: { type: "text" }
        },
        defaults: {
            name: { value: "Azure IoT Hub Device Twin" }
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
