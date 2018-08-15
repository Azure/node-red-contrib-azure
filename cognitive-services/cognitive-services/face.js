var request = require('request');

module.exports = function(RED)
{
    function face(config)
    {
        RED.nodes.createNode(this,config);
        var node = this;
        this.on('input', function(msg)
        {
            node.status({fill: "blue", shape: "dot", text: "Requesting"});
            if (this.credentials == null || this.credentials.key == null || this.credentials.key == "")
            {
                node.error("Input subscription key", msg);
                node.status({fill: "red", shape: "ring", text: "Error"});
                console.log("Input subscription key");
            }
            else
            {
                var options = null;
                if (Buffer.isBuffer(msg.payload))
                {
                    options = {
                        url: 'https://westus.api.cognitive.microsoft.com/face/v1.0/detect',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/octet-stream'
                        },
                        "body": msg.payload
                    };
                }
                else if (typeof(msg.payload) == 'string' && (msg.payload.indexOf('http://') === 0 || msg.payload.indexOf('https://') === 0))
                {
                    options = {
                        url: 'https://westus.api.cognitive.microsoft.com/face/v1.0/detect',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json'
                        },
                        json: {
                            "url": msg.payload
                        }
                    };
                }

                if (options != null)
                {
                    //console.log("options=" + JSON.stringify(options));
                    request.post(options, function (error, response, body)
                    {
                        try
                        {
                            if (!error)
                            {
                                try { body = JSON.parse(body); } catch (e) {}
                                console.log("response.statusCode=" + response.statusCode + ", body=" + JSON.stringify(body));
                                if (response.statusCode == 200 && body != null)
                                {
                                    if (body.length > 0 && body[0].faceRectangle != null)
                                    {
                                        msg.payload = body[0].faceRectangle;
                                    }
                                    else
                                    {
                                        msg.payload = null;
                                    }
                                    msg.detail = body;
                                    node.send(msg);
                                    node.status({});
                                }
                                else
                                {
                                    node.error(body);
                                    node.status({fill: "red", shape: "ring", text: "Error"});
                                }
                            }
                            else
                            {
                                node.error(error);
                                node.status({fill: "red", shape: "ring", text: "Error"});
                            }
                        }
                        catch (e)
                        {
                            node.error(e, msg);
                            node.status({fill: "red", shape: "ring", text: "Error"});
                        }
                    });
                }
                else
                {
                    node.error("Unsupported format: This node supports Buffer data from file-in node and URL String data");
                    node.status({fill: "red", shape: "ring", text: "Error"});
                }
            }
        });
    }

    RED.nodes.registerType("Face", face,
    {
        credentials: {
            key: {
                type: "password"
            }
        }
    });                       
}