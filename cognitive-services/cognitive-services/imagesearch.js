var request = require('request');
var getRedirectedUrl = function (url, callback)
{
     var options = {
         url: url,
         method: 'GET'
     };
     request(options, function (error, response, body)
     {
         try
         {
             if (!error)
             {
                 if (response.statusCode == 200 && body != null && response.request.uri.href != null)
                 {
                     callback(response.request.uri.href);
                 }
                 else
                 {
                     callback(null);
                 }
             }
             else
             {
                 callback(null);
             }
         } catch (e)
         {
             callback(null);
         }
    });
};
var getRedirectedUrls = function (urls, callback)
{
    var redirectedUrls = [];
    var counter = 0;
    if (urls.length > 0)
    {
        urls.forEach(function(element, index)
        {
            getRedirectedUrl(element, function(redirectedUrl)
            {
                redirectedUrls[index] = redirectedUrl;
                if (++counter == urls.length)
                {
                    callback(redirectedUrls);
                }
            });
        });
    }
    else
    {
        callback(null);
    }
};

module.exports = function(RED)
{
    function imagesearch(config)
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
                if (config.operation == "search") // Search
                {
                    var options = {
                        url: 'https://api.cognitive.microsoft.com/bing/v5.0/images/search?q=' + encodeURI(msg.payload),
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
                                //console.log("response.statusCode=" + response.statusCode + ", body=" + JSON.stringify(body));
                                if (response.statusCode == 200 && body != null && body.value != null)
                                {
                                     var urls = [];
                                     for (var i = 0; i < body.value.length; i++)
                                     {
                                         urls[i] = body.value[i].contentUrl;
                                     }
                                     getRedirectedUrls(urls, function(redirectedUrls)
                                     {
                                         var validRedirectedUrls = [];
                                         if (redirectedUrls != null)
                                         {
                                             redirectedUrls.forEach(function(element, index)
                                             {
                                                 if (element != null)
                                                 {
                                                     validRedirectedUrls.push(element);
                                                 }
                                             });
                                         }
                                         msg.payload = validRedirectedUrls;
                                         msg.detail = body;                                    
                                         node.send(msg);
                                         node.status({});
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
                else if (config.operation == "trendingtopics") // Trending Topics
                {
                    var options = {
                        url: 'https://api.cognitive.microsoft.com/bing/v5.0/images/trending',
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
                                //console.log("response.statusCode=" + response.statusCode + ", body=" + JSON.stringify(body));
                                if (response.statusCode == 200 && body != null && body.value != null)
                                {
                                    msg.payload = body.value;
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

    RED.nodes.registerType("Bing Image Search", imagesearch,
    {
        credentials: {
            key: {
                type: "password"
            }
        }
    });                       
}