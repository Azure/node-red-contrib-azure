'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var ws = require('nodejs-websocket');

function WSTransport () {
	EventEmitter.call(this);
	this._socket = null;
}

util.inherits(WSTransport, EventEmitter);

WSTransport.register = function (transportProvider) {
	transportProvider.registerTransport('wss', function () { return new WSTransport(); });
};

WSTransport.prototype.connect = function (address) {
	// The subprotocol specified in extraHeaders is specific to Azure IoT Hub.
	this._socket = ws.connect(address.href, { extraHeaders: { 'Sec-Websocket-Protocol': 'AMQPWSB10' } });
	
	var self = this;
	this._socket.on('connect', function () { self.emit('connect'); });
	this._socket.on('error', function (err) { self.emit('error', err); });
	this._socket.on('text', function (text) { self.emit('data', text); });
	this._socket.on('close', function (code, reason) { self.emit('end', code + ": " + reason); });
	
	this._socket.on('binary', function (inStream) {
		// Empty buffer for collecting binary data
		var data = new Buffer(0);
		// Read chunks of binary data and add to the buffer
		inStream.on("readable", function () {
			var newData = inStream.read();
			if (newData) {
				data = Buffer.concat([data, newData], data.length + newData.length);
			}
		});
		
		inStream.on("end", function () {
			self.emit('data', data);      
		});
	});
};

WSTransport.prototype.write = function (data) {
	if(!this._socket)
		throw new Error('Socket not connected');
	
	this._socket.sendBinary(data);
};

WSTransport.prototype.end = function() {
	if (!this._socket)
		throw new Error('Socket not connected');
	
	if (this._socket.readyState !== this._socket.CLOSED) {	
		this._socket.removeAllListeners();
		this._socket.close();
	}
};

WSTransport.prototype.destroy = function() {
	this._socket = null;
	this.removeAllListeners();
};

module.exports = WSTransport; 