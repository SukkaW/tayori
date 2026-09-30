# tayori-core

The backend-agnostic runtime behind [`tayori`](https://www.npmjs.com/package/tayori) (Hey API) and [`tayori-connect`](https://www.npmjs.com/package/tayori-connect) (ConnectRPC): branded SWR keys, the `TayoriProvider` + SWR middleware, and the `useData` / `useDataImmutable` / `useInfinite` / `useMutation` / `usePreload` machinery.

You normally do not install this package directly. Use `tayori` or `tayori-connect` instead; they depend on `tayori-core` and expose fully typed hooks for their backend.

This package is intended for adapter authors. Its API may change in minor versions before 1.0.

```ts
import { createTayori } from 'tayori-core';
import type { TayoriBackend } from 'tayori-core';

const backend: TayoriBackend<Method, Arg, Data, Client> = {
  name: 'my-backend',
  methodKey: (method) => method,
  argKey: (_method, arg) => [arg, undefined],
  fetch: (client, methodKey, argKey) => client.call(methodKey, argKey),
  call: (client, method, arg) => client.call(method, arg)
};

export const { useData, useMutation, TayoriProvider } = createTayori(backend);
```

See https://tayori.skk.moe for the user-facing documentation.

## License

[MIT](https://github.com/SukkaW/tayori/blob/master/LICENSE)
