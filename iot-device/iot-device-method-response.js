module.exports = function(RED) {
  function SendMethodResponse(config) {
    RED.nodes.createNode(this, config);
    this.client = RED.nodes.getNode(config.client);
    var node = this;

    node.on('input', function (msg) {
      node.trace('sending method response: ' + JSON.stringify(msg.payload));
      msg.response.send(msg.statusCode, msg.payload, function(err) {
        if (err) {
          node.error('error sending method response: ' + err.toString());
        } else {
          node.trace('method response sent');
        }
      });
    });
  }

  RED.nodes.registerType("iot-device-method-response", SendMethodResponse);
}