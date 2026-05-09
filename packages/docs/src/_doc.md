<!-- ## Introduction

**tayori** (便り, news from afar) composites SWR and Hey API into a minimal, type-safe React data-fetching stack. -->

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
      // very long line test test test very long line test test testvery long line test test testvery long line test test test
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

## Data Fetching

```tsx
import { useData } from './lib/tayori';
import { getAllPlanets } from 'path/to/hey-api-generated-sdk';

const { data, error, isLoading, preload, mutate } = useData(
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

> **DO NOT spread the return value of `useData`!**
>
> `useData` uses a re-redender reduction optimization technique, that can track if you have accessed specific fields, and only re-render when actually used fields change.
>
> Spreading the return value of `useData` will break this optimization and cause unnecessary re-renders.
>
> ```tsx
> // DON'T DO THIS
> export const useAllPlanets = (pageIndex?: number, perPage?: number) => {
>   return {
>     ...useData(getAllPlanets, { query: { page: pageIndex, per_page: perPage } }),
>     someOtherField: 'someValue'
>   };
> };
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

`useDataImmutable` has the same interface as `useData`. nder the hood, `useDataImmutable` is built on top of SWR's `useSWRImmutable`.

## Mutation

You will need to use `useMutation` for requests that change data on the server, e.g. `POST`, `PUT`, `DELETE`, `PATCH` requests.

```tsx
import { useMutation } from './lib/tayori';
import { createPlanet } from 'path/to/hey-api-generated-sdk';

function PlanetCreationForm() {
  const { mutate: mutateAllPlanets } = useGetAllPlanets();
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

We also recommend you to wrap `useMutation` with your own custom hooks for better reusability, just like `useData`.

```tsx
export const useCreatePlanet = () => useMutation(createPlanet);
```

> **DO NOT spread the return value of `useMutation`!**
>
> Just like `useData`, `useMutation` also uses the same re-redender reduction optimization technique.
> Spreading the return value of `useMutation` will break this optimization and cause unnecessary re-renders.

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
  const { data } = useGetAllPlanets(index, perPage);
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
  const { data } = useGetAllPlanets(index);
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

> **DO NOT spread the return value of `useInfinite`!**
>
> Just like `useData`, `useInfinite` also uses the same re-redender reduction optimization technique.
> Spreading the return value of `useInfinite` will break this optimization and cause unnecessary re-renders.

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
    intialSize: 1, // the initial value of `size`
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
  const { preload } = usePreload();

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
  const { data } = useGetAllPlanets();
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
  const { data, isLoading } = useGetAllPlanets();
  if (isLoading) { // also true on the server and during client hydration
    return <div>Loading...</div>;
  }
  return <div>...</div>;
}

// Server HTML will contain `<div>isLoading...</div>`
```

When first loading the page, the user will immediately see the loading UI. After React hydration, tayori hooks will begin fetching data and re-render the component with the actual data accordingly.

