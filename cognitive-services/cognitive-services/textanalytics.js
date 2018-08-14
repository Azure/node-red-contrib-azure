var request = require('request');

module.exports = function(RED)
{
    function textanalytics(config)
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
                if (config.operation == "detectlanguage") // Detect Language
                {
                    var options = {
                        url: 'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/languages',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json'
                        },
                        json: {
                            "documents": [
                                {
                                    "id": "0",
                                    "text": msg.payload
                                }
                                ]
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
                                if (response.statusCode == 200 && body != null && body.documents != null)
                                {
                                    if (body.documents.length > 0 && body.documents[0].detectedLanguages != null && body.documents[0].detectedLanguages.length > 0 && body.documents[0].detectedLanguages[0].name != null)
                                    {
                                        msg.payload = body.documents[0].detectedLanguages[0].name;
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
                else if (config.operation == "keyphrases") // Key Phrases
                {
                    var options = {
                        url: 'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/keyPhrases',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json'
                        },
                        json: {
                            "documents": [
                                {
                                    "language": "en",
                                    "id": "0",
                                    "text": msg.payload
                                }
                                ]
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
                                if (response.statusCode == 200 && body != null && body.documents != null)
                                {
                                    if (body.documents.length > 0 && body.documents[0].keyPhrases != null)
                                    {
                                        msg.payload = body.documents[0].keyPhrases;
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
                else if (config.operation == "sentiment") // Sentiment
                {
                    var options = {
                        url: 'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/sentiment',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json'
                        },
                        json: {
                            "documents": [
                                {
                                    "language": "en",
                                    "id": "0",
                                    "text": msg.payload
                                }
                                ]
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
                                if (response.statusCode == 200 && body != null && body.documents != null)
                                {
                                    if (body.documents.length > 0 && body.documents[0].score != null)
                                    {
                                        msg.payload = body.documents[0].score;
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
                    node.error("Unsupported operation: " + config.operation);
                    node.status({fill: "red", shape: "ring", text: "Error"});
                }
            }
        });
    }

    RED.nodes.registerType("Text Analytics", textanalytics,
    {
        credentials: {
            key: {
                type: "password"
            }
        }
    });                       
}