var builder     = require('./lib/encoded_builder'),
    processor   = require('./lib/processor'),
    bufbuilder  = require('./lib/encoded_to_buffer_builder');

module.exports = {
    Builder: builder,
    Processor: processor,
    ProcessToBuffer: bufbuilder
};
