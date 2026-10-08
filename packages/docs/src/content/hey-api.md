## Getting Started

### Installation

```bash
npm install tayori
pnpm install tayori
yarn add tayori
```

### Configure Hey API

In your Hey API configuration file (`openapi-ts.config.ts`), modify a few settings:

- `responseStyle` of the `@hey-api/sdk` plugin can be either `fields` (the default) or `data` (Hey API only supports it with `@hey-api/client-fetch`). tayori always requests the full response internally and hands your components the response body, so the hooks are typed the same in both styles.
- Enable `throwOnError` and `includeInEntry` in your chosen Hey API client plugin options (e.g. `@hey-api/client-ky`, `@hey-api/client-fetch`, etc.)

```ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // other options...
  plugins: [
    {
      name: '@hey-api/sdk',
      // ... other options
      responseStyle: 'fields' // or 'data', both work with tayori
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

### Create tayori provider and hooks

```tsx
// src/lib/tayori.ts
'use client';

import { tayori } from 'tayori';
import { SWRConfig } from 'swr';

import { createClient } from 'path/to/hey-api-generated-sdk/client';

import type { Options } from 'path/to/hey-api-generated-sdk';
import type { RequestResult } from 'path/to/hey-api-generated-sdk/client';

export const {
  TayoriProvider,
  useData,
  useDataImmutable,
  useInfinite,
  useMutation,
  usePreload
} = tayori<Options, RequestResult>();

export function DataFetchingProvider({ children }: React.PropsWithChildren) {
  // Since you are initializing the Hey API client within React, you have access
  // to React context and hooks and inject them into your client, e.g. auth:
  const { getAccessTokenSilently } = useAuth0();

  return (
    <TayoriProvider
      // initClient is an function that only runs once to initialize your Hey API
      // client instance across your app.
      initClient={() => createClient({
        // ensure `throwOnError` is enabled in your Hey API client
        throwOnError: true, // [!code highlight]
        // you can inject auth from React into your client here
        async auth() {
          return getAccessTokenSilently();
        },
        // other Hey API client options...
        baseUrl: API_URL,
      })}
    >
      <SWRConfig
        // you can also include an optional <SWRConfig /> to configure your own
        // SWR options here, e.g. global error handling, custom cache provider, etc.
        value={{}}
      >
        {children}
      </SWRConfig>
    </TayoriProvider>
  )
}
```

`tayori()` accepts your generated `Options` and `RequestResult` types, which type the SDK call tayori makes internally. They are optional: every hook infers its request options and its response type from the SDK function you pass to it, so `tayori()` without type arguments gives you the same hooks.

By initializing the Hey API client within React through `<TayoriProvider />`, you get access to React context and hooks within your Hey API client, which provides great flexibility for handling auth and other dynamic configurations.

Wrap your app with the `DataFetchingProvider` you just created. You don't have to wrap your entire app with it, just to make sure all your components that are fetching data are wrapped.

```tsx
import { DataFetchingProvider } from '../lib/tayori';

export default function DashboardLayout({ children }: React.PropsWithChildren) {
  return (
    <DataFetchingProvider>
      {children}
    </DataFetchingProvider>
  );
}
```

Here is an example file structure for Next.js App Router:

```
app/
├── (marketing)             ← route group w/o data fetching
│   ├── page.tsx
│   └── blog/
│       └── page.tsx
│
├── (dashboard)             ← route group w/ data fetching
│   ├── layout.tsx          ← wrap with <DataFetchingProvider /> here
│   └── page.tsx
│
└── layout.tsx              ← your root layout with <html /> and <body />
```

> **Using more than one client**
>
> `initClient` only runs once per `<TayoriProvider />` instance. If a part of your app talks to a different API, or needs a differently configured client (another `baseUrl`, another auth scheme, ...), nest another `<TayoriProvider initClient={...} />` around that subtree. The Hey API client instance is part of every SWR key, so requests made through different providers get their own cache entries and never collide, even when they call the same SDK method with the same request options.
>
> The SWR key of a request is `[client, sdkMethod, requestOptions]`. If you ever need to build one by hand (e.g. for SWR's `mutate()`), `useClient()` returns the client of the nearest `<TayoriProvider />`; and `isInternalSWRKey()` tells tayori requests apart from other SWR requests in your own SWR middleware (SWR hands middlewares the raw key, which is a function when the hook was called with a function argument, so check `Array.isArray(key)` before indexing into it).

## Data Fetching

```tsx
import { useData, usePreload } from './lib/tayori';
import { getAllPlanets } from 'path/to/hey-api-generated-sdk';

const preload = usePreload();

const { data, error, isLoading, mutate } = useData(
  getAllPlanets,
  {
    // Hey API request options, with type safety and IDE autocompletion!
    query: {}
  }
);
```

This is the very fundamental API of tayori. It accepts a Hey API generated SDK method (e.g. `getAllPlanets`, `getPlanetById`, etc.) and the corresponding request options (the arguments of that SDK method).

The returned value will be passed as `data` and the error will be passed as `error`, just like SWR.

We recommend you not to use `useData` directly in your application, instead wrap `useData` with your own custom hooks for better reusability, and consistent request/SWR options across your app.

```tsx
export const useAllPlanets = (pageIndex?: number, perPage?: number) => {
  return useData(getAllPlanets, {
    query: {
      page: pageIndex,
      per_page: perPage
    }
  });
};
```

> **Destructuring is safe (and recommended) — but DO NOT spread the return value of `useData`!**
>
> `useData` uses a re-render reduction optimization technique: each field of the return value (`data`, `error`, `isLoading`, etc.) only becomes a re-render dependency once you actually access it, so your component only re-renders when the fields it actually reads change.
>
> Destructuring works perfectly with this optimization — it only accesses the fields you name:
>
> ```tsx
> // ✅ SAFE — only `data` and `isLoading` are accessed, so the
> // component only re-renders when `data` or `isLoading` change
> const { data, isLoading } = useAllPlanets();
> ```
>
> Spreading (`...`), on the other hand, eagerly accesses **every** field at once, so every field becomes a re-render dependency — breaking the optimization and causing unnecessary re-renders:
>
> ```tsx
> // ❌ DON'T DO THIS — spreading eagerly reads every field, causing
> // re-renders whenever ANY field changes, even the ones you never use
> export const useAllPlanets = (pageIndex?: number, perPage?: number) => {
>   return {
>     ...useData(getAllPlanets, { query: { page: pageIndex, per_page: perPage } }),
>     someOtherField: 'someValue'
>   };
> };
> ```
>
> If your custom hook needs to return extra values alongside `useData`'s result, "proxy" the fields with getters instead of spreading. A getter defers the field access to the call site, so a field still only becomes a re-render dependency when the consumer actually reads it:
>
> ```tsx
> // ✅ SAFE — getters keep the field accesses lazy, so the optimization
> // stays intact while callers can still destructure a flat object
> export const useAllPlanets = (pageIndex?: number, perPage?: number) => {
>   const result = useData(getAllPlanets, { query: { page: pageIndex, per_page: perPage } });
>   return {
>     get data() { return result.data; },
>     get error() { return result.error; },
>     get isLoading() { return result.isLoading; },
>     get mutate() { return result.mutate; },
>     someOtherField: 'someValue'
>   };
> };
>
> const { data, isLoading, someOtherField } = useAllPlanets();
> ```

### Conditional Fetching

You can pass a falsy value (`false | null | undefined | 0 | ''`) as the second argument to conditionally disable the request:

```tsx
const [searchQuery, setSearchQuery] = useState('');

const { data, error, isLoading } = useData(
  getAllPlanets,
  // disable the request when searchQuery is empty
  searchQuery ? { query: { q: searchQuery } } : null
)
```

```tsx
const [userInitiatedLoading, setUserInitiatedLoading] = useState(false);
const { data, error, isLoading } = useData(
  getAllPlanets,
  userInitiatedLoading ? { query: { q: searchQuery } } : null
);

<button onClick={() => setUserInitiatedLoading(true)}>Load</button>
```

You can also pass a function to the second argument for more complex conditional logic:

```tsx
const { data, error, isLoading } = useData(
  getAllPlanets,
  () => {
    if (searchQuery.trim().length === 0) return null;
    // you still get type safe and with IDE autocompletion for request options here!
    return { query: { q: searchQuery } };
  }
)
```

### Dependent Fetching

`useData` also allows you to fetch data that depends on the result of another request.

```tsx
// The dependency request
const { data: user } = useData(getCurrentUser, {});
// The second request
const { data: userProjects } = useData(
  getUserProjects,
  user ? { query: { uid: user.id } } : null
);
```

You can also simplify the second request with function-form of the second argument:

```tsx
const { data: userProjects } = useData(
  getUserProjects,
  () => {
    return { query: { uid: user!.id } };
  }
);
```

When the function throws an error (e.g., when `user` hasn't loaded yet and is `undefined`, accessing `user.id` will throw), `useData` will also disable the request (just as if you returned a falsy value) until the next re-render.

The same happens when tayori cannot build the SWR key from the request options: the request is paused and no error is reported. This is intentional and matches SWR, where a key function that throws means "not ready yet".

### SWR Options

You can pass [SWR options](https://swr.vercel.app/docs/api#options) as the third argument of `useData`:

```tsx
useData(
  getAllPlanets,
  { /* Hey API request options */ },
  {
    onSuccess(data) {
      console.log('Data fetched successfully:', data);
    },
    onError(error) {
      console.error('Error fetching data:', error);
    },
    fallbackData: {}, // when provided, the returned `data` will never be `undefined`
    // ...other SWR options
  }
)
```

### Disable Automatic Revalidations

Sometimes, you might want to fetch data only once and never revalidate it, you can replace `useData` with `useDataImmutable` for this use case. Once the data is cached, tayori will never request it again.

```tsx
import { useDataImmutable } from './lib/tayori';

const { data, error, isLoading } = useDataImmutable(getAllPlanets, {
  query: {}
});
```

`useDataImmutable` has the same interface as `useData`. Under the hood, `useDataImmutable` is built on top of SWR's `useSWRImmutable`.

## Mutation

You will need to use `useMutation` for requests that change data on the server, e.g. `POST`, `PUT`, `DELETE`, `PATCH` requests.

```tsx
import { useMutation } from './lib/tayori';
import { createPlanet } from 'path/to/hey-api-generated-sdk';

function PlanetCreationForm() {
  const { mutate: mutateAllPlanets } = useAllPlanets();
  const { trigger, data, error, isMutating, reset } = useMutation(
    createPlanet,
    {/* optional mutation options */}
  );

  const handleSubmit = async (formData) => {
    const data = await trigger({
      /**
       * Hey API request options for createPlanet
       * with type safety and IDE autocompletion!
       */
      body: formData,
      query: {}
    }, {
      /** optional mutation options */
    });

    // revalidate the planets list after creation
    mutateAllPlanets();
  };

  return (
    <form>
      <button type="submit" onClick={handleSubmit} disabled={isMutating}>
        {isMutating ? 'Saving...' : 'Create Planet'}
      </button>
    </form>
  )
}
```

> **Why do I need to call `mutate` after `trigger`?**
>
> Internally, `useData` includes the SDK method function as part of the SWR key, while Hey API typically generates separate SDK methods for fetching and mutating data (e.g. `getPlanetById` for fetching and `createPlanet` for mutating). This means that we can't automatically infer which SWR cache to invalidate after a mutation, so you need to call `mutate` manually to revalidate the relevant SWR cache after a mutation.
>
> We are working with Hey API to expose more metadata information on the SDK methods, so we might be able to automatically revalidate the proper `useData` cache in the future.
>
> If you would rather not keep a reference to the right `mutate` around, tag your requests with SWR's `tags` option and call `revalidateTag` instead, see [Cache Tags](#cache-tags).

We also recommend you to wrap `useMutation` with your own custom hooks for better reusability, just like `useData`.

```tsx
export const useCreatePlanet = () => useMutation(createPlanet);
```

> **Destructuring is safe — but DO NOT spread the return value of `useMutation`!**
>
> Just like `useData`, `useMutation` also uses the same re-render reduction optimization technique. Destructuring (`const { trigger, isMutating } = useMutation(...)`) only accesses the fields you name and keeps the optimization intact, while spreading eagerly accesses every field, breaking the optimization and causing unnecessary re-renders.

### Mutation Options

The mutation options can be passed either as the second argument of `useMutation` or the second argument of `trigger` (take priority):

```tsx
const { trigger } = useMutation(createPlanet, {
  /* mutation options */
});

await trigger(
  { /* Hey API request options */ },
  { /* mutation options */ }
);
```

**onSuccess(data)**

Callback function when a remote mutation has been finished successfully. The `data` argument is the response data of the mutation request.

**onError(error)**

Callback function when a remote mutation has thrown an error.

> **Why can't I have access to other SWR options here?**
>
> Though the interface looks very similar to `useSWRMutation` from SWR, tayori's `useMutation` is not built on top of it, but rather a from-scratch implementation while trying to maintain a similar API. This is because:
>
> 1. As mentioned above, Hey API typically generates separate SDK methods for fetching and mutating data, thus `useMutation` and `useData` will never share the same SWR key, there is no point to build `useMutation` on top of `useSWRMutation`
> 2. Due to a bug of `useSWRMutation` ([vercel/swr#4247](https://github.com/vercel/swr/issues/4247)), `isMutating` will never change to `true` when `trigger` is called within an React transition (e.g. `<form action />`'s `action` prop). You can find more details about the reason behind that in the issue thread. tayori, on the other hand, implements a workaround to make sure `isMutating` works as expected even within `<form action />`.

### Cache Tags

Calling `mutate` after every `trigger` works, but it couples the mutation to whichever `useData` hook happens to be mounted nearby. SWR's cache tags (SWR 2.6+) let you revalidate requests by name instead: pass the `tags` SWR option when you make the requests, then call `revalidateTag` with the same tag after a mutation.

```tsx
import { useSWRConfig } from 'swr';

export const useAllPlanets = (pageIndex?: number, perPage?: number) => {
  return useData(
    getAllPlanets,
    { query: { page: pageIndex, per_page: perPage } },
    { tags: ['planets'] } // [!code highlight]
  );
};

export const useCreatePlanet = () => {
  const { revalidateTag } = useSWRConfig();
  return useMutation(createPlanet, {
    onSuccess() {
      // revalidate every mounted request tagged with "planets",
      // no matter which page / perPage it was requested with
      revalidateTag('planets'); // [!code highlight]
    }
  });
};
```

A few things to keep in mind:

- Tags are an SWR option, not part of the request, so they are not part of the SWR key: tagging a request does not change its cache entry.
- A tag attaches to a cache entry when its request settles, so `revalidateTag` only refetches entries that a mounted hook has fetched; an entry whose hook is not mounted refetches on its next mount anyway.
- `revalidateTag` from `useSWRConfig()` is bound to the cache provider of the nearest `<SWRConfig />`. The `revalidateTag` export of `swr` only reaches the default cache.

To change one entry without refetching it, for example to clear a deleted resource (refetching it would only produce a 404), use SWR's `mutate` with a filter over tayori's keys. A tayori key is `[client, sdkMethod, requestOptions]`:

```tsx
import { useSWRConfig } from 'swr';
import { isInternalSWRKey } from 'tayori';

const { mutate } = useSWRConfig();

// after a delete: clear the entry, no refetch
await mutate(
  (key) => isInternalSWRKey(key) && Array.isArray(key) && key[1] === getPlanet && (key[2] as { path?: { planetId?: number } }).path?.planetId === planetId,
  undefined,
  { revalidate: false }
);
```

### Fetching within an Event Handler

In most cases, you should use `useData` for conditional data fetching.

```tsx
const [userInitiatedLoading, setUserInitiatedLoading] = useState(false);
useData(getAllPlanets, userInitiatedLoading ? {} : null);

const [searchQuery, setSearchQuery] = useState('');
useData(searchPlanets, () => {
  if (searchQuery.trim().length === 0) return null;
  return { query: { q: searchQuery } };
});
```

However, sometimes you might want to trigger a data fetch from an event handler (typically on a user interaction), and also access the response data within the same event handler (where with `useData` the response data will only be available in the next render). In this case, you can also use `useMutation` for fetching data.

```tsx
const { trigger, isMutating } = useMutation(getPlanetById);

<button
  onClick={async () => {
    try {
      const data = await trigger({ query: { id: 'earth' } });
      // access data within the same event handler
      console.log('Fetched planet data:', data);
    } catch (error) {
      console.error('Error fetching planet data:', error);
    }
  }}
  disabled={isMutating}
/>;
```

In this specific nit scenario, you may wanna cache the response for subsequent `useData` hooks (since `getPlanetById` is a GET request without side effects). By enabling the `populateCache` option of `useMutation`, you can populate the cache with the response data for subsequent `useData` hooks:

```tsx
// you can pass `populateCache` to `useMutation`...
const { trigger, isMutating } = useMutation(getPlanetById, { populateCache: true });
// or to `trigger` (take priority)
trigger({ query: { id: 'earth' } }, { populateCache: true });
```

## Pagination and Infinite Loading

Typically, you can achieve pagination with `useData` by passing the parameters as the request options:

```tsx
const [pageIndex, setPageIndex] = useState(0);
const [perPage, setPerPage] = useState(20);

const { data, error, isLoading } = useData(getAllPlanets, {
  query: {
    page: pageIndex,
    per_page: perPage
  }
});
```

You can even preload the next page data by abstracting the page as a dedicated component:

```tsx
function Page({ index, perPage }) {
  const { data } = useAllPlanets(index, perPage);
  return data.map(item => <div key={item.id}>{item.name}</div>)
}
function App () {
  const [pageIndex, setPageIndex] = useState(0);
  const [perPage, setPerPage] = useState(20);
  return (
    <div>
      <Page index={pageIndex} perPage={perPage}/>
      {/* preload the next page data */}
      <div style={{ display: 'none' }}><Page index={pageIndex + 1} perPage={perPage}/></div>
    </div>
  );
}
```

You can use the same technique for simple infinite loading like "Load More" button:

```tsx
function Page({ index }) {
  const { data } = useAllPlanets(index);
  return data.map(item => <div key={item.id}>{item.name}</div>)
}
function App() {
  const [size, setSize] = useState(1);

  const pages: React.ReactNode[] = [];
  for (let i = 0; i < size; i++) {
    pages.push(<Page key={i} index={i} />);
  }

  return (
    <div>
      {pages}
      <button onClick={() => setSize(size + 1)}>Load More</button>
    </div>
  );
}
```

However, there are some cases where you can't use `useData`, typically with cursor-based (or offset-based) pagination where you need the previous page's response data to determine the next page's request options, or infinite loading that also shows how many items/pages have already been loaded (where you need to access every page that has been fetched so far). Here is when `useInfinite` comes in handy.

### useInfinite

You can use `useInfinite` (built on top of SWR's `useSWRInfinite`) from tayori for this use case:

```tsx
const { data: pages, size, setSize, isLoading, mutate } = useInfinite(
  getAllData,
  (pageIndex, previousPageData) => {
    // stop fetching by returning a falsy value
    if (previousPageData && !previousPageData.hasMore) return null;

    const nextCursor = previousPageData?.meta?.nextCursor;
    if (!nextCursor && pageIndex > 0) return null;

    return {
      /* Hey API request options, with type safety and IDE autocompletion */
      query: { cursor: previousPageData?.meta?.nextCursor }
    };
  }
);
```

`useInfinite` accepts the Hey API generated SDK method as the first argument, a "getRequestOptions" function as the second argument, and an optional SWR options as the third argument.

> **Destructuring is safe — but DO NOT spread the return value of `useInfinite`!**
>
> Just like `useData`, `useInfinite` also uses the same re-render reduction optimization technique. Destructuring (`const { data, size, setSize } = useInfinite(...)`) only accesses the fields you name and keeps the optimization intact, while spreading eagerly accesses every field, breaking the optimization and causing unnecessary re-renders.

### Return Values

**data**: an array of responses for each page.
**error**: the latest error thrown by any request.
**isLoading**: same as `useData`
**mutate**: same as `useData`, but it will revalidate all pages

**size**: the number of pages that *will* be fetched and returned
**setSize**: set the number of pages that need to be fetched

Note that, `useInfinite` will fetch `size` number of pages and cache them individually. So when you call `setSize(size + 1)`, it will fetch the next page and append it to the `data` array and give you all pages fetched so far.

### SWR Infinite Options

You can pass [SWR Infinite options](https://swr.vercel.app/docs/pagination#parameters) as the third argument of `useInfinite`:

```tsx
useInfinite(
  getAllData,
  getRequestOptions,
  {
    initialSize: 1, // the initial value of `size`
    parallel: false, // whether to fetch pages in parallel or sequentially
    persistSize: false, // whether NOT to reset `size` back to 1 when first page's request options change
    // ... and other useSWRInfinite options
  }
);
```

## Prefetching

### Programmatic Preloading

You can use the `usePreload` hook to get a `preload` function for prefilling the cache for future `useData` calls within the React.

```tsx
function App() {
  const preload = usePreload();

  // you can then call "preload" function within component render phase
  preload(getAllPlanets, { query: { page: 0, per_page: 20 } });

  // or within an effect
  useEffect(() => {
    preload(getAllPlanets, { query: { page: 0, per_page: 20 } });
  }, [preload]);

  return (
    <button
      // or within an event handler
      onClick={() => preload(getAllPlanets, { query: { page: 0, per_page: 20 } })}
    >
      Preload Planets
    </button>
  );
}
```

> **Why can't I preload outside of React like SWR?**
>
> Your Hey API client instance is initialized within React by `<TayoriProvider />`, so in order to preload data, tayori needs to access the client instance from React context, which is only possible within React.

### Pre-fill Data

tayori hooks all expose SWR options, so you can use the `fallbackData` option to pre-fill the data.

```tsx
// `data` will never be `undefined` and will fallback to `prefetchedPlanets`
const { data } = useData(getAllPlanets, { query: { page: 0, per_page: 20 } }, {
  fallbackData: prefetchedPlanets
});
```

## Server-Side Rendering and Next.js

### Client Components

You can only use tayori hooks within Client Components. You should add `'use client';` directive at the top of your file that uses tayori hooks.

```tsx
'use client';

import { useData } from './lib/tayori';

function MyComponent() {
  const { data } = useAllPlanets();
}
```

### Server-Side Rendering with Default Data

You may call Hey API generated SDK on the server directly within the Server Component to obtain the data, and pass that data to a Client Component as props:

```tsx
async function ServerComponent() {
  // you maybe call the Hey API directly in Server Components
  const prefetched = await getAllPlanets({});

  return <ClientComponent prefetched={prefetched} />;
}
```

Then in the Client Component, you can pass the prefetched data from props to `useData`'s `fallbackData` option to pre-fill the cache:

```tsx
'use client';

function ClientComponent({ prefetched }) {
  const { data } = useData(getAllPlanets, {}, { fallbackData: prefetched });
}
```

With `fallbackData`, the `data` returned by `useData` will never be `undefined`, even on the server, so you get the initial UI within the rendered HTML.

### Real Time Client Side Data Fetching

If you don't provide `fallbackData`, the initial `data` will be `undefined` and the initial `isLoading` will be `true` on the server. You can provide a loading UI for better user experience:

```tsx
'use client';

function ClientComponent() {
  const { data, isLoading } = useAllPlanets();
  if (isLoading) { // also true on the server and during client hydration
    return <div>Loading...</div>;
  }
  return <div>...</div>;
}

// Server HTML will contain `<div>isLoading...</div>`
```

When first loading the page, the user will immediately see the loading UI. After React hydration, tayori hooks will begin fetching data and re-render the component with the actual data accordingly.

## Upgrading from 0.3.x

tayori 0.4.0 splits the project into `tayori-core` (the shared runtime), `tayori` (Hey API mode, this page) and [`tayori-connect`](/connect) (ConnectRPC mode). The Hey API hooks keep their signatures, but a few behaviours changed:

- **SWR key layout.** Keys are now `[client, sdkMethod, requestOptions]`: the Hey API client instance comes first and `cacheTags` are gone (it was `[sdkMethod, requestOptions, cacheTags]`). Middlewares that destructure a key after `isInternalSWRKey()` must shift by one slot, and keys built by hand (for SWR's `mutate()` or `fallback`) need the client, which the new `useClient()` hook returns. `isInternalSWRKey()` also narrows to the `useInfinite` key loader when SWR hands it one, so check `Array.isArray(key)` before indexing.
- **Hooks outside `<TayoriProvider />` throw.** `useData`, `useDataImmutable` and `useInfinite` used to silently never fetch when no provider was mounted; they now throw at render with a clear message, like `useMutation` and `usePreload` already did.
- **`kyOptions.throwHttpErrors` is forced for mutations too.** `useData` already set it for `@hey-api/client-ky`; `useMutation().trigger()` now goes through the same code path, so non-2xx responses always throw.
- **`cacheTags` and `unstable_mutateWithTags` are removed.** Use SWR's own cache tags instead: pass `tags` in the SWR options (the third argument) and call `revalidateTag` from `useSWRConfig()`, see [Cache Tags](#cache-tags). They need SWR 2.6, which is now the minimum `swr` peer version (`^2.6.0-beta.0` until 2.6 is stable). Tags are no longer part of the SWR key, so tagging a request does not change its cache entry anymore.
- **`responseStyle: 'data'` SDKs are supported.** Hooks used to be typed as `never` (`data: undefined`) for SDKs generated with `responseStyle: 'data'`; they now resolve to the response body in both styles, and the `Options` / `RequestResult` type arguments of `tayori()` are optional.
- **`keepPreviousData` is no longer forced.** `<TayoriProvider />` used to install `keepPreviousData: true` for every hook below it, which an outer `<SWRConfig />` could not override. It now installs no SWR options at all, so SWR's default (`false`) applies: pass `keepPreviousData: true` per hook or in your own `<SWRConfig />` where you relied on it, e.g. for paginated views that should keep the current page on screen while the next one loads.
- **Fetchers.** A `fetcher` passed in a hook's own SWR options is honoured (handy for tests and stories), while a global `fetcher` in `<SWRConfig />` is no longer applied to tayori requests.
