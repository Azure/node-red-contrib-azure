module.exports = function(RED) {
  function IoTDevice(config) {
    RED.nodes.createNode(this, config);
    this.client = RED.nodes.getNode(config.client);
    var node = this;

    node.client.client.on('message', function (msg) {
      node.trace('message received: ' + msg.data);
      node.send({ payload: msg });
    });
  }

  RED.nodes.registerType("iot-device-receive-commands", IoTDevice);
}