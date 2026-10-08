# TODO

Follow-ups deliberately left out of the `tayori-core` / `tayori` / `tayori-connect` split (2026-09-30).

## Features

- [ ] **Server streaming in `tayori-connect`.** Only unary methods are supported; `getMethodKey()` throws for streaming descriptors. Design sketch: `transport.stream(method, signal, timeoutMs, headers, createAsyncIterable([input]))` behind either a `useSWRSubscription` wrapper or a standalone `useServerStream(method, input, { onMessage })`. `TayoriBackend` reserves an optional `stream` member for this.
- [ ] **Connect example page** in `packages/example-nextjs-app`: `connectrpc.eliza.v1.ElizaService` against `https://demo.connectrpc.com`, mounted next to the Hey API provider to demonstrate that both coexist.

## DX

- [ ] Adapter packages import `tayori-core` through its built `dist` (via `exports`). Turborepo builds it before `test` / `typecheck` (`^build`, cached), so this is no manual step anymore, but editors still show stale types until the next build. Optional improvement: tsconfig `paths` (`"tayori-core": ["../tayori-core/src/index.tsx"]`) for tests/typecheck plus a separate `tsconfig.build.json` for bunchee so published `.d.ts` files keep importing from `tayori-core`.
- [ ] `packages/tayori/src/_is-zod-error.ts` imports the `ZodError` type from `zod`, which is only a devDependency; consumers without `zod` get an unresolved type import in `dist/_is-zod-error.d.ts`. Replace with a structural interface.
- [ ] Generating the Connect test fixture (`pnpm run generate`, run automatically before `test` / `typecheck` / `lint`) needs a writable buf cache; in restricted environments set `BUF_CACHE_DIR` (passed through by `turbo.jsonc`).
