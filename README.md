<h1 align="center">📬 tayori</h1>
<p align="center"><sup>(便り, <em>news from afar</em> in Japanese)</sup></p>
<p align="center">An opinionated React client-side data fetching stack that works well with server-side rendering, built with Ky, SWR, Zod, and Hey API</p>

----

**`tayori` is created from many internal applications. Though have been running stable in production for some time, the OSS version of `tayori` is still in early development stage.**

## Usage

```tsx
// @/lib/tayori.ts
import { tayori } from 'tayori';
import type { Options } from 'path/to/hey-api-generated-sdk';
import type { RequestResult } from 'path/to/hey-api-generated-sdk/client';

export const {
  useData,
  useMutation,
  TayoriProvider
} = tayori<Options, RequestResult>();

import { getData, updateData } from 'path/to/hey-api-generated-sdk';

export function useGetData() {
  return useData(sdkMethodGet, { /* request options */ });
}
export function useUpdateData() {
  return useMutation(sdkMethodUpdate);
}

// wrap <TayoriProvider /> around your app with your own provider.
'use client';
import { createClient } from 'path/to/hey-api-generated-sdk/client';

export function RootProvider({ children }: React.PropsWithChildren) {
  // you can inject auth to your client here since it is within React
  // const { getTokenSilently } = useExampleAuth();

  return (
    <TayoriProvider initClient={() => createClient(/* Hey API SDK Client options */)}>
      {children}
    </TayoriProvider>
  );
}

// in your component

// data fetching
const { data, error, isLoading } = useGetData();
// mutation
const { trigger, data, error, isMutating } = useUpdateData();
// in your event handler
await trigger({ /* request options */ });
```

Full example can be found in the [example-nextjs-app](./packages/example-nextjs-app).

## License

[MIT](LICENSE)

----

**tayori** © [Sukka](https://github.com/SukkaW), Released under the [MIT](./LICENSE) License.
Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/tayori/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Mastodon [@sukka@acg.mn](https://acg.mn/@sukka) · Twitter [@isukkaw](https://twitter.com/isukkaw) · BlueSky [@skk.moe](https://bsky.app/profile/skk.moe)

<p align="center">
  <a href="https://github.com/sponsors/SukkaW/">
    <img src="https://sponsor.cdn.skk.moe/sponsors.svg"/>
  </a>
</p>
