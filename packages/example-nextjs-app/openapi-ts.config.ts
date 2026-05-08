import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: {
    path: 'https://cdn.jsdelivr.net/npm/@scalar/galaxy/dist/latest.yaml'
  },
  output: {
    importFileExtension: undefined,
    path: './src/sdk'
  },
  plugins: [
    {
      name: '@hey-api/sdk',
      validator: 'zod',
      operations: { strategy: 'flat' },
      includeInEntry: true,
      responseStyle: 'fields'
    },
    {
      name: '@hey-api/client-ky',
      // TODO: we might wanna use throwOnError: false once Hey API actually respects the option
      // see https://github.com/hey-api/openapi-ts/pull/3814
      throwOnError: true,
      includeInEntry: true
    },
    {
      enums: 'javascript',
      name: '@hey-api/typescript'
    }
  ]
});
