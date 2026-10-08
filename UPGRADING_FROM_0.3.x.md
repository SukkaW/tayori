# Upgrading from 0.3.x

The Hey API hooks keep their signatures in tayori 0.4.0, but a few behaviours changed:

- **Don't rely on the shape of tayori's SWR keys.** It changed in 0.4.0 and is not a public contract, so don't read or build keys by hand. Use `isTayoriKey()` to recognize tayori requests in your own SWR middleware. `isInternalSWRKey()` is a deprecated alias of it.
- **Hooks outside `<TayoriProvider />` throw.** `useData`, `useDataImmutable` and `useInfinite` used to silently never fetch when no provider was mounted; they now throw at render with a clear message, like `useMutation` and `usePreload` already did.
- **`kyOptions.throwHttpErrors` is forced for mutations too.** `useData` already set it for `@hey-api/client-ky`; `useMutation().trigger()` now goes through the same code path, so non-2xx responses always throw.
- **`cacheTags` and `unstable_mutateWithTags` are removed.** Use SWR's own cache tags instead: pass `tags` in the SWR options (the third argument) and call `revalidateTag` from `useSWRConfig()`, see [Cache Tags](https://tayori.skk.moe/?backend=hey-api#cache-tags). They need SWR 2.6, which is now the minimum `swr` peer version (`^2.6.0-beta.0` until 2.6 is stable). Tagging a request no longer creates a separate cache entry.
- **`responseStyle: 'data'` SDKs are supported.** Hooks used to be typed as `never` (`data: undefined`) for SDKs generated with `responseStyle: 'data'`; they now resolve to the response body in both styles, and the `Options` / `RequestResult` type arguments of `tayori()` are optional.
- **`keepPreviousData` is no longer forced.** `<TayoriProvider />` used to install `keepPreviousData: true` for every hook below it, which an outer `<SWRConfig />` could not override. It now installs no SWR options at all, so SWR's default (`false`) applies: pass `keepPreviousData: true` per hook or in your own `<SWRConfig />` where you relied on it, e.g. for paginated views that should keep the current page on screen while the next one loads.
- **Fetchers.** A `fetcher` passed in a hook's own SWR options is honoured (handy for tests and stories), while a global `fetcher` in `<SWRConfig />` is no longer applied to tayori requests.
