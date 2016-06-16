var should      = require('should'),

    builder     = require('../lib/encoded_builder');

describe('Builder', function() {
    describe('#number()', function () {
        it('should pick signed long if asked', function() {
            var b = new builder();
            var encoded = b.number('long', 123).encode();
            encoded.should.eql(['long', 123]);
        });
        it('should pick unsigned byte by itself', function () {
            var b = new builder();
            var encoded = b.number(123).encode();
            encoded.should.eql(['ubyte', 123]);
        });
        it('should work with convenience methods', function() {
            var b = new builder();
            var encoded = b.$uint(123).encode();
            encoded.should.eql(['uint', 123]);
        });
        it('should cope with nulls', function() {
            var b = new builder();
            var encoded = b.number('uint', null).encode();
            (encoded === null).should.be.true;
        })
    });

    describe('#symbol()', function() {
        it('should handle nulls', function() {
            var b = new builder();
            var encoded = b.symbol(null).encode();
            (encoded === null).should.be.true;
        });
        it('should handle multiples', function() {
            var b = new builder();
            var encoded = b.symbol(['array', 'of', 'symbols']).encode();
            encoded.should.eql(['array', 'symbol', 'array', 'of', 'symbols']);
        });
    });

    describe('#described()', function() {
        it('should allow simple descriptors, values', function() {
            var b = new builder();
            var encoded = b.described().number('ulong', 0x10).string('the rest').encode();
            encoded.should.eql([ 'described', ['ulong', 0x10 ], 'the rest']);
        });
        it('should allow complex values', function() {
            var b = new builder();
            var encoded = b.described().symbol('amqp:list:begin').
                list().number('ushort', 1).number('ulong', 1).end().encode();
            encoded.should.eql([ 'described', ['symbol', 'amqp:list:begin'], ['list', ['ushort', 1], ['ulong', 1]]]);
        });
        it('should allow nested described types', function() {
            var b = new builder();
            var encoded = b.described().$ulong(0x12).
                list().
                string('name').
                append(new builder().described().$ulong(0x70).list().string('source').end()).
                end().encode();
            encoded.should.eql([ 'described', ['ulong', 0x12],
                ['list',
                    'name',
                    ['described', ['ulong', 0x70], ['list', 'source']]
                ]
            ]);
        });
    });

    describe('#list()', function() {
        it('should build simple lists', function() {
            var b = new builder();
            var encoded = b.list().
                 number(123).
                 string('foo').
                end().encode();
            encoded.should.eql([ 'list', ['ubyte', 123], 'foo']);
        });
        it('should build empty lists', function() {
            var b = new builder();
            var encoded = b.list().end().encode();
            encoded.should.eql(['list']);
        });
        it('should work with described types', function() {
            var b = new builder();
            var key = 'keyname';
            var val = "x < 'offset'";
            var encoded = b.list().
                symbol(key).
                described().symbol(key).
                string(val).
                end().encode();
            encoded.should.eql(['list', ['symbol', key],
                ['described', ['symbol', key], val]]);
        });
    });

    describe('#map()', function() {
        it('should build simple maps', function() {
            var b = new builder();
            var encoded = b.map().
                 string('key1').number(123).
                 string('key2').number(-123).
                end().encode();
            encoded.should.eql(['map', 'key1', ['ubyte', 123], 'key2', ['byte', -123]]);
        });
        it('should allow empty maps', function() {
            var b = new builder();
            var encoded = b.map().end().encode();
            encoded.should.eql(['map']);
        });
        it('should encode object if given', function() {
            var b = new builder();
            var map = { foo: 123, bar: false, baz: 'value' };
            var encoded = b.map(map).encode();
            encoded.should.eql(['map', 'foo', ['ubyte', 123], 'bar', false, 'baz', 'value']);

            b.reset();
            encoded = b.map({}).encode();
            encoded.should.eql(['map']);

            b.reset();
            encoded = b.map(null).encode();
            (encoded === null).should.be.true;
        });
    });

    describe('#fields()', function() {
        it('should encode object if given', function() {
            var b = new builder();
            var map = { foo: 123, bar: false, baz: 'value' };
            var encoded = b.fields(map).encode();
            encoded.should.eql(['map',
                ['symbol', 'foo'], ['ubyte', 123],
                ['symbol', 'bar'], false,
                ['symbol', 'baz'], 'value']);

            b.reset();
            encoded = b.fields({}).encode();
            encoded.should.eql(['map']);
        });
    });

});
