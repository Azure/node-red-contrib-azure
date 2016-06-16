node-amqp-encoder
=================

[![Build Status](https://secure.travis-ci.org/noodlefrenzy/node-amqp-encoder.png?branch=master)](https://travis-ci.org/noodlefrenzy/node-amqp-encoder)
[![Dependency Status](https://david-dm.org/noodlefrenzy/node-amqp-encoder.png)](https://david-dm.org/noodlefrenzy/node-amqp-encoder)

Helper classes for specifying a simple mechanism to encode data into AMQP format, and a simple encoder.

Motivation
==========

AMQP 1.0 defines several custom types ([see spec](http://docs.oasis-open.org/amqp/core/v1.0/os/amqp-core-complete-v1.0-os.pdf)), some of which are used
by AMQP clients to communicate with servers (and vice-versa) and influence their processing - so i.e. not just for message transfer.  One instance of these
is Azure's EventHub, which uses the Attach frame's Filter-set to communicate where to pick up from last time, using a combination of symbols
and described types.  This package defines a common pattern for defining these types in a simple way, without introducing custom Javascript objects (so easily
JSON-able), and provides a simple builder and processor.

Details
=======

The rough outline of the syntax is:

    [ 'type', value ]

Where the following types are available:

 * byte, short, int, long, ubyte, ushort, uint, ulong
 * float, double
 * boolean
 * string, symbol
 * null (_note: no val needed here_)
 * binary (_note: value should be a Node.js Buffer_)

And a few composite types as well:

 * list, map - Encoded as: [ 'list', _val1_, _val2_, ... ]
 * described - Encoded as: [ 'described', _descriptor_, _value_ ]
 * array - Encoded as: [ 'array', _type_, _val1_, _val2_, ... ]

A few primitive types (strings, nulls, booleans) can be inferred, so you don't necessarily need to encode them.  See examples below.

Examples
========

Simple Types
------------

    [ 'uint', 123 ]
    [ 'boolean', x !== 3 ]
    [ 'symbol', 'My Symbol' ]

Composite Types
---------------

    [ 'map', [ 'symbol', 'Key 1' ], [ 'ulong', 1 ], [ 'symbol', 'Key 2' ], [ 'boolean', false ] ]
    [ 'described', [ 'ulong', 0x12 ], [ 'list', [ 'uint', 1 ], ... ] ]
    [ 'array', 'symbol', 'en-US', 'es-US' ]

Inferred Primitive Types
------------------------

    [ 'list', 'My name', false, null, true, [ 'uint', 1 ] ]
