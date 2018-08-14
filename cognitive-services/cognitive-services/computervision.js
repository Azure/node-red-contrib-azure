var request = require('request');

module.exports = function(RED)
{
    function computervision(config)
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
                        url: 'https://westus.api.cognitive.microsoft.com/vision/v1.0/analyze?visualFeatures=Categories,Tags,Description,Faces,ImageType,Color,Adult',
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
                        url: 'https://westus.api.cognitive.microsoft.com/vision/v1.0/analyze?visualFeatures=Categories,Tags,Description,Faces,ImageType,Color,Adult',
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
                                    if (config.operation == "tags") // Tags
                                    {
                                        if (body.tags.length > 0 && body.categories[0].name != null)
                                        {
                                            var tmp = body.tags.sort(function(a, b) {
                                                return b.confidence - a.confidence;
                                            });
                                            var array = [];
                                            for (var i = 0; i < tmp.length; i++)
                                            {
                                                array.push(tmp[i].name);
                                            }
                                            msg.payload = array;
                                        }
                                        else
                                        {
                                            msg.payload = null;
                                        }
                                        msg.detail = body;
                                        node.send(msg);
                                        node.status({});
                                    }
                                    else  if (config.operation == "description") // Description
                                    {
                                        if (body != null && body.description != null && body.description.captions != null && body.description.captions.length > 0)
                                        {
                                            var tmp = body.description.captions.sort(function(a, b) {
                                                return b.confidence - a.confidence;
                                            });
                                            msg.payload = tmp[0].text;
                                        }
                                        else
                                        {
                                            msg.payload = null;
                                        }
                                        msg.detail = body;
                                        node.send(msg);
                                        node.status({});
                                    }
                                    else  if (config.operation == "age") // Faces(age)
                                    {
                                        if (body.faces != null && body.faces.length > 0 && body.faces[0].age != null)
                                        {
                                            msg.payload = body.faces[0].age;
                                        }
                                        else
                                        {
                                            msg.payload = null;
                                        }
                                        msg.detail = body;
                                        node.send(msg);
                                        node.status({});
                                    }
                                    else  if (config.operation == "gender") // Faces(gender)
                                    {
                                        if (body.faces != null && body.faces.length > 0 && body.faces[0].gender != null)
                                        {
                                            msg.payload = body.faces[0].gender;
                                        }
                                        else
                                        {
                                            msg.payload = null;
                                        }
                                        msg.detail = body;
                                        node.send(msg);
                                        node.status({});
                                    }
                                    else  if (config.operation == "adult") // Adult
                                    {
                                        if (body.adult != null && body.adult.adultScore != null)
                                        {
                                            msg.payload = Math.round(body.adult.adultScore * Math.pow(10, 2)) / Math.pow(10, 2);;
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
                                        node.error("Unsupported operation: " + config.operation);
                                        node.status({fill: "red", shape: "ring", text: "Error"});
                                    }
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

    RED.nodes.registerType("Computer Vision", computervision,
    {
        credentials: {
            key: {
                type: "password"
            }
        }
    });                       
}