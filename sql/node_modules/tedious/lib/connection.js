'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

require('./buffertools');

var BulkLoad = require('./bulk-load');
var Debug = require('./debug');
var EventEmitter = require('events').EventEmitter;
var instanceLookup = require('./instance-lookup').instanceLookup;
var TYPE = require('./packet').TYPE;
var PreloginPayload = require('./prelogin-payload');
var Login7Payload = require('./login7-payload');
var NTLMResponsePayload = require('./ntlm-payload');
var Request = require('./request');
var RpcRequestPayload = require('./rpcrequest-payload');
var SqlBatchPayload = require('./sqlbatch-payload');
var MessageIO = require('./message-io');
var Socket = require('net').Socket;
var TokenStreamParser = require('./token/token-stream-parser').Parser;
var Transaction = require('./transaction').Transaction;
var ISOLATION_LEVEL = require('./transaction').ISOLATION_LEVEL;
var crypto = require('crypto');
var ConnectionError = require('./errors').ConnectionError;
var RequestError = require('./errors').RequestError;

// A rather basic state machine for managing a connection.
// Implements something approximating s3.2.1.

var KEEP_ALIVE_INITIAL_DELAY = 30 * 1000;
var DEFAULT_CONNECT_TIMEOUT = 15 * 1000;
var DEFAULT_CLIENT_REQUEST_TIMEOUT = 15 * 1000;
var DEFAULT_CANCEL_TIMEOUT = 5 * 1000;
var DEFAULT_PACKET_SIZE = 4 * 1024;
var DEFAULT_TEXTSIZE = '2147483647';
var DEFAULT_PORT = 1433;
var DEFAULT_TDS_VERSION = '7_4';

var Connection = (function (_EventEmitter) {
  _inherits(Connection, _EventEmitter);

  function Connection(config) {
    _classCallCheck(this, Connection);

    _get(Object.getPrototypeOf(Connection.prototype), 'constructor', this).call(this);

    this.config = config;
    this.reset = this.reset.bind(this);
    this.socketClose = this.socketClose.bind(this);
    this.socketEnd = this.socketEnd.bind(this);
    this.socketConnect = this.socketConnect.bind(this);
    this.socketError = this.socketError.bind(this);
    this.requestTimeout = this.requestTimeout.bind(this);
    this.connectTimeout = this.connectTimeout.bind(this);
    this.defaultConfig();
    this.createDebug();
    this.createTokenStreamParser();
    this.inTransaction = false;
    this.transactionDescriptors = [new Buffer([0, 0, 0, 0, 0, 0, 0, 0])];
    this.transitionTo(this.STATE.CONNECTING);
  }

  _createClass(Connection, [{
    key: 'close',
    value: function close() {
      return this.transitionTo(this.STATE.FINAL);
    }
  }, {
    key: 'initialiseConnection',
    value: function initialiseConnection() {
      this.connect();
      return this.createConnectTimer();
    }
  }, {
    key: 'cleanupConnection',
    value: function cleanupConnection(redirect) {
      this.redirect = redirect;
      if (!this.closed) {
        this.clearConnectTimer();
        this.clearRequestTimer();
        this.closeConnection();
        if (!this.redirect) {
          this.emit('end');
        } else {
          this.emit('rerouting');
        }
        this.closed = true;
        this.loggedIn = false;
        return this.loginError = null;
      }
    }
  }, {
    key: 'defaultConfig',
    value: function defaultConfig() {
      if (!this.config.options) {
        this.config.options = {};
      }

      if (!this.config.options.textsize) {
        this.config.options.textsize = DEFAULT_TEXTSIZE;
      }

      if (!this.config.options.connectTimeout) {
        this.config.options.connectTimeout = DEFAULT_CONNECT_TIMEOUT;
      }

      if (this.config.options.requestTimeout == undefined) {
        this.config.options.requestTimeout = DEFAULT_CLIENT_REQUEST_TIMEOUT;
      }

      if (this.config.options.cancelTimeout == undefined) {
        this.config.options.cancelTimeout = DEFAULT_CANCEL_TIMEOUT;
      }

      if (!this.config.options.packetSize) {
        this.config.options.packetSize = DEFAULT_PACKET_SIZE;
      }

      if (!this.config.options.tdsVersion) {
        this.config.options.tdsVersion = DEFAULT_TDS_VERSION;
      }

      if (!this.config.options.isolationLevel) {
        this.config.options.isolationLevel = ISOLATION_LEVEL.READ_COMMITTED;
      }

      if (this.config.options.encrypt == undefined) {
        this.config.options.encrypt = false;
      }

      if (!this.config.options.cryptoCredentialsDetails) {
        this.config.options.cryptoCredentialsDetails = {};
      }

      if (this.config.options.useUTC == undefined) {
        this.config.options.useUTC = true;
      }

      if (this.config.options.useColumnNames == undefined) {
        this.config.options.useColumnNames = false;
      }

      if (!this.config.options.connectionIsolationLevel) {
        this.config.options.connectionIsolationLevel = ISOLATION_LEVEL.READ_COMMITTED;
      }

      if (this.config.options.readOnlyIntent == undefined) {
        this.config.options.readOnlyIntent = false;
      }

      if (this.config.options.enableAnsiNullDefault == undefined) {
        this.config.options.enableAnsiNullDefault = true;
      }

      if (!this.config.options.port && !this.config.options.instanceName) {
        this.config.options.port = DEFAULT_PORT;
      } else if (this.config.options.port && this.config.options.instanceName) {
        throw new Error('Port and instanceName are mutually exclusive, but ' + this.config.options.port + ' and ' + this.config.options.instanceName + ' provided');
      } else if (this.config.options.port) {
        if (this.config.options.port < 0 || this.config.options.port > 65536) {
          throw new RangeError('Port should be > 0 and < 65536');
        }
      }

      if (this.config.options.columnNameReplacer && typeof this.config.options.columnNameReplacer !== 'function') {
        throw new TypeError('options.columnNameReplacer must be a function or null.');
      }
    }
  }, {
    key: 'createDebug',
    value: function createDebug() {
      var _this = this;

      this.debug = new Debug(this.config.options.debug);
      return this.debug.on('debug', function (message) {
        return _this.emit('debug', message);
      });
    }
  }, {
    key: 'createTokenStreamParser',
    value: function createTokenStreamParser() {
      var _this2 = this;

      this.tokenStreamParser = new TokenStreamParser(this.debug, void 0, this.config.options);

      this.tokenStreamParser.on('infoMessage', function (token) {
        return _this2.emit('infoMessage', token);
      });

      this.tokenStreamParser.on('sspichallenge', function (token) {
        if (token.ntlmpacket) {
          _this2.ntlmpacket = token.ntlmpacket;
        }
        return _this2.emit('sspichallenge', token);
      });

      this.tokenStreamParser.on('errorMessage', function (token) {
        _this2.emit('errorMessage', token);
        if (_this2.loggedIn) {
          if (_this2.request) {
            _this2.request.error = RequestError(token.message, 'EREQUEST');
            _this2.request.error.number = token.number;
            _this2.request.error.state = token.state;
            _this2.request.error['class'] = token['class'];
            _this2.request.error.serverName = token.serverName;
            _this2.request.error.procName = token.procName;
            return _this2.request.error.lineNumber = token.lineNumber;
          }
        } else {
          return _this2.loginError = ConnectionError(token.message, 'ELOGIN');
        }
      });

      this.tokenStreamParser.on('databaseChange', function (token) {
        return _this2.emit('databaseChange', token.newValue);
      });

      this.tokenStreamParser.on('languageChange', function (token) {
        return _this2.emit('languageChange', token.newValue);
      });

      this.tokenStreamParser.on('charsetChange', function (token) {
        return _this2.emit('charsetChange', token.newValue);
      });

      this.tokenStreamParser.on('loginack', function (token) {
        if (!token.tdsVersion) {
          // unsupported TDS version
          _this2.loginError = ConnectionError('Server responded with unknown TDS version.', 'ETDS');
          _this2.loggedIn = false;
          return;
        }

        if (!token['interface']) {
          // unsupported interface
          _this2.loginError = ConnectionError('Server responded with unsupported interface.', 'EINTERFACENOTSUPP');
          _this2.loggedIn = false;
          return;
        }

        // use negotiated version
        _this2.config.options.tdsVersion = token.tdsVersion;
        return _this2.loggedIn = true;
      });

      this.tokenStreamParser.on('routingChange', function (token) {
        _this2.routingData = token.newValue;
        return _this2.dispatchEvent('routingChange');
      });

      this.tokenStreamParser.on('packetSizeChange', function (token) {
        return _this2.messageIo.packetSize(token.newValue);
      });

      // A new top-level transaction was started. This is not fired
      // for nested transactions.
      this.tokenStreamParser.on('beginTransaction', function (token) {
        _this2.transactionDescriptors.push(token.newValue);
        return _this2.inTransaction = true;
      });

      // A top-level transaction was committed. This is not fired
      // for nested transactions.
      this.tokenStreamParser.on('commitTransaction', function () {
        _this2.transactionDescriptors.length = 1;
        return _this2.inTransaction = false;
      });

      // A top-level transaction was rolled back. This is not fired
      // for nested transactions. This is also fired if a batch
      // aborting error happened that caused a rollback.
      this.tokenStreamParser.on('rollbackTransaction', function () {
        _this2.transactionDescriptors.length = 1;
        // An outermost transaction was rolled back. Reset the transaction counter
        _this2.inTransaction = false;
        return _this2.emit('rollbackTransaction');
      });

      this.tokenStreamParser.on('columnMetadata', function (token) {
        if (_this2.request) {
          var columns = undefined;
          if (_this2.config.options.useColumnNames) {
            columns = {};
            for (var j = 0, len = token.columns.length; j < len; j++) {
              var col = token.columns[j];
              if (columns[col.colName] == null) {
                columns[col.colName] = col;
              }
            }
          } else {
            columns = token.columns;
          }
          return _this2.request.emit('columnMetadata', columns);
        } else {
          _this2.emit('error', new Error("Received 'columnMetadata' when no sqlRequest is in progress"));
          return _this2.close();
        }
      });

      this.tokenStreamParser.on('order', function (token) {
        if (_this2.request) {
          return _this2.request.emit('order', token.orderColumns);
        } else {
          _this2.emit('error', new Error("Received 'order' when no sqlRequest is in progress"));
          return _this2.close();
        }
      });

      this.tokenStreamParser.on('row', function (token) {
        if (_this2.request) {
          if (_this2.config.options.rowCollectionOnRequestCompletion) {
            _this2.request.rows.push(token.columns);
          }
          if (_this2.config.options.rowCollectionOnDone) {
            _this2.request.rst.push(token.columns);
          }
          return _this2.request.emit('row', token.columns);
        } else {
          _this2.emit('error', new Error("Received 'row' when no sqlRequest is in progress"));
          return _this2.close();
        }
      });

      this.tokenStreamParser.on('returnStatus', function (token) {
        if (_this2.request) {
          // Keep value for passing in 'doneProc' event.
          return _this2.procReturnStatusValue = token.value;
        }
      });

      this.tokenStreamParser.on('returnValue', function (token) {
        if (_this2.request) {
          return _this2.request.emit('returnValue', token.paramName, token.value, token.metadata);
        }
      });

      this.tokenStreamParser.on('doneProc', function (token) {
        if (_this2.request) {
          _this2.request.emit('doneProc', token.rowCount, token.more, _this2.procReturnStatusValue, _this2.request.rst);
          _this2.procReturnStatusValue = void 0;
          if (token.rowCount !== void 0) {
            _this2.request.rowCount += token.rowCount;
          }
          if (_this2.config.options.rowCollectionOnDone) {
            return _this2.request.rst = [];
          }
        }
      });

      this.tokenStreamParser.on('doneInProc', function (token) {
        if (_this2.request) {
          _this2.request.emit('doneInProc', token.rowCount, token.more, _this2.request.rst);
          if (token.rowCount !== void 0) {
            _this2.request.rowCount += token.rowCount;
          }
          if (_this2.config.options.rowCollectionOnDone) {
            return _this2.request.rst = [];
          }
        }
      });

      this.tokenStreamParser.on('done', function (token) {
        if (_this2.request) {
          if (token.attention) {
            _this2.dispatchEvent('attention');
          }
          if (token.sqlError && !_this2.request.error) {
            // check if the DONE_ERROR flags was set, but an ERROR token was not sent.
            _this2.request.error = RequestError('An unknown error has occurred.', 'UNKNOWN');
          }
          _this2.request.emit('done', token.rowCount, token.more, _this2.request.rst);
          if (token.rowCount !== void 0) {
            _this2.request.rowCount += token.rowCount;
          }
          if (_this2.config.options.rowCollectionOnDone) {
            return _this2.request.rst = [];
          }
        }
      });

      this.tokenStreamParser.on('resetConnection', function () {
        return _this2.emit('resetConnection');
      });

      this.tokenStreamParser.on('tokenStreamError', function (error) {
        _this2.emit('error', error);
        return _this2.close();
      });
    }
  }, {
    key: 'connect',
    value: function connect() {
      var _this3 = this;

      if (this.config.options.port) {
        return this.connectOnPort(this.config.options.port);
      } else {
        return instanceLookup(this.config.server, this.config.options.instanceName, function (message, port) {
          if (_this3.state === _this3.STATE.FINAL) {
            return;
          }
          if (message) {
            return _this3.emit('connect', ConnectionError(message, 'EINSTLOOKUP'));
          } else {
            return _this3.connectOnPort(port);
          }
        }, this.config.options.connectTimeout);
      }
    }
  }, {
    key: 'connectOnPort',
    value: function connectOnPort(port) {
      var _this4 = this;

      this.socket = new Socket({});
      var connectOpts = {
        host: this.routingData ? this.routingData.server : this.config.server,
        port: this.routingData ? this.routingData.port : port
      };
      if (this.config.options.localAddress) {
        connectOpts.localAddress = this.config.options.localAddress;
      }
      this.socket.connect(connectOpts);
      this.socket.on('error', this.socketError);
      this.socket.on('connect', this.socketConnect);
      this.socket.on('close', this.socketClose);
      this.socket.on('end', this.socketEnd);
      this.messageIo = new MessageIO(this.socket, this.config.options.packetSize, this.debug);
      this.messageIo.on('data', function (data) {
        _this4.dispatchEvent('data', data);
      });
      this.messageIo.on('message', function () {
        return _this4.dispatchEvent('message');
      });
      return this.messageIo.on('secure', this.emit.bind(this, 'secure'));
    }
  }, {
    key: 'closeConnection',
    value: function closeConnection() {
      if (this.socket) {
        this.socket.destroy();
      }
    }
  }, {
    key: 'createConnectTimer',
    value: function createConnectTimer() {
      return this.connectTimer = setTimeout(this.connectTimeout, this.config.options.connectTimeout);
    }
  }, {
    key: 'createRequestTimer',
    value: function createRequestTimer() {
      if (this.config.options.requestTimeout) {
        return this.requestTimer = setTimeout(this.requestTimeout, this.config.options.requestTimeout);
      }
    }
  }, {
    key: 'connectTimeout',
    value: function connectTimeout() {
      var message = 'Failed to connect to ' + this.config.server + ':' + this.config.options.port + ' in ' + this.config.options.connectTimeout + 'ms';
      this.debug.log(message);
      this.emit('connect', ConnectionError(message, 'ETIMEOUT'));
      this.connectTimer = void 0;
      return this.dispatchEvent('connectTimeout');
    }
  }, {
    key: 'requestTimeout',
    value: function requestTimeout() {
      this.requestTimer = void 0;
      this.messageIo.sendMessage(TYPE.ATTENTION);
      return this.transitionTo(this.STATE.SENT_ATTENTION);
    }
  }, {
    key: 'clearConnectTimer',
    value: function clearConnectTimer() {
      if (this.connectTimer) {
        return clearTimeout(this.connectTimer);
      }
    }
  }, {
    key: 'clearRequestTimer',
    value: function clearRequestTimer() {
      if (this.requestTimer) {
        return clearTimeout(this.requestTimer);
      }
    }
  }, {
    key: 'transitionTo',
    value: function transitionTo(newState) {
      if (this.state === newState) {
        this.debug.log('State is already ' + newState.name);
        return;
      }

      if (this.state && this.state.exit) {
        this.state.exit.apply(this);
      }

      this.debug.log('State change: ' + (this.state ? this.state.name : undefined) + ' -> ' + newState.name);
      this.state = newState;

      if (this.state.enter) {
        return this.state.enter.apply(this);
      }
    }
  }, {
    key: 'dispatchEvent',
    value: function dispatchEvent(eventName) {
      if (this.state.events[eventName]) {
        var args = new Array(arguments.length - 1);
        for (var i = 0; i < args.length;) {
          args[i++] = arguments[i];
        }
        return this.state.events[eventName].apply(this, args);
      } else {
        this.emit('error', new Error('No event \'' + eventName + '\' in state \'' + this.state.name + '\''));
        return this.close();
      }
    }
  }, {
    key: 'socketError',
    value: function socketError(error) {
      if (this.state === this.STATE.CONNECTING) {
        var message = 'Failed to connect to ' + this.config.server + ':' + this.config.options.port + ' - ' + error.message;
        this.debug.log(message);
        this.emit('connect', ConnectionError(message, 'ESOCKET'));
      } else {
        var message = 'Connection lost - ' + error.message;
        this.debug.log(message);
        this.emit('error', ConnectionError(message, 'ESOCKET'));
      }
      return this.dispatchEvent('socketError', error);
    }
  }, {
    key: 'socketConnect',
    value: function socketConnect() {
      this.socket.setKeepAlive(true, KEEP_ALIVE_INITIAL_DELAY);
      this.closed = false;
      this.debug.log('connected to ' + this.config.server + ':' + this.config.options.port);
      return this.dispatchEvent('socketConnect');
    }
  }, {
    key: 'socketEnd',
    value: function socketEnd() {
      this.debug.log('socket ended');
      return this.transitionTo(this.STATE.FINAL);
    }
  }, {
    key: 'socketClose',
    value: function socketClose() {
      this.debug.log('connection to ' + this.config.server + ':' + this.config.options.port + ' closed');
      if (this.state === this.STATE.REROUTING) {
        this.debug.log('Rerouting to ' + this.routingData.server + ':' + this.routingData.port);
        return this.dispatchEvent('reconnect');
      } else {
        return this.transitionTo(this.STATE.FINAL);
      }
    }
  }, {
    key: 'sendPreLogin',
    value: function sendPreLogin() {
      var payload = new PreloginPayload({
        encrypt: this.config.options.encrypt
      });
      this.messageIo.sendMessage(TYPE.PRELOGIN, payload.data);
      return this.debug.payload(function () {
        return payload.toString('  ');
      });
    }
  }, {
    key: 'emptyMessageBuffer',
    value: function emptyMessageBuffer() {
      return this.messageBuffer = new Buffer(0);
    }
  }, {
    key: 'addToMessageBuffer',
    value: function addToMessageBuffer(data) {
      return this.messageBuffer = Buffer.concat([this.messageBuffer, data]);
    }
  }, {
    key: 'processPreLoginResponse',
    value: function processPreLoginResponse() {
      var preloginPayload = new PreloginPayload(this.messageBuffer);
      this.debug.payload(function () {
        return preloginPayload.toString('  ');
      });

      if (preloginPayload.encryptionString === 'ON' || preloginPayload.encryptionString === 'REQ') {
        return this.dispatchEvent('tls');
      } else {
        return this.dispatchEvent('noTls');
      }
    }
  }, {
    key: 'sendLogin7Packet',
    value: function sendLogin7Packet() {
      var payload = new Login7Payload({
        domain: this.config.domain,
        userName: this.config.userName,
        password: this.config.password,
        database: this.config.options.database,
        serverName: this.routingData ? this.routingData.server : this.config.server,
        appName: this.config.options.appName,
        packetSize: this.config.options.packetSize,
        tdsVersion: this.config.options.tdsVersion,
        initDbFatal: !this.config.options.fallbackToDefaultDb,
        readOnlyIntent: this.config.options.readOnlyIntent
      });

      this.routingData = undefined;
      this.messageIo.sendMessage(TYPE.LOGIN7, payload.data);

      return this.debug.payload(function () {
        return payload.toString('  ');
      });
    }
  }, {
    key: 'sendNTLMResponsePacket',
    value: function sendNTLMResponsePacket() {
      var payload = new NTLMResponsePayload({
        domain: this.config.domain,
        userName: this.config.userName,
        password: this.config.password,
        database: this.config.options.database,
        appName: this.config.options.appName,
        packetSize: this.config.options.packetSize,
        tdsVersion: this.config.options.tdsVersion,
        ntlmpacket: this.ntlmpacket,
        additional: this.additional
      });
      this.messageIo.sendMessage(TYPE.NTLMAUTH_PKT, payload.data);
      return this.debug.payload(function () {
        return payload.toString('  ');
      });
    }
  }, {
    key: 'sendDataToTokenStreamParser',
    value: function sendDataToTokenStreamParser(data) {
      return this.tokenStreamParser.addBuffer(data);
    }
  }, {
    key: 'sendInitialSql',
    value: function sendInitialSql() {
      var payload = new SqlBatchPayload(this.getInitialSql(), this.currentTransactionDescriptor(), this.config.options);
      return this.messageIo.sendMessage(TYPE.SQL_BATCH, payload.data);
    }
  }, {
    key: 'getInitialSql',
    value: function getInitialSql() {
      var xact_abort = this.config.options.abortTransactionOnError ? 'on' : 'off';
      var enableAnsiNullDefault = this.config.options.enableAnsiNullDefault ? 'on' : 'off';
      return 'set textsize ' + this.config.options.textsize + '\nset quoted_identifier on\nset arithabort off\nset numeric_roundabort off\nset ansi_warnings on\nset ansi_padding on\nset ansi_nulls on\nset ansi_null_dflt_on ' + enableAnsiNullDefault + '\nset concat_null_yields_null on\nset cursor_close_on_commit off\nset implicit_transactions off\nset language us_english\nset dateformat mdy\nset datefirst 7\nset transaction isolation level ' + this.getIsolationLevelText(this.config.options.connectionIsolationLevel) + '\nset xact_abort ' + xact_abort;
    }
  }, {
    key: 'processedInitialSql',
    value: function processedInitialSql() {
      this.clearConnectTimer();
      return this.emit('connect');
    }
  }, {
    key: 'processLogin7Response',
    value: function processLogin7Response() {
      if (this.loggedIn) {
        return this.dispatchEvent('loggedIn');
      } else {
        if (this.loginError) {
          this.emit('connect', this.loginError);
        } else {
          this.emit('connect', ConnectionError('Login failed.', 'ELOGIN'));
        }
        return this.dispatchEvent('loginFailed');
      }
    }
  }, {
    key: 'processLogin7NTLMResponse',
    value: function processLogin7NTLMResponse() {
      if (this.ntlmpacket) {
        return this.dispatchEvent('receivedChallenge');
      } else {
        if (this.loginError) {
          this.emit('connect', this.loginError);
        } else {
          this.emit('connect', ConnectionError('Login failed.', 'ELOGIN'));
        }
        return this.dispatchEvent('loginFailed');
      }
    }
  }, {
    key: 'processLogin7NTLMAck',
    value: function processLogin7NTLMAck() {
      if (this.loggedIn) {
        return this.dispatchEvent('loggedIn');
      } else {
        if (this.loginError) {
          this.emit('connect', this.loginError);
        } else {
          this.emit('connect', ConnectionError('Login failed.', 'ELOGIN'));
        }
        return this.dispatchEvent('loginFailed');
      }
    }
  }, {
    key: 'execSqlBatch',
    value: function execSqlBatch(request) {
      return this.makeRequest(request, TYPE.SQL_BATCH, new SqlBatchPayload(request.sqlTextOrProcedure, this.currentTransactionDescriptor(), this.config.options));
    }
  }, {
    key: 'execSql',
    value: function execSql(request) {
      var _this5 = this;

      request.transformIntoExecuteSqlRpc();
      if (request.error != null) {
        return process.nextTick(function () {
          _this5.debug.log(request.error.message);
          return request.callback(request.error);
        });
      }
      return this.makeRequest(request, TYPE.RPC_REQUEST, new RpcRequestPayload(request, this.currentTransactionDescriptor(), this.config.options));
    }
  }, {
    key: 'newBulkLoad',
    value: function newBulkLoad(table, callback) {
      return new BulkLoad(table, this.config.options, callback);
    }
  }, {
    key: 'execBulkLoad',
    value: function execBulkLoad(bulkLoad) {
      var _this6 = this;

      var request = new Request(bulkLoad.getBulkInsertSql(), function (error) {
        if (error) {
          if (error.code === 'UNKNOWN') {
            error.message += ' This is likely because the schema of the BulkLoad does not match the schema of the table you are attempting to insert into.';
          }
          bulkLoad.error = error;
          return bulkLoad.callback(error);
        } else {
          return _this6.makeRequest(bulkLoad, TYPE.BULK_LOAD, bulkLoad.getPayload());
        }
      });
      return this.execSqlBatch(request);
    }
  }, {
    key: 'prepare',
    value: function prepare(request) {
      request.transformIntoPrepareRpc();
      return this.makeRequest(request, TYPE.RPC_REQUEST, new RpcRequestPayload(request, this.currentTransactionDescriptor(), this.config.options));
    }
  }, {
    key: 'unprepare',
    value: function unprepare(request) {
      request.transformIntoUnprepareRpc();
      return this.makeRequest(request, TYPE.RPC_REQUEST, new RpcRequestPayload(request, this.currentTransactionDescriptor(), this.config.options));
    }
  }, {
    key: 'execute',
    value: function execute(request, parameters) {
      var _this7 = this;

      request.transformIntoExecuteRpc(parameters);
      if (request.error != null) {
        return process.nextTick(function () {
          _this7.debug.log(request.error.message);
          return request.callback(request.error);
        });
      }
      return this.makeRequest(request, TYPE.RPC_REQUEST, new RpcRequestPayload(request, this.currentTransactionDescriptor(), this.config.options));
    }
  }, {
    key: 'callProcedure',
    value: function callProcedure(request) {
      var _this8 = this;

      request.validateParameters();
      if (request.error != null) {
        return process.nextTick(function () {
          _this8.debug.log(request.error.message);
          return request.callback(request.error);
        });
      }
      return this.makeRequest(request, TYPE.RPC_REQUEST, new RpcRequestPayload(request, this.currentTransactionDescriptor(), this.config.options));
    }
  }, {
    key: 'beginTransaction',
    value: function beginTransaction(callback, name, isolationLevel) {
      var _this9 = this;

      isolationLevel || (isolationLevel = this.config.options.isolationLevel);
      var transaction = new Transaction(name || '', isolationLevel);
      if (this.config.options.tdsVersion < '7_2') {
        return this.execSqlBatch(new Request('SET TRANSACTION ISOLATION LEVEL ' + transaction.isolationLevelToTSQL() + ';BEGIN TRAN ' + transaction.name, callback));
      }
      var request = new Request(void 0, function (err) {
        return callback(err, _this9.currentTransactionDescriptor());
      });
      return this.makeRequest(request, TYPE.TRANSACTION_MANAGER, transaction.beginPayload(this.currentTransactionDescriptor()));
    }
  }, {
    key: 'commitTransaction',
    value: function commitTransaction(callback, name) {
      var transaction = new Transaction(name || '');
      if (this.config.options.tdsVersion < '7_2') {
        return this.execSqlBatch(new Request('COMMIT TRAN ' + transaction.name, callback));
      }
      var request = new Request(void 0, callback);
      return this.makeRequest(request, TYPE.TRANSACTION_MANAGER, transaction.commitPayload(this.currentTransactionDescriptor()));
    }
  }, {
    key: 'rollbackTransaction',
    value: function rollbackTransaction(callback, name) {
      var transaction = new Transaction(name || '');
      if (this.config.options.tdsVersion < '7_2') {
        return this.execSqlBatch(new Request('ROLLBACK TRAN ' + transaction.name, callback));
      }
      var request = new Request(void 0, callback);
      return this.makeRequest(request, TYPE.TRANSACTION_MANAGER, transaction.rollbackPayload(this.currentTransactionDescriptor()));
    }
  }, {
    key: 'saveTransaction',
    value: function saveTransaction(callback, name) {
      var transaction = new Transaction(name);
      if (this.config.options.tdsVersion < '7_2') {
        return this.execSqlBatch(new Request('SAVE TRAN ' + transaction.name, callback));
      }
      var request = new Request(void 0, callback);
      return this.makeRequest(request, TYPE.TRANSACTION_MANAGER, transaction.savePayload(this.currentTransactionDescriptor()));
    }
  }, {
    key: 'transaction',
    value: function transaction(cb, isolationLevel) {
      var _this10 = this;

      if (typeof cb !== 'function') {
        throw new TypeError('`cb` must be a function');
      }
      var useSavepoint = this.inTransaction;
      var name = '_tedious_' + crypto.randomBytes(10).toString('hex');
      var self = this;
      var txDone = function txDone(err, done) {
        var args = new Array(arguments.length - 2);
        for (var i = 0; i < args.length;) {
          args[i++] = arguments[i + 1];
        }

        if (err) {
          if (self.inTransaction && self.state === self.STATE.LOGGED_IN) {
            return self.rollbackTransaction(function (txErr) {
              args.unshift(txErr || err);
              return done.apply(null, args);
            }, name);
          } else {
            return process.nextTick(function () {
              args.unshift(err);
              return done.apply(null, args);
            });
          }
        } else {
          if (useSavepoint) {
            return process.nextTick(function () {
              args.unshift(null);
              return done.apply(null, args);
            });
          } else {
            return self.commitTransaction(function (txErr) {
              args.unshift(txErr);
              return done.apply(null, args);
            }, name);
          }
        }
      };
      if (useSavepoint) {
        return this.saveTransaction(function (err) {
          if (err) {
            return cb(err);
          }
          if (isolationLevel) {
            return _this10.execSqlBatch(new Request('SET transaction isolation level ' + _this10.getIsolationLevelText(isolationLevel), function (err) {
              return cb(err, txDone);
            }));
          } else {
            return cb(null, txDone);
          }
        }, name);
      } else {
        return this.beginTransaction(function (err) {
          if (err) {
            return cb(err);
          }
          return cb(null, txDone);
        }, name, isolationLevel);
      }
    }
  }, {
    key: 'makeRequest',
    value: function makeRequest(request, packetType, payload) {
      if (this.state !== this.STATE.LOGGED_IN) {
        var message = 'Requests can only be made in the ' + this.STATE.LOGGED_IN.name + ' state, not the ' + this.state.name + ' state';
        this.debug.log(message);
        return request.callback(RequestError(message, 'EINVALIDSTATE'));
      } else {
        this.request = request;
        this.request.rowCount = 0;
        this.request.rows = [];
        this.request.rst = [];
        this.createRequestTimer();
        this.messageIo.sendMessage(packetType, payload.data, this.resetConnectionOnNextRequest);
        this.resetConnectionOnNextRequest = false;
        this.debug.payload(function () {
          return payload.toString('  ');
        });
        return this.transitionTo(this.STATE.SENT_CLIENT_REQUEST);
      }
    }
  }, {
    key: 'cancel',
    value: function cancel() {
      if (this.state !== this.STATE.SENT_CLIENT_REQUEST) {
        var message = 'Requests can only be canceled in the ' + this.STATE.SENT_CLIENT_REQUEST.name + ' state, not the ' + this.state.name + ' state';
        this.debug.log(message);
        return false;
      } else {
        this.request.canceled = true;
        this.messageIo.sendMessage(TYPE.ATTENTION);
        this.transitionTo(this.STATE.SENT_ATTENTION);
        return true;
      }
    }
  }, {
    key: 'reset',
    value: function reset(callback) {
      var request = new Request(this.getInitialSql(), function (err) {
        return callback(err);
      });
      this.resetConnectionOnNextRequest = true;
      return this.execSqlBatch(request);
    }
  }, {
    key: 'currentTransactionDescriptor',
    value: function currentTransactionDescriptor() {
      return this.transactionDescriptors[this.transactionDescriptors.length - 1];
    }
  }, {
    key: 'getIsolationLevelText',
    value: function getIsolationLevelText(isolationLevel) {
      switch (isolationLevel) {
        case ISOLATION_LEVEL.READ_UNCOMMITTED:
          return 'read uncommitted';
        case ISOLATION_LEVEL.REPEATABLE_READ:
          return 'repeatable read';
        case ISOLATION_LEVEL.SERIALIZABLE:
          return 'serializable';
        case ISOLATION_LEVEL.SNAPSHOT:
          return 'snapshot';
        default:
          return 'read committed';
      }
    }
  }]);

  return Connection;
})(EventEmitter);

module.exports = Connection;

Connection.prototype.STATE = {
  CONNECTING: {
    name: 'Connecting',
    enter: function enter() {
      return this.initialiseConnection();
    },
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      socketConnect: function socketConnect() {
        this.sendPreLogin();
        return this.transitionTo(this.STATE.SENT_PRELOGIN);
      }
    }
  },
  SENT_PRELOGIN: {
    name: 'SentPrelogin',
    enter: function enter() {
      return this.emptyMessageBuffer();
    },
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data) {
        return this.addToMessageBuffer(_data);
      },
      message: function message() {
        return this.processPreLoginResponse();
      },
      noTls: function noTls() {
        this.sendLogin7Packet();
        if (this.config.domain) {
          return this.transitionTo(this.STATE.SENT_LOGIN7_WITH_NTLM);
        } else {
          return this.transitionTo(this.STATE.SENT_LOGIN7_WITH_STANDARD_LOGIN);
        }
      },
      tls: function tls() {
        this.messageIo.startTls(this.config.options.cryptoCredentialsDetails);
        return this.transitionTo(this.STATE.SENT_TLSSSLNEGOTIATION);
      }
    }
  },
  REROUTING: {
    name: 'ReRouting',
    enter: function enter() {
      return this.cleanupConnection(true);
    },
    events: {
      message: function message() {},
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      reconnect: function reconnect() {
        return this.transitionTo(this.STATE.CONNECTING);
      }
    }
  },
  SENT_TLSSSLNEGOTIATION: {
    name: 'SentTLSSSLNegotiation',
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data2) {
        return this.messageIo.tlsHandshakeData(_data2);
      },
      message: function message() {
        if (this.messageIo.tlsNegotiationComplete) {
          this.sendLogin7Packet();
          return this.transitionTo(this.STATE.SENT_LOGIN7_WITH_STANDARD_LOGIN);
        }
      }
    }
  },
  SENT_LOGIN7_WITH_STANDARD_LOGIN: {
    name: 'SentLogin7WithStandardLogin',
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data3) {
        return this.sendDataToTokenStreamParser(_data3);
      },
      loggedIn: function loggedIn() {
        return this.transitionTo(this.STATE.LOGGED_IN_SENDING_INITIAL_SQL);
      },
      routingChange: function routingChange() {
        return this.transitionTo(this.STATE.REROUTING);
      },
      loginFailed: function loginFailed() {
        return this.transitionTo(this.STATE.FINAL);
      },
      message: function message() {
        return this.processLogin7Response();
      }
    }
  },
  SENT_LOGIN7_WITH_NTLM: {
    name: 'SentLogin7WithNTLMLogin',
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data4) {
        return this.sendDataToTokenStreamParser(_data4);
      },
      receivedChallenge: function receivedChallenge() {
        this.sendNTLMResponsePacket();
        return this.transitionTo(this.STATE.SENT_NTLM_RESPONSE);
      },
      loginFailed: function loginFailed() {
        return this.transitionTo(this.STATE.FINAL);
      },
      message: function message() {
        return this.processLogin7NTLMResponse();
      }
    }
  },
  SENT_NTLM_RESPONSE: {
    name: 'SentNTLMResponse',
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data5) {
        return this.sendDataToTokenStreamParser(_data5);
      },
      loggedIn: function loggedIn() {
        return this.transitionTo(this.STATE.LOGGED_IN_SENDING_INITIAL_SQL);
      },
      loginFailed: function loginFailed() {
        return this.transitionTo(this.STATE.FINAL);
      },
      routingChange: function routingChange() {
        return this.transitionTo(this.STATE.REROUTING);
      },
      message: function message() {
        return this.processLogin7NTLMAck();
      }
    }
  },
  LOGGED_IN_SENDING_INITIAL_SQL: {
    name: 'LoggedInSendingInitialSql',
    enter: function enter() {
      return this.sendInitialSql();
    },
    events: {
      connectTimeout: function connectTimeout() {
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data6) {
        return this.sendDataToTokenStreamParser(_data6);
      },
      message: function message() {
        this.transitionTo(this.STATE.LOGGED_IN);
        return this.processedInitialSql();
      }
    }
  },
  LOGGED_IN: {
    name: 'LoggedIn',
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      }
    }
  },
  SENT_CLIENT_REQUEST: {
    name: 'SentClientRequest',
    events: {
      socketError: function socketError(err) {
        var sqlRequest = this.request;
        this.request = void 0;
        sqlRequest.callback(err);
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data7) {
        return this.sendDataToTokenStreamParser(_data7);
      },
      message: function message() {
        this.clearRequestTimer();
        this.transitionTo(this.STATE.LOGGED_IN);
        var sqlRequest = this.request;
        this.request = void 0;
        return sqlRequest.callback(sqlRequest.error, sqlRequest.rowCount, sqlRequest.rows);
      }
    }
  },
  SENT_ATTENTION: {
    name: 'SentAttention',
    enter: function enter() {
      return this.attentionReceived = false;
    },
    events: {
      socketError: function socketError() {
        return this.transitionTo(this.STATE.FINAL);
      },
      data: function data(_data8) {
        return this.sendDataToTokenStreamParser(_data8);
      },
      attention: function attention() {
        return this.attentionReceived = true;
      },
      message: function message() {
        // 3.2.5.7 Sent Attention State
        // Discard any data contained in the response, until we receive the attention response
        if (this.attentionReceived) {
          var sqlRequest = this.request;
          this.request = void 0;
          this.transitionTo(this.STATE.LOGGED_IN);
          if (sqlRequest.canceled) {
            return sqlRequest.callback(RequestError('Canceled.', 'ECANCEL'));
          } else {
            var message = 'Timeout: Request failed to complete in ' + this.config.options.requestTimeout + 'ms';
            return sqlRequest.callback(RequestError(message, 'ETIMEOUT'));
          }
        }
      }
    }
  },
  FINAL: {
    name: 'Final',
    enter: function enter() {
      return this.cleanupConnection();
    },
    events: {
      loginFailed: function loginFailed() {
        // Do nothing. The connection was probably closed by the client code.
      },
      connectTimeout: function connectTimeout() {
        // Do nothing, as the timer should be cleaned up.
      },
      message: function message() {
        // Do nothing
      },
      socketError: function socketError() {
        // Do nothing
      }
    }
  }
};