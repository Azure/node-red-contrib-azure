module.exports = function(RED) {
  function ReceiveMethodRequest(config) {
    RED.nodes.createNode(this, config);
    this.client = RED.nodes.getNode(config.client);
    this.methodName = config.methodName;
    var node = this;

    node.client.client.onDeviceMethod(node.methodName, function (req, resp) {
      node.trace('method request received: ' + JSON.stringify(req));
      node.send({
        response: resp,
        methodName: config.methodName,
        payload: req
      });
    });
  }

  RED.nodes.registerType("iot-device-method-request", ReceiveMethodRequest);
}