var request = require('request');

module.exports = function(RED)
{
    function linguisticanalysis(config)
    {
        RED.nodes.createNode(this,config);
        var node = this;
        this.on('input', function(msg)
        {
            node.status({fill: "blue", shape: "dot", text: "Requesting"});
            console.log("config.operation=" + config.operation);
            if (this.credentials == null || this.credentials.key == null || this.credentials.key == "")
            {
                node.error("Input subscription key", msg);
                node.status({fill: "red", shape: "ring", text: "Error"});
                console.log("Input subscription key");
            }
            else
            {
                if (config.operation == "tokens") // Tokens
                {
                    var options = {
                        url: 'https://westus.api.cognitive.microsoft.com/linguistics/v1.0/analyze',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json'
                        },
                        json: {
                            "language": "en",
                            "analyzerIds": ["08ea174b-bfdb-4e64-987e-602f85da7f72"],
                            "text": msg.payload
                        }
                    };

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
                                    if (body.length > 0 && body[0].result != null)
                                    {
                                        msg.payload = body[0].result;
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
                else if (config.operation == "postags") // POS Tags
                {
                    var options = {
                        url: 'https://westus.api.cognitive.microsoft.com/linguistics/v1.0/analyze',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json'
                        },
                        json: {
                            "language": "en",
                            "analyzerIds": ["4fa79af1-f22c-408d-98bb-b7d7aeef7f04"],
                            "text": msg.payload
                        }
                    };

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
                                    if (body.length > 0 && body[0].result != null && body[0].result.length > 0)
                                    {
                                        var tmp = "";
                                        for (var i = 0; i < body[0].result.length; i++)
                                        {
                                            for (var j = 0; j < body[0].result[i].length; j++)
                                            {
                                                tmp += body[0].result[i][j] + " ";
                                            }
                                        }
                                        if (tmp.length > 0)
                                        {
                                            tmp = tmp.substring(0, tmp.length-1);
                                        }
                                        msg.payload = tmp;
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
                else if (config.operation == "constituencytree") // Constituency Tree
                {
                    var options = {
                        url: 'https://westus.api.cognitive.microsoft.com/linguistics/v1.0/analyze',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json'
                        },
                        json: {
                            "language": "en",
                            "analyzerIds": ["22a6b758-420f-4745-8a3c-46835a67c0d2"],
                            "text": msg.payload
                        }
                    };

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
                                    if (body.length > 0 && body[0].result != null && body[0].result.length > 0)
                                    {
                                        var tmp = "";
                                        for (var i = 0; i < body[0].result.length; i++)
                                        {
                                            tmp += body[0].result[i] + " ";
                                        }
                                        if (tmp.length > 0)
                                        {
                                            tmp = tmp.substring(0, tmp.length-1);
                                        }
                                        msg.payload = tmp;
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
                else if (config.operation == "listanalyzers") // List Analyzers
                {
                    var options = {
                        url: 'https://westus.api.cognitive.microsoft.com/linguistics/v1.0/analyzers',
                        method: 'GET',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key
                        }
                    };

                    //console.log("options=" + JSON.stringify(options));   
                    request(options, function (error, response, body)
                    {
                        try
                        {
                            if (!error)
                            {
                                try { body = JSON.parse(body); } catch (e) {}
                                console.log("response.statusCode=" + response.statusCode + ", body=" + JSON.stringify(body));
                                if (response.statusCode == 200 && body != null)
                                {
                                    msg.payload = body;
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
                    node.error("Unsupported operation: " + config.operation);
                    node.status({fill: "red", shape: "ring", text: "Error"});
                }
            }
        });
    }

    RED.nodes.registerType("Linguistic Analysis", linguisticanalysis,
    {
        credentials: {
            key: {
                type: "password"
            }
        }
    });                       
}