// Test fixtures: the same API generated with both Hey API response styles, so that the tests can
// check tayori's runtime behavior and types against each. Regenerate with `pnpm --filter tayori generate`.
const responseStyles = ['fields', 'data'] as const;

export default responseStyles.map((responseStyle) => ({
  input: './test/openapi/planets.json',
  output: {
    path: `./test/gen/${responseStyle}`,
    importFileExtension: undefined
  },
  plugins: [
    {
      name: '@hey-api/sdk',
      // the option this fixture is about: what SDK functions resolve to
      responseStyle
    },
    {
      // `responseStyle: 'data'` is only supported by the fetch client
      name: '@hey-api/client-fetch',
      // as required by tayori, see https://tayori.skk.moe/?backend=hey-api#configure-hey-api
      throwOnError: true
    },
    '@hey-api/typescript'
  ]
}));
