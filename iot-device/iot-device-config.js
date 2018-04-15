module.exports = function(RED) {
  function IoTDeviceConfig(config) {
    RED.nodes.createNode(this, config);

    this.connectionString = process.env.DEVICE_CONNECTION_STRING;

    var node = this;

    var DeviceClient = require('azure-iot-device').Client;

    var Protocols = {
      Amqp : require('azure-iot-device-amqp').Amqp,
      AmqpWs : require('azure-iot-device-amqp').AmqpWs,
      Mqtt : require('azure-iot-device-mqtt').Mqtt,
      MqttWs : require('azure-iot-device-mqtt').MqttWs,
      Http : require('azure-iot-device-http').Http
    };

    var connectionStatus = {
      disconnecting: { color: "orange", text: "disconnecting" },
      disconnected: { color: "red", text: "disconnected" },
      connecting: { color: "yellow", text: "connecting" },
      connected: { color: "green", text: "connected" },
      error: { color: "grey", text: "error" }
    }

    this.client = DeviceClient.fromConnectionString(this.connectionString, Protocols[config.protocol]);


    this.client.on('error', function (err) {
      node.error(err.message);
      node.disconnect();
    });

    this.client.on('disconnect', function () {
      node.error('disconnected');
    });

    this.on('close', function (done) {
      node.client.close(function (err) {
        if (err) {
          node.error('error closing device client: ' + err.toString());
        } else {
          node.trace('device client closed');
        }
        done();
      });
    });
  }

  RED.nodes.registerType("iot-device-config", IoTDeviceConfig);
}