# TODO

Follow-ups deliberately left out of the `tayori-core` / `tayori` / `tayori-connect` split (2026-09-30).

## Features

- [ ] **Server streaming in `tayori-connect`.** Only unary methods are supported; `getMethodKey()` throws for streaming descriptors. Design sketch: `transport.stream(method, signal, timeoutMs, headers, createAsyncIterable([input]))` behind either a `useSWRSubscription` wrapper or a standalone `useServerStream(method, input, { onMessage })`. `TayoriBackend` reserves an optional `stream` member for this.
- [ ] **`unstable_mutateWithTags` vs `useInfinite`.** SWR's filter-based `mutate` skips `$inf$` aggregate keys and page keys have no revalidators, so tagged pages are matched but the list is not refetched. Fix: after the filter pass, iterate `SWRConfig.defaultValue.cache.keys()`, and for every matched first-page hash whose `'$inf$' + hash` entry exists, set its SWR-internal `_i: true` flag and `mutate(infKey)` (the protocol `swr/infinite`'s own bound `mutate()` uses). Touches an internal flag, hence the `unstable_` prefix stays.
- [ ] **Connect example page** in `packages/example-nextjs-app`: `connectrpc.eliza.v1.ElizaService` against `https://demo.connectrpc.com`, mounted next to the Hey API provider to demonstrate that both coexist.

## DX

- [ ] Adapter packages import `tayori-core` through its built `dist` (via `exports`), so `pnpm run typecheck` and `pnpm run test` need `pnpm run build` first. Optional improvement: tsconfig `paths` (`"tayori-core": ["../tayori-core/src/index.tsx"]`) for tests/typecheck plus a separate `tsconfig.build.json` for bunchee so published `.d.ts` files keep importing from `tayori-core`.
- [ ] `packages/tayori/src/_is-zod-error.ts` imports the `ZodError` type from `zod`, which is only a devDependency; consumers without `zod` get an unresolved type import in `dist/_is-zod-error.d.ts`. Replace with a structural interface.
- [ ] Regenerating the Connect test fixture (`pnpm --filter tayori-connect generate`) needs a writable buf cache; in restricted environments set `BUF_CACHE_DIR`.
