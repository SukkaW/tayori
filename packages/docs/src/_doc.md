## Introduction

**tayori** (便り, news from afar) composites SWR and Hey API into a minimal, type-safe React data-fetching stack.

## Getting Started

### Installation

```bash
npm install tayori
pnpm install tayori
yarn add tayori
```

### Configure Hey API

In your Hey API configuration file (`openapi-ts.config.ts`), modify a few settings:

```ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: { ... },
  output: { ... },
  plugins: [
    {
      name: '@hey-api/sdk',
      validator: 'zod',
      operations: { strategy: 'flat' },
      includeInEntry: true
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
```
