var request = require('request');
var xml2js = require('xml2js');
var parseString = xml2js.parseString;

module.exports = function(RED)
{
    function translator(config)
    {
        RED.nodes.createNode(this,config);
        var node = this;
        this.on('input', function(msg)
        {
            node.status({fill: "blue", shape: "dot", text: "Requesting"});
            console.log("config.operation=" + config.operation);
            console.log("config.to=" + config.to);
            if (this.credentials == null || this.credentials.key == null || this.credentials.key == "")
            {
                node.error("Input subscription key", msg);
                node.status({fill: "red", shape: "ring", text: "Error"});
                console.log("Input subscription key");
            }
            else
            {
                if (config.operation == "text") // Text Translation
                {
                    var options = {
                        url: 'https://api.cognitive.microsoft.com/sts/v1.0/issueToken',
                        method: 'POST',
                        headers: {
                            'Ocp-Apim-Subscription-Key': this.credentials.key,
                            'Content-Type': 'application/json',
                            'Accept': 'application/jwt' // todo: delete
                        },
                        json: true
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
                                    var options2 = {
                                        url: 'https://api.microsofttranslator.com/v2/http.svc/Translate?appid=Bearer ' + body + 
                                             '&text=' + encodeURI(msg.payload) + '&to=' + config.to,
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/xml'
                                        },
                                        json: true
                                    };
                                    request(options2, function (error2, response2, body2) {
                                        if (!error2) {
                                            console.log("response.statusCode=" + response2.statusCode + ", body=" + JSON.stringify(body2));
                                            msg.detail = body2;
                                            var option_xml2js = {};
                                            option_xml2js.async = true;
                                            option_xml2js.attrkey = '$';
                                            option_xml2js.charkey = '_';
                                            parseString(body2, option_xml2js, function (error3, result) {
                                                if (!error3) {
                                                    msg.payload = result.string._;
                                                    node.send(msg);
                                                    node.status({});
                                                } else  {
                                                    node.error(error3, msg);
                                                    node.status({fill: "red", shape: "ring", text: "Error"});
                                                }
                                            });
                                        } else {
                                            node.error(error2, msg);
                                            node.status({fill: "red", shape: "ring", text: "Error"});
                                        }
                                    });
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

    RED.nodes.registerType("Translator", translator,
    {
        credentials: {
            key: {
                type: "password"
            }
        }
    });                       
}