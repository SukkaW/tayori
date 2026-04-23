'use strict';

module.exports = require('eslint-config-sukka').sukka({}, {
  rules: {
    // library does not have react refresh
    'react-refresh/only-export-components': 'off',
    // the factory should only be called once at the module level
    '@eslint-react/component-hook-factories': 'off'
  }
});
