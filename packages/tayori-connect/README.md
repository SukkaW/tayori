# tayori-connect

An opinionated React client-side data fetching stack built on top of [SWR](https://swr.vercel.app) and [ConnectRPC](https://connectrpc.com) (`@connectrpc/connect` v2 + `@bufbuild/protobuf` v2). The ConnectRPC counterpart of [`tayori`](https://www.npmjs.com/package/tayori).

Documentation: https://tayori.skk.moe/connect

```bash
npm install tayori-connect @connectrpc/connect @connectrpc/connect-web @bufbuild/protobuf
```

```tsx
// src/lib/tayori.ts
'use client';

import { tayoriConnect } from 'tayori-connect';
import { createConnectTransport } from '@connectrpc/connect-web';

export const {
  TayoriProvider,
  useData,
  useDataImmutable,
  useInfinite,
  useMutation,
  usePreload
} = tayoriConnect();

export function DataFetchingProvider({ children }: React.PropsWithChildren) {
  return (
    <TayoriProvider initTransport={() => createConnectTransport({ baseUrl: 'https://demo.connectrpc.com' })}>
      {children}
    </TayoriProvider>
  );
}
```

```tsx
import { ElizaService } from './gen/connectrpc/eliza/v1/eliza_pb';

// The method descriptor is the "SDK method". The second argument describes the request, like
// in `tayori`: the request message under `message`, next to Connect's per-call options
// (`headers`, `timeoutMs`, ...) and tayori's `cacheTags`. SWR options go third.
const { data, error, isLoading } = useData(ElizaService.method.say, { message: { sentence: 'Hello' } });

// Pass a falsy value (or a function returning one) to pause the request
const { data: reply } = useData(ElizaService.method.say, name ? { message: { sentence: `I am ${name}` } } : null);

// Mutations take the same request object (plus an optional `signal`)
const { trigger, isMutating } = useMutation(ElizaService.method.say);
await trigger({ message: { sentence: 'Save me' }, headers: { 'x-request-id': id } });
```

Errors thrown by the transport are Connect's `ConnectError`; use `ConnectError.from(error)` to inspect `code` / `metadata` / `details`.

## License

[MIT](https://github.com/SukkaW/tayori/blob/master/LICENSE)
