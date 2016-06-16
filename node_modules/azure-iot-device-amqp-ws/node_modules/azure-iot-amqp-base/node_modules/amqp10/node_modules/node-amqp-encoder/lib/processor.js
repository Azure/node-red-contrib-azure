/**
 * Processes encoded AMQP object by calling callbacks from the given map:
 *
 * * number: Invoked on numerics
 * * fixed: Fixed types - boolean, null
 * * variable: Simple variable types - string, symbol, binary
 * * described: Described type
 * * list: List
 * * map: Map
 * * array: Array
 *
 * Basic callbacks are of the signature (type, value) (e.g. ('uint', 123).
 */
module.exports = function(callbacks) {
    var cbMap = callbacks;
    var singleValue = function(encodedVal) {
        var isArray = encodedVal instanceof Array;
        var type = isArray ? encodedVal[0] : encodedVal;
        if (!isArray || encodedVal.length === 1) {
            // Likely a primitive type
            if (type === null) {
                return cbMap.fixed('null', null);
            } else if (typeof type === 'boolean') {
                return cbMap.fixed('boolean', type);
            } else if (type instanceof Buffer) {
                return cbMap.variable('binary', type);
            }
        }
        switch (type) {
            case 'byte':
            case 'short':
            case 'int':
            case 'long':
            case 'ubyte':
            case 'ushort':
            case 'uint':
            case 'ulong':
            case 'float':
            case 'double':
                return cbMap.number(type, encodedVal[1]);

            case 'null':
                return cbMap.fixed('null', null);
            case 'boolean':
                return cbMap.fixed('boolean', encodedVal[1]);

            case 'string':
            case 'symbol':
                return cbMap.variable(type, encodedVal[1]);

            case 'list':
            case 'map':
            case 'array':
            case 'described':
                return cbMap[type](type, encodedVal.slice(1));

            default:
                // If no val, assume it's just a raw string
                if (!isArray || encodedVal.length === 1) {
                    return cbMap.variable('string', type);
                } else {
                    throw new Error('Unknown encoding type: ' + type);
                }
        }
    };
    return function(encoded) {
        if (encoded[0] instanceof Array) {
            // A set of encoded values.
            var result = [];
            for (var idx = 0; idx < encoded.length; ++idx) {
                result.push(singleValue(encoded[idx]));
            }
            return result;
        } else {
            // Only a single encoded value
            return singleValue(encoded);
        }
    };
};