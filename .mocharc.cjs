'use strict';

// Shared by every package: mocha resolves this file by walking up from the package directory,
// `spec` stays relative to the package being tested.
module.exports = {
  require: ['@swc-node/register', require.resolve('./test/setup.cjs')],
  spec: 'src/**/*.test.{ts,tsx}',
  'full-trace': true
};
