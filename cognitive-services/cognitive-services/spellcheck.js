var request = require('request');

module.exports = function(RED)
{
    function spellcheck(config)
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
                var options = {
                    url: 'https://api.cognitive.microsoft.com/bing/v5.0/spellcheck/?mkt=en-us',
                    method: 'POST',
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.credentials.key
                    },
                    form: {
                        "Text": msg.payload
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
                            if (response.statusCode == 200 && body != null && body.flaggedTokens != null)
                            {
                                var flaggedTokens = body.flaggedTokens;
                                var tmp = msg.payload;

                                flaggedTokens = flaggedTokens.sort(function(a, b) {
                                    return b.offset - a.offset;
                                });

                                for (var i = 0; i < flaggedTokens.length; i++)
                                {
                                    var offset = flaggedTokens[i].offset;
                                    var token = flaggedTokens[i].token;
                                    var suggestion = flaggedTokens[i].suggestions[0].suggestion;

                                    var str1 = tmp.substring(0, offset);
                                    var str2 = tmp.substr(offset, token.length);
                                    var str3 = tmp.substring(offset+token.length, tmp.length);

                                    if (str2 == token)
                                    {
                                        tmp = str1 + suggestion + str3;
                                    }
                                }

                                msg.payload = tmp;
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
        });
    }

    RED.nodes.registerType("Bing Spell Check", spellcheck,
    {
        credentials: {
            key: {
                type: "password"
            }
        }
    });                       
}