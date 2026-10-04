# tayori-core

The backend-agnostic runtime behind [`tayori`](https://www.npmjs.com/package/tayori) (Hey API) and [`tayori-connect`](https://www.npmjs.com/package/tayori-connect) (ConnectRPC): branded SWR keys, the `TayoriProvider`, and the `useData` / `useDataImmutable` / `useInfinite` / `useMutation` / `usePreload` machinery.

You normally do not install this package directly. Use `tayori` or `tayori-connect` instead; they depend on `tayori-core` and expose fully typed hooks for their backend.

This package is intended for adapter authors. Its API may change in minor versions before 1.0.

```ts
import { createTayori } from 'tayori-core';
import type { TayoriBackend, TayoriSimpleTypes } from 'tayori-core';

// The hooks are typed through the backend's `TayoriTypes`: the loose runtime types the backend
// implementation works with (`Method`, `Arg`, `Data`), plus type-level functions from a method to
// its request (`ArgOf`, `MutationArgOf`) and response (`DataOf`) that type every hook. Use
// `TayoriSimpleTypes` when they do not depend on the method, or write your own `TypeFn`s (see how
// `tayori` and `tayori-connect` do it).
const backend: TayoriBackend<TayoriSimpleTypes<Method, Arg, Data>, Client> = {
  name: 'my-backend',
  methodKey: (method) => method,
  argKey: (_method, { cacheTags, ...arg }) => [arg, cacheTags],
  call: (client, method, arg) => client.call(method, arg)
};

export const { useData, useMutation, TayoriProvider } = createTayori(backend);
```

See https://tayori.skk.moe for the user-facing documentation.

## License

[MIT](https://github.com/SukkaW/tayori/blob/master/LICENSE)
