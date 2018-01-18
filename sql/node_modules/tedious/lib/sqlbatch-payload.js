'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var WritableTrackingBuffer = require('./tracking-buffer/tracking-buffer').WritableTrackingBuffer;
var writeAllHeaders = require('./all-headers').writeToTrackingBuffer;

/*
  s2.2.6.6
 */
module.exports = (function () {
  function SqlBatchPayload(sqlText, txnDescriptor, options) {
    _classCallCheck(this, SqlBatchPayload);

    this.sqlText = sqlText;

    var buffer = new WritableTrackingBuffer(100 + 2 * this.sqlText.length, 'ucs2');
    if (options.tdsVersion >= '7_2') {
      var outstandingRequestCount = 1;
      writeAllHeaders(buffer, txnDescriptor, outstandingRequestCount);
    }
    buffer.writeString(this.sqlText, 'ucs2');
    this.data = buffer.data;
  }

  _createClass(SqlBatchPayload, [{
    key: 'toString',
    value: function toString(indent) {
      indent || (indent = '');
      return indent + ('SQL Batch - ' + this.sqlText);
    }
  }]);

  return SqlBatchPayload;
})();