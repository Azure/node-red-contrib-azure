var builder     = require('buffer-builder'),
    should      = require('should');

function newBuf(contents) {
    var bufb = new builder();
    for (var idx = 0; idx < contents.length; idx++) {
        var cur = contents[idx];
        if (typeof cur === 'function') {
            cur.call(bufb, contents[++idx]);
        } else if (typeof cur === 'string') {
            bufb.appendString(cur);
        } else {
            bufb.appendUInt8(cur);
        }
    }
    return bufb.get();
}

module.exports.newBuf = newBuf;

function shouldBufEql(expected, actual, msg) {
    msg = msg ? msg + ': ' : '';
    if (actual instanceof builder) {
        actual = actual.get();
    }
    if (expected instanceof Array) {
        expected = newBuf(expected);
    }

    var expectedStr = expected.toString('hex');
    var actualStr = actual.toString('hex');
    if (actualStr.length > 100) {
        // If too long, check length first.
        actualStr.length.should.eql(expectedStr.length,
            msg + '\nActual:   ' + (actualStr.length > 100 ? actualStr.substring(0, 100) + '...' : actualStr) +
            ' vs.  \nExpected: ' + (expectedStr.length > 100 ? expectedStr.substring(0,100) + '...' : expectedStr));
    }
    if (msg) {
        actualStr.should.eql(expectedStr, msg);
    } else {
        actualStr.should.eql(expectedStr);
    }
}

module.exports.shouldBufEql = shouldBufEql;
