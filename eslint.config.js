'use strict';

const { withFiles } = require('@eslint-sukka/shared');

module.exports = require('eslint-config-sukka').sukka({
  ignores: {
    customGlobs: [
      './packages/example-nextjs-app/src/sdk/**/*',
      './packages/tayori-connect/test/gen/**/*'
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
},
// https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
withFiles(
  {
    ...require('eslint-plugin-testing-library').configs['flat/react'],
    settings: {
      // only treat the real RTL render as a render util, NOT renderToString
      // from react-dom/server (the default heuristic matches any render*)
      'testing-library/custom-renders': 'off'
    }
  },
  ['./packages/*/src/**/*.test.{ts,tsx}', './packages/*/test/**/*.{ts,tsx}']
));
