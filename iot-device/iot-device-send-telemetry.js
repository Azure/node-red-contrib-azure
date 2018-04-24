var Message = require('azure-iot-common').Message;

module.exports = function(RED) {
  function IoTDevice(config) {
    RED.nodes.createNode(this, config);
    this.client = RED.nodes.getNode(config.client);
    var node = this;

    this.on('input', function (msg) {
      var message = new Message(JSON.stringify(msg.payload));
      node.client.client.sendEvent(message, function (err) {
        if (err) {
          node.error('error sending message: ' + err.toString());
        } else {
          node.trace('message sent');
        }
      });
    });
  }

  RED.nodes.registerType("iot-device-send-telemetry", IoTDevice);
}