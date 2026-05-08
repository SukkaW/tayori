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

- Set `responseStyle` to `fields` in `@hey-api/sdk` plugin options
- Enable `throwOnError` and `includeInEntry` in your chosen Hey API client plugin options (e.g. `@hey-api/client-ky`, `@hey-api/client-fetch`, etc.)

```ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // other options...
  plugins: [
    {
      name: '@hey-api/sdk',
      // ... other options
      responseStyle: 'fields' // [!code highlight]
    },
    {
      name: '@hey-api/client-ky',
      // or any of your chosen Hey API client plugin
      // ...other options
      throwOnError: true, // [!code highlight]
      includeInEntry: true // [!code highlight]
    },
    // ...other plugins
  ]
});
```

### Create `tayori` Instance

```ts
import { tayori } from 'tayori';

import type { Options } from 'path/to/hey-api-generated-sdk';
import type { RequestResult } from 'path/to/hey-api-generated-sdk';

export const {
  TayoriProvider,
  useData,
  useDataImmutable,
  useInfinite,
  useMutation
} = tayori<Options, RequestResult>();
```
