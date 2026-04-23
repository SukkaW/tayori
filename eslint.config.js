'use strict';

module.exports = require('eslint-config-sukka').sukka({
  ignores: {
    customGlobs: [
      './packages/example-nextjs-app/src/sdk/**/*'
    ]
  },
  next: [
    './packages/example-nextjs-app/**/*.{ts,tsx}'
  ]
}, {
  rules: {
    // library does not have react refresh
    'react-refresh/only-export-components': 'off',
    // the factory should only be called once at the module level
    '@eslint-react/component-hook-factories': 'off'
  }
});
