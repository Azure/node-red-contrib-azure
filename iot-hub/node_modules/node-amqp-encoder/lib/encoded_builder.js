function Builder(onVal, onEnd) {
    this.result = [];
    var self = this;
    this.onVal = onVal || function(v) { self.result.push(v); return self; };
    this.onEnd = onEnd || function(b) { return b; };
}

module.exports = Builder;

// Raw value - e.g. something already encoded/built:
Builder.prototype.append = function(val) {
    if (val instanceof Builder) {
        val = val.encode();
    }
    return this.onVal(val);
};

// Simple values
Builder.prototype.boolean = function(val) { return this.onVal(val); };
Builder.prototype.$false = function() { return this.onVal(false); };
Builder.prototype.$true = function() { return this.onVal(true); };
Builder.prototype.$null = function() { return this.onVal(null); };
Builder.prototype.string = function(val) { return this.onVal(val); };
Builder.prototype.binary = function(val) { return this.onVal(val); };

Builder.prototype.symbol = function(val) {
    if (val === null) return this.onVal(null);
    if (val instanceof Array) return this.onVal(['array', 'symbol'].concat(val));
    return this.onVal(['symbol', val]);
};

var ieee754_binary32_range = [ -1 * Math.pow(2, 126), (2 - Math.pow(2, -23)) * Math.pow(2, 127) ];

/**
 * Encode the given number to the given type.  If type not provided, it will be inferred.
 * Inference prefers unsigned, and smallest representation possible.
 *
 * @param {string} [type]   Type of the number (e.g. ulong).
 * @param {number} val      Value to encode.
 */
Builder.prototype.number = function(type, val) {
    if (val === undefined) {
        val = type;
        type = undefined;
    }

    if (val === null) return this.onVal(null);

    if (type === undefined) {
        var intuited = Builder._intuitNumber(val);
        type = intuited[0];
    }

    return this.onVal([ type, val ]);
};

Builder.prototype.$byte = function(val) { return this.number('byte', val); };
Builder.prototype.$ubyte = function(val) { return this.number('ubyte', val); };
Builder.prototype.$short = function(val) { return this.number('short', val); };
Builder.prototype.$ushort = function(val) { return this.number('ushort', val); };
Builder.prototype.$int = function(val) { return this.number('int', val); };
Builder.prototype.$uint = function(val) { return this.number('uint', val); };
Builder.prototype.$long = function(val) { return this.number('long', val); };
Builder.prototype.$ulong = function(val) { return this.number('ulong', val); };
Builder.prototype.$float = function(val) { return this.number('float', val); };
Builder.prototype.$double = function(val) { return this.number('double', val); };

/**
 * Returns the encoded value built up by previous builder calls.  Does not reset value, allowing encode to be called multiple times.
 *
 * @returns {Array} The encoded value (e.g. ['ulong', 123]).
 */
Builder.prototype.encode = function() {
    return this.result.length === 1 ? this.result[0] : this.result;
};

Builder.prototype.end = function() {
    return this.onEnd(this);
};

/**
 * Resets the builder to allow re-use.
 */
Builder.prototype.reset = function() {
    this.result = [];
    return this;
};

function DescribedTypeBuilder(baseBuilder) {
    this.baseBuilder = baseBuilder;
    this.descriptor = undefined;
    this.value = undefined;
    var self = this;
    this.builder = new Builder(function (val) {
        if (self.descriptor === undefined) {
            self.descriptor = val;
            self.builder.reset();
            return self.builder;
        } else {
            self.value = val;
            return self.baseBuilder.onVal(['described', self.descriptor, self.value]);
        }
    });
}

Builder.prototype.described = function() {
    var dt = new DescribedTypeBuilder(this);
    return dt.builder;
};

function ListBuilder(baseBuilder) {
    this.baseBuilder = baseBuilder;
    this.encoded = ['list'];
    var self = this;
    this.builder = new Builder(function (val) {
        self.encoded.push(val);
        return self.builder;
    }, function(b) {
        return self.baseBuilder.onVal(self.encoded);
    });
}

Builder.prototype.list = function() {
    var l = new ListBuilder(this);
    return l.builder;
};

function MapBuilder(baseBuilder) {
    this.baseBuilder = baseBuilder;
    this.encoded = ['map'];
    var self = this;
    this.builder = new Builder(function (val) {
        self.encoded.push(val);
        return self.builder;
    }, function(b) {
        return self.baseBuilder.onVal(self.encoded);
    });
}

Builder.prototype.map = function(map) {
    if (map !== undefined) {
        return this.onVal(Builder._intuitMap(map));
    } else {
        var m = new MapBuilder(this);
        return m.builder;
    }
};

Builder.prototype.fields = function(map) {
    return this.onVal(Builder._intuitMap(map, 'symbol'));
};

Builder._intuitNumber = function(val) {
    if (val === null) return null;

    var type;
    var isSigned = val < 0;
    var isInt = val % 1 === 0;
    var size;
    if (isInt) {
        if (isSigned) {
            var abs = Math.abs(val);
            if (abs > 0x7FFFFFFF) size = 8;
            else if (abs > 0x7FFF) size = 4;
            else if (abs > 0x7F) size = 2;
            else size = 1;
        } else {
            if (val > 0xFFFFFFFF) size = 8;
            else if (val > 0xFFFF) size = 4;
            else if (val > 0xFF) size = 2;
            else size = 1;
        }
    } else {
        if (val < ieee754_binary32_range[0] || val > ieee754_binary32_range[1]) size = 8;
        else size = 4;
    }

    if (isInt) {
        type = isSigned ? '' : 'u';
        switch(size) {
            case 1:
                type += 'byte';
                break;
            case 2:
                type += 'short';
                break;
            case 4:
                type += 'int';
                break;
            case 8:
                type += 'long';
        }
    } else {
        if (size === 4) type = 'float';
        else type = 'double';
    }
    return [ type, val ];
};

Builder._intuitMap = function(map, keytype) {
    if (map === null) return null;
    var encoded = ['map'];
    for (var k in map) {
        var v = map[k];
        if (keytype) {
            encoded.push([keytype, k]);
        } else {
            encoded.push(k);
        }
        encoded.push(Builder.intuit(v));
    }
    return encoded;
};

Builder.intuit = function(val) {
    if (val === null) return null;
    var type = typeof val;
    if (type === 'boolean' || type === 'string') return val;
    if (val instanceof Buffer) return val;
    if (type === 'number') return Builder._intuitNumber(val);
    if (type === 'object') return Builder._intuitMap(val);

    throw new Error('Unable to intuit encoding for ' + val);
};