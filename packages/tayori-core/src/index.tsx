'use client';

import { useStableHandler } from 'foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired';
import { useStateWithDeps } from 'foxact/use-state-with-deps';
import { nullthrow } from 'foxact/nullthrow';
import { useSingleton } from 'foxact/use-singleton';
import { noop } from 'foxact/noop';
import { createContext, startTransition, use, useCallback, useRef, useTransition } from 'react';
import { stableHash } from 'stable-hash';

import type { BareFetcher, SWRConfiguration, Key as SWRKey, SWRResponse } from 'swr';
import type { SWRInfiniteConfiguration, SWRInfiniteKeyLoader, SWRInfiniteResponse } from 'swr/infinite';

import useSWR, { useSWRConfig, preload as swrPreload } from 'swr';
import useSWRImmutable from 'swr/immutable';
import useSWRInfinite from 'swr/infinite';

import type { BrandedTayoriKey } from './key';
import { brand } from './key';
import type {
  ArgOf,
  DataOf,
  Falsy,
  MutationArgOf,
  SWRConfigurationWithOptionalFallback,
  SWRInfiniteConfigurationWithOptionalFallback,
  TayoriBackend,
  TayoriInfiniteKeyLoader,
  TayoriKey,
  TayoriProviderProps,
  TayoriTypes,
  UseMutationOptions
} from './types';

export type {
  BrandedTayoriKey,
  BrandedTayoriKeyLoader,
  TayoriKeyBrand
} from './key';
export { isTayoriKey, kTayoriKey } from './key';
export type {
  Apply,
  ArgOf,
  ConstTypeFn,
  DataOf,
  Falsy,
  MutationArgOf,
  SWRConfigurationWithOptionalFallback,
  SWRInfiniteConfigurationWithOptionalFallback,
  TayoriBackend,
  TayoriInfiniteKeyLoader,
  TayoriKey,
  TayoriProviderProps,
  TayoriSimpleTypes,
  TayoriTypes,
  TypeFn,
  UseMutationOptions
} from './types';

/**
 * Create the tayori hooks + provider for a backend. This is what `tayori` (Hey API) and
 * `tayori-connect` (ConnectRPC) call under the hood. Each call creates an isolated instance with
 * its own React context and its own key brand, so multiple instances (even of different backends)
 * can be nested in the same React tree.
 *
 * Every hook passes its own SWR fetcher, a closure over the method and the hook's latest argument,
 * so no SWR middleware is involved: a global `SWRConfig.fetcher` never applies to tayori keys,
 * while user middlewares that wrap the fetcher keep working.
 *
 * A request that cannot be resolved into a key is "not ready yet" and pauses the hook, exactly like
 * an SWR key function (or a Redux selector) that throws: see `resolveKey`.
 *
 * The hooks are generic over the method they receive and type the request / response through the
 * backend's `TayoriTypes` (see `ArgOf` / `DataOf`), so adapters only need to hand their backend to
 * this function.
 */
export function createTayori<T extends TayoriTypes, Client extends object>(
  backend: TayoriBackend<T, Client>
) {
  type Method = T['Method'];
  type Arg = T['Arg'];
  type Data = T['Data'];
  type Key = BrandedTayoriKey<Client>;
  /** The request arg of a hook, as the facade types it, or something that pauses the request */
  type ArgInput<M> = ArgOf<T, M> | Falsy | (() => ArgOf<T, M> | Falsy);

  // ---------- Client Context and Provider ----------
  const ClientContext = createContext<Client | null>(null);

  function useClient(): Client {
    return nullthrow(use(ClientContext), `[${backend.name}] hooks must be used within <TayoriProvider />`);
  }

  // The provider only provides the client and installs no SWR options of its own (it used to force
  // `keepPreviousData: true`), so SWR's defaults and the app's own `<SWRConfig />` apply unchanged.
  function TayoriProvider({ children, initClient }: TayoriProviderProps<Client>) {
    return (
      <ClientContext value={useSingleton(() => initClient()).current}>
        {children}
      </ClientContext>
    );
  }

  // ---------- Keys ----------
  /**
   * Build one SWR key: `[client, methodKey, argKey]`. This is THE key layout, shared by every hook
   * (and `useInfinite`'s pages). Throws when `backend.argKey` does.
   */
  function buildKey(client: Client, methodKey: unknown, method: Method, arg: Arg): Key {
    return brand<TayoriKey<Client>>([client, methodKey, backend.argKey(method, arg)], backend.name);
  }

  /**
   * Resolve a hook's request into its SWR key, with the same verdict as an SWR key function (or a
   * Redux selector): a falsy request, a request function that returns a falsy value or throws, and a
   * request the backend cannot build a key for all mean "not ready yet" and pause the request.
   *
   * `input` is whatever the hook received (typed by the hook's own signature).
   */
  function resolveKey(client: Client, methodKey: unknown, method: Method, input: unknown): Key | null {
    try {
      const arg = (typeof input === 'function' ? (input as () => unknown)() : input) as Arg | Falsy;
      return arg ? buildKey(client, methodKey, method, arg) : null;
    } catch {
      return null;
    }
  }

  /**
   * The SWR fetcher of a hook: it sends the request stored in the key (slot 2). Keys are lossless,
   * `backend.argKey` only normalizes the request, so the key is the request, like in tayori 0.3.
   * `useSWR` hands its fetcher the first key instance of a hash, which hashes the same and so
   * describes the same request as the latest one; `useSWRInfinite` builds every page key right
   * before fetching it.
   */
  function fetcherFor<D>(client: Client, method: Method): BareFetcher<D> {
    return (key: Key) => backend.call(client, method, key[2]) as Promise<D>;
  }

  /**
   * Build the exact SWR key a hook of this instance would use for `method` + `arg`
   * (`null` when the request is not ready).
   */
  function getKey<M extends Method>(client: Client, method: M, arg: ArgInput<M>): Key | null {
    return resolveKey(client, backend.methodKey(method), method, arg);
  }

  // ---------- useData / useDataImmutable ----------
  // The per-method request / response types (`ArgOf` / `DataOf`) are refinements of the backend's
  // runtime `Arg` / `Data` that TypeScript cannot relate on its own, hence the casts at the boundary.
  function useData<M extends Method, SWROptions extends SWRConfiguration<DataOf<T, M>> = SWRConfiguration<DataOf<T, M>>>(
    method: M,
    arg: ArgInput<M>,
    config?: SWRConfigurationWithOptionalFallback<SWROptions>
  ): SWRResponse<DataOf<T, M>, unknown, SWROptions> {
    type D = DataOf<T, M>;
    const client = useClient();
    const key = resolveKey(client, backend.methodKey(method), method, arg);
    // A per-hook `fetcher` in the SWR config is honoured (handy for tests / stories), a global
    // `SWRConfig.fetcher` is not, since SWR only falls back to it when no fetcher is passed.
    const fetcher = (config as SWRConfiguration<D> | undefined)?.fetcher ?? fetcherFor<D>(client, method);
    // This non-null assertion is only to make the overloaded types happy.
    // In the runtime useSWR accepts config as undefined as usual
    return useSWR(key as SWRKey, fetcher, config!);
  }

  function useDataImmutable<M extends Method, SWROptions extends SWRConfiguration<DataOf<T, M>> = SWRConfiguration<DataOf<T, M>>>(
    method: M,
    arg: ArgInput<M>,
    config?: SWRConfigurationWithOptionalFallback<SWROptions>
  ): SWRResponse<DataOf<T, M>, unknown, SWROptions> {
    type D = DataOf<T, M>;
    const client = useClient();
    const key = resolveKey(client, backend.methodKey(method), method, arg);
    const fetcher = (config as SWRConfiguration<D> | undefined)?.fetcher ?? fetcherFor<D>(client, method);
    return useSWRImmutable(key as SWRKey, fetcher, config!);
  }

  // ---------- useInfinite ----------
  function useInfinite<M extends Method, SWROptions extends SWRInfiniteConfiguration<DataOf<T, M>> = SWRInfiniteConfiguration<DataOf<T, M>>>(
    method: M,
    getArg: TayoriInfiniteKeyLoader<DataOf<T, M>, ArgOf<T, M>>,
    config?: SWRInfiniteConfigurationWithOptionalFallback<SWROptions>
  ): SWRInfiniteResponse<DataOf<T, M>, unknown> {
    type D = DataOf<T, M>;
    const client = useClient();
    const methodKey = backend.methodKey(method);

    // The loader is passed to SWR as is, so SWR's own semantics apply: a falsy result stops loading
    // pages, and a throw (from the loader or while building the key) pauses the hook on the first
    // page but becomes the hook's `error` on later pages.
    const getSwrKey = brand(
      (pageIndex: number, previousPageData: D | null): Key | null => {
        const pageArg = getArg(pageIndex, previousPageData);
        return pageArg ? buildKey(client, methodKey, method, pageArg) : null;
      },
      backend.name
    );

    const fetcher = (config as SWRInfiniteConfiguration<D> | undefined)?.fetcher ?? fetcherFor<D>(client, method);
    return useSWRInfinite(getSwrKey as SWRInfiniteKeyLoader<D>, fetcher, config);
  }

  // ---------- useMutation ----------
  function useMutation<M extends Method>(method: M, options?: UseMutationOptions<DataOf<T, M>, unknown>) {
    type D = DataOf<T, M>;
    const onErrorFromHook = useStableHandler(options?.onError || noop);
    const onSuccessFromHook = useStableHandler(options?.onSuccess || noop);

    const populateCacheFromHook = options?.populateCache ?? false;

    const { mutate: swrMutate } = useSWRConfig();
    const client = useClient();

    // Every trigger() and reset() takes the next ticket. A mutation result is only applied if no
    // newer ticket has been issued in the meantime, so if trigger is called multiple times in a
    // short time (or reset() is called while a mutation is in flight), only the latest one is applied.
    //
    // A monotonic counter is used instead of a timestamp because two calls can happen in the same
    // millisecond, in which case a timestamp comparison would let a stale result through.
    const latestMutationTicketRef = useRef(0);

    const [snap, setState] = useStateWithDeps<{
      data: D | undefined,
      error: unknown | undefined
    }>({
      data: undefined,
      error: undefined
    });

    // Our trigger may be called within startTransition or <form action /> prop
    //
    // In that case, if we store `isMutating` as a state (no matter useState or useStateWithDeps),
    // React will always schedule that `isMutating` update after the transition (by the time
    // submission already finished), which makes `isMutating` always false during the mutation.
    //
    // So we can't store `isMutating` in a state. Instead we use `useTransition` to track async
    // function state. `isPending` is always urgent.
    //
    // But startTransition returns void instead of the promise, where ourselves can't track the
    // state anymore.
    // So we hoist promise variable and await twice, one for startTransition and one for the actual
    // promise result
    const [isMutating, startMutating] = useTransition();

    const trigger = useCallback(
      async (mutationArg: MutationArgOf<T, M>, triggerOptions?: UseMutationOptions<D, unknown>) => {
        const arg = mutationArg as Arg;
        const mutationTicket = ++latestMutationTicketRef.current;

        // Validate / identify the method BEFORE anything is sent (for tayori-connect this is where
        // non-unary methods are rejected)
        const methodKey = backend.methodKey(method);

        // We could have use swrMutate function here instead of calling the backend directly
        // But I don't want to work with optimisticData and rollbackOnError for now
        //
        // Because fundermentally there is a difference between useMutation and useSWRMutation,
        // where SWR excepts POST and GET use the same key, but we can't (POST and GET are different methods)
        //
        // So we just normally would not have the same key for useMutation and useData/useDataImmutable
        // (unless populateCache is enabled for special edge cases).
        //
        // SWR's `tags` option / `revalidateTag` cover flushing related entries after a mutation, which
        // still doesn't justify using swrMutate here.
        const promise = backend.call(client, method, arg) as Promise<D>;

        const handleSuccess = triggerOptions?.onSuccess || onSuccessFromHook;
        const handleError = triggerOptions?.onError || onErrorFromHook;

        const stringifiedSerializedKey = stableHash([methodKey, arg, triggerOptions]);

        // we await promise to ensure React can track the promise status
        startMutating(async () => {
          try {
            await promise;
          } catch {
            // ignore error in the transition
          }
        });

        try {
          // here we actually await and get the result
          const resultData = await promise;

          // We will always return current resultData for the trigger caller.
          //
          // But if it's reset after the mutation, we don't broadcast any state change
          if (latestMutationTicketRef.current === mutationTicket) {
            const shouldPopulateCache = triggerOptions?.populateCache ?? populateCacheFromHook;
            // resolveKey builds the exact same key useData/useDataImmutable would use for this arg.
            // A request that cannot be keyed has no useData slot to fill.
            const cacheKey = shouldPopulateCache ? resolveKey(client, methodKey, method, mutationArg) : null;
            if (cacheKey) {
              // revalidate:false writes the data without triggering a re-fetch.
              swrMutate<D>(
                cacheKey,
                resultData,
                {
                  // no matter if we pass the second argument as T, or Promise<T>, or (() => T | Promise<T>), SWR will
                  // always await it internally:
                  // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/_internal/utils/mutate.ts#L167
                  //
                  // In order for our cache to be written into store immediately, we pass our resultData
                  // as optimisticData to ensure the cache is populated immediately
                  //
                  // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/_internal/utils/mutate.ts#L149
                  optimisticData: resultData,

                  // By default, SWR will always re-fetch after mutation, even with optimisticData is provided,
                  // that is to update the cache with the latest data from the server.
                  //
                  // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/_internal/utils/mutate.ts#L104
                  //
                  // However, SWR is trying to support where POST/PUT/PATCH returns the updated data, in that case, SWR expects
                  // with populateCache as a function (re-construct POST/PUT/PATCH result into what GET request would return),
                  // and SWR will just skip re-fetching and directly write tranfomed mutation result into cache.
                  //
                  // In our case, we also want SWR to skip re-fetching, as we are restricting populateCache to only be for
                  // fetch on demand within effect/event handler.
                  //
                  // So we set this option to false, with populateCache as true (boolean), SWR will write second argument
                  // (in our case, resultData) into cache without re-fetching
                  //
                  // We may still face two re-render (one with optimisticData, and one with resultData skipping re-fetch),
                  // but the both data are identical, so final DOM will not change
                  revalidate: false,

                  // Ensure our cache is written. This is especially important when revalidation is set to false
                  populateCache: true

                  // we don't pass rollbackOnError here, because:
                  //
                  // 1. our resultData is already resolved
                  // 2. if we have faced any error during trigger, we would not have reach here in the first place
                }
              );
            }

            startTransition(() => {
              setState({
                data: resultData,
                error: undefined
              });
            });

            handleSuccess(resultData, stringifiedSerializedKey);
          }

          return resultData;
        } catch (e) {
          // If it's reset after the mutation, we don't broadcast any state change
          if (latestMutationTicketRef.current === mutationTicket) {
            startTransition(() => {
              setState({
                error: e
              });
            });

            // we are trying to re-use SWR's onError type, but we don't really have a key here
            // so let's generate one with stable-hash
            handleError(e, stringifiedSerializedKey);
          }

          // Unlike useSWRMutation, we always throw here.
          // Because instead of useSWRMutation's swrMutationOptions.throwOnError, I prefer explicit
          // try...catch... at the call site.
          throw e;
        }
      },
      [client, method, setState, onSuccessFromHook, onErrorFromHook, populateCacheFromHook, swrMutate]
    );

    const reset = useCallback(() => {
      latestMutationTicketRef.current++;
      setState({
        data: undefined,
        error: undefined
      });
    }, [setState]);

    return {
      trigger,
      reset,
      // Read through the tracked snapshot lazily so a property only becomes a
      // rendering dependency (and thus a re-render trigger) when the consumer
      // actually accesses it. Spreading `snap` would eagerly read every
      // property and defeat the re-render reduction.
      get data() {
        return snap.data;
      },
      get error() {
        return snap.error;
      },
      isMutating
    } as const;
  }

  // ---------- Preloading ----------
  function usePreload() {
    const client = useClient();

    return useCallback(<M extends Method>(method: M, preloadArg: ArgOf<T, M>) => {
      const key = resolveKey(client, backend.methodKey(method), method, preloadArg);
      if (!key) return;
      swrPreload(key as SWRKey, fetcherFor<Data>(client, method));
    }, [client]);
  }

  return {
    useData,
    useDataImmutable,
    useInfinite,
    useMutation,
    usePreload,
    TayoriProvider,
    useClient,
    /**
     * Build the exact SWR key a hook of this instance would use. Useful for manual `mutate()` calls.
     */
    getKey
  } as const;
}
