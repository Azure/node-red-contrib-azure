module.exports = function(RED) {
	
	var request = require('request');
	var isReadableStream = require('isstream').isReadable;
	var uuid = require('uuid');

	function authorizeBingSpeechAPI(node, msg, callback) {
		if (node.credentials == null || node.credentials.key == null || node.credentials.key == "") {
			node.error("Error with subscription key : null", msg);
			node.status({fill: "red", shape: "ring", text: "Error"});
			return;
		}

		if (node.bingSpeechAuth == undefined || node.bingSpeechAuthTime == undefined || Date.now() - node.bingSpeechAuthTime > 360000 /* 9mn = 360000ms*/ ) {
			var optionsToken = {
				url : 'https://api.cognitive.microsoft.com/sts/v1.0/issueToken',
				method : 'POST',
				headers : {
					'Ocp-Apim-Subscription-Key' : node.credentials.key,
					'Content-Length' : '0'
				}
			};

			request.post(optionsToken, function(error, response, body) {
				if( error != undefined ) {
					node.error("Error with authentication : " + error, msg);
					node.status({fill: "red", shape: "ring", text: "Error"});
					return;
				}

				node.bingSpeechAuth = body;
				node.bingSpeechAuthTime = Date.now();

				callback();
			});

		} else {
			callback();
		}
	}

	function speechToTextNode(config) {
		RED.nodes.createNode(this, config);
		var node = this;
		node.instanceId = uuid();

		node.on('input', function(msg) {
			node.status({fill: "blue", shape: "dot", text: "Requesting"});
			if( msg.payload == null ) {
				node.error("Error with payload : null", msg);
				node.status({fill: "red", shape: "ring", text: "Error"});
				return;
			}
			
			var payloadType = null;

			if( isReadableStream(msg.payload) ) {
				payloadType = "stream";
				if (node.inputStream != msg.payload)
					node.inputStream = msg.payload;
			} else if( Buffer.isBuffer(msg.payload) ) {
				payloadType = "buffer";
			} else {
				node.error("Error with payload : not a Stream Readable nor a Buffer", msg);
				node.status({fill: "red", shape: "ring", text: "Error"});
				return;
			}
	
			authorizeBingSpeechAPI(node, msg, function() {
				if( node.bingSpeechStream == null ) {
					var options = {
						url :	"https://speech.platform.bing.com/recognize?version=3.0" +
								"&format=json" +
								"&scenarios=ulm" +
								"&locale=" + config.locale +
								"&device.os=" + config.userAgent +
								"&appid=D4D52672-91D7-4C74-8AD8-42B1D98141A5" +
								"&requestid=" + uuid() +
								"&instanceid=" + node.instanceId,
						method : "POST",
						headers : {
							'Ocp-Apim-Subscription-Key' : node.credentials.key,
							'Content-Type' : "audio/wav; samplerate=16000",
							'Authorization' : "Bearer "	+ node.bingSpeechAuth
						}
					};
	
					node.bingSpeechStream = request(options, function(error, response, body) {
						node.bingSpeechStream = null;
	
						if( payloadType == "stream" )
							clearTimeout(node.timeoutStream);
	
						if( error != undefined ) {
							node.error("Error with speech to text : " + error, msg);
							node.status({fill: "red", shape: "ring", text: "Error"});
							return;
						}
	
						if( response == undefined || response == null ) {
							node.error("Error with speech to text : response is null", msg);
							node.status({fill: "red", shape: "ring", text: "Error"});
							return;
						}
	
						if( response.statusCode != '200' ) {
							node.error("Error with speech to text : response status - " + JSON.stringify(response), msg);
							node.status({fill: "red", shape: "ring", text: "Error"});
							return;
						}
	
						if( body == undefined || body == null ) {
							node.error("Error with speech to text : body is null", msg);
							node.status({fill: "red", shape: "ring", text: "Error"});
							return;
						}
	
						try {
							var r = JSON.parse(body);
	
							if( r.header == undefined || r.header == null ) {
								node.error("Error with speech to text : body header is null- " + r, msg);
								node.status({fill: "red", shape: "ring", text: "Error"});
								return;
							}
		
							if( r.header.status == undefined || r.header.status == null || r.header.status == 'error' ) {
								node.log("Error with speech to text : incorrect body header - " + r);
								msg.payload = "";
								node.send(msg);
								node.status({});
								return;
							}
	
							msg.payload = r.results[0].lexical;
							msg.confidence = r.results[0].confidence;
							node.log("Text result : " + msg.payload);
							node.send(msg);
							node.status({});
						} catch( e ) {
							node.log("Error with speech to text : incorrect body - " + body + " - " + e);
							msg.payload = "";
							node.send(msg);
							node.status({});
						}
					});
				}
				
				if( payloadType == "stream" ) {
					node.inputStream.pipe(node.bingSpeechStream);

					// Register event on InputStream
					node.inputStream.on('error', function(err) {
						node.error("Error with input stream : " + err, msg);
						node.status({fill: "red", shape: "ring", text: "Error"});
					});
					node.inputStream.on('end', function() {
						node.log("Input stream event 'end'");
						node.inputStream.unpipe(node.bingSpeechStream);
					});
					
					// Register event on BingSpeechStream
					node.bingSpeechStream.on('unpipe', function() {
						node.bingSpeechStream.end();
					});
					
					// Broke the stream after 10sec
					node.timeoutStream = setTimeout(function() {
						node.inputStream.unpipe(node.bingSpeechStream);
						node.log("Input stream interrupted because longer than 10sec");
					}, 10000);
				} else {
					node.bingSpeechStream.write(msg.payload);
				}
			});
		});
	}

	RED.nodes.registerType("Speech To Text", speechToTextNode, {
		credentials : {
			key : {
				type : "password"
			}
		}
	});
}
