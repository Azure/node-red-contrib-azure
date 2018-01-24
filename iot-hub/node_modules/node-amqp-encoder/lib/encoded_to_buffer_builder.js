var builder = require('buffer-builder'),
    processor = require('./processor');

function encodeToBuilder(encoded, bufb) {
    if (bufb === undefined) bufb = new builder();
    var encoder = processor({
        number: function (type, val) {
            var absval;
            switch (type) {
                case 'ulong':
                    if (val === 0) bufb.appendUInt8(0x44);
                    else if (val <= 0xFF) { bufb.appendUInt8(0x53); bufb.appendUInt8(val); }
                    else if (val > 0xFFFFFFFF) throw new Error('Cannot do bitwise operations on 32+-bit values in JS');
                    else {
                        bufb.appendUInt8(0x80);
                        // Top bytes, up to 2^53
                        bufb.appendUInt32BE((0x2FFFFF00000000 & val) >> 4);
                        // Bottom bytes
                        bufb.appendUInt32BE(0xFFFFFFFF & val);
                    }
                    break;
                case 'long':
                    absval = Math.abs(val);
                    if (absval < 0x7F) {
                        bufb.appendUInt8(0x55);
                        bufb.appendUInt8(val < 0 ? (0xFF - absval + 1) : absval);
                    } else if (absval > 0x7FFFFFFF) throw new Error('Cannot do bitwise operations on 32+bit values in JS');
                    else {
                        bufb.appendUInt32BE(val < 0 ? 0xFFFFFFFF : 0);
                        bufb.appendUInt32BE(val < 0 ? (0xFFFFFFFF - absVal + 1) : absVal);
                    }
                    break;

                case 'uint':
                    if (val === 0) bufb.appendUInt8(0x43);
                    else if (val <= 0xFF) { bufb.appendUInt8(0x52); bufb.appendUInt8(val); }
                    else {
                        bufb.appendUInt8(0x70);
                        bufb.appendUInt32BE(val);
                    }
                    break;

                case 'int':
                    absval = Math.abs(val);
                    if (absval <= 0x7F) {
                        bufb.appendUInt8(0x54);
                        bufb.appendInt8(val);
                    } else {
                        bufb.appendUInt8(0x71);
                        bufb.appendInt32BE(val);
                    }
                    break;

                case 'ushort':
                    bufb.appendUInt8(0x60);
                    bufb.appendUInt16BE(val);
                    break;

                case 'short':
                    bufb.appendUInt8(0x61);
                    bufb.appendInt16BE(val);
                    break;

                case 'ubyte':
                    bufb.appendUInt8(0x50);
                    bufb.appendUInt8(val);
                    break;

                case 'byte':
                    bufb.appendUInt8(0x51);
                    bufb.appendInt8(val);
                    break;

                case 'float':
                    bufb.appendUInt8(0x72);
                    bufb.appendFloatBE(val);
                    break;

                case 'double':
                    bufb.appendUInt8(0x82);
                    bufb.appendDoubleBE(val);
                    break;

                default:
                    throw new Error('Unknown number: ' + type);
            }
        },
        fixed: function (type, val) {
            switch (type) {
                case 'null':
                    bufb.appendUInt8(0x40);
                    break;
                case 'boolean':
                    bufb.appendUInt8(val ? 0x41 : 0x42);
                    break;
                default:
                    throw new Error('Unknown fixed: ' + type);
            }
        },
        variable: function (type, val) {
            var asBuf = val instanceof Buffer ? val : new Buffer(val, 'utf8');
            var size = asBuf.length;
            switch (type) {
                case 'string':
                    if (size > 0xFF) {
                        bufb.appendUInt8(0xb1);
                        bufb.appendUInt32BE(size);
                    } else {
                        bufb.appendUInt8(0xa1);
                        bufb.appendUInt8(size);
                    }
                    break;

                case 'symbol':
                    if (size > 0xFF) {
                        bufb.appendUInt8(0xb3);
                        bufb.appendUInt32BE(size);
                    } else {
                        bufb.appendUInt8(0xa3);
                        bufb.appendUInt8(size);
                    }
                    break;

                case 'binary':
                    if (size > 0xFF) {
                        bufb.appendUInt8(0xb0);
                        bufb.appendUInt32BE(size);
                    } else {
                        bufb.appendUInt8(0xa0);
                        bufb.appendUInt8(size);
                    }
            }
            bufb.appendBuffer(asBuf);
        },
        described: function (type, vals) {
            bufb.appendUInt8(0);
            encoder(vals[0]);
            encoder(vals[1]);
        },
        list: function (type, vals) {
            if (!vals || vals.length === 0) {
                bufb.appendUInt8(0x45);
            } else {
                var newBufb = new builder();
                for (var idx = 0; idx < vals.length; idx++) {
                    encodeToBuilder(vals[idx], newBufb);
                }
                var newBuf = newBufb.get();
                var size = newBuf.length;
                if (size > 0xFE) {
                    bufb.appendUInt8(0xd0);
                    bufb.appendUInt32BE(size + 4);
                    bufb.appendUInt32BE(vals.length);
                } else {
                    bufb.appendUInt8(0xc0);
                    bufb.appendUInt8(size + 1);
                    bufb.appendUInt8(vals.length);
                }
                bufb.appendBuffer(newBuf);
            }
        },
        map: function(type, vals) {
            if (!vals || vals.length === 0) {
                bufb.appendUInt8(0xc1);
                bufb.appendUInt16BE(0);
            } else {
                var newBufb = new builder();
                for (var idx = 0; idx < vals.length; idx++) {
                    encodeToBuilder(vals[idx], newBufb);
                }
                var newBuf = newBufb.get();
                var size = newBuf.length;
                if (newBuf.length > 0xFE) {
                    bufb.appendUInt8(0xd1);
                    bufb.appendUInt32BE(size + 4);
                    bufb.appendUInt32BE(vals.length);
                } else {
                    bufb.appendUInt8(0xc1);
                    bufb.appendUInt8(size + 1);
                    bufb.appendUInt8(vals.length);
                }
                bufb.appendBuffer(newBuf);
            }
        },
        array: function(type, vals) {
            if (!vals || vals.length === 0) {
                bufb.appendUInt8(0xe0);
                bufb.appendUInt16BE(0);
            } else {
                var eltType = vals[0];
                vals = vals.slice(1);
                switch (eltType) {
                    case 'string':
                    case 'symbol':
                        var shortCode = type === 'string' ? 0xa1 : 0xa3;
                        var longCode = type === 'string' ? 0xb1 : 0xb3;
                        var size = 1;
                        var totalSize = 0;
                        var asBufs = [];
                        for (var i1 in vals) {
                            var curBuf = new Buffer(vals[i1], 'utf8');
                            asBufs.push(curBuf);
                            if (curBuf.length > 0xFF) size = 4;
                            totalSize += curBuf.length;
                        }
                        totalSize += asBufs.length * size;
                        if (totalSize > 0xFE) {
                            bufb.appendUInt8(0xf0);
                            bufb.appendUInt32BE(totalSize + 4 + 1);
                            bufb.appendUInt32BE(asBufs.length);
                        } else {
                            bufb.appendUInt8(0xe0);
                            bufb.appendUInt8(totalSize + 1 + 1);
                            bufb.appendUInt8(asBufs.length);
                        }
                        var sizeFn;
                        if (size === 4) {
                            bufb.appendUInt8(longCode);
                            sizeFn = bufb.appendUInt32BE;
                        } else {
                            bufb.appendUInt8(shortCode);
                            sizeFn = bufb.appendUInt8;
                        }
                        for (var i2 in asBufs) {
                            sizeFn.call(bufb, asBufs[i2].length);
                            bufb.appendBuffer(asBufs[i2]);
                        }
                        break;

                    default:
                        throw new Error('Cannot encode arrays of ' + eltType + ' yet');
                }
            }
        }
    });
    encoder(encoded);
    return bufb;
}

module.exports = encodeToBuilder;