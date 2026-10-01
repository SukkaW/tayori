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

import type { BrandedTayoriKey, TayoriInstanceToken } from './key';
import { brand, buildKeyArray, getKey, getKeyError } from './key';
import type {
  Falsy,
  SWRConfigurationWithOptionalFallback,
  SWRInfiniteConfigurationWithOptionalFallback,
  TayoriBackend,
  TayoriFetchOptions,
  TayoriInfiniteKeyLoader,
  TayoriProviderProps,
  UseMutationOptions
} from './types';

export type {
  BrandedTayoriKey,
  BrandedTayoriKeyThunk,
  TayoriInstanceToken,
  TayoriKeyBrand
} from './key';
export { isTayoriKey, kTayoriKey, kTayoriKeyError } from './key';
export type {
  CacheTag,
  Falsy,
  SWRConfigurationWithOptionalFallback,
  SWRInfiniteConfigurationWithOptionalFallback,
  TayoriBackend,
  TayoriFetchOptions,
  TayoriInfiniteKeyLoader,
  TayoriKey,
  TayoriKeyThunk,
  TayoriProviderProps,
  UseMutationOptions
} from './types';
export { mutateWithTags as unstable_mutateWithTags, useMutateWithTags as unstable_useMutateWithTags } from './mutate-with-tags';

/**
 * Create the tayori hooks + provider for a backend. This is what `tayori` (Hey API) and
 * `tayori-connect` (ConnectRPC) call under the hood. Each call creates an isolated instance with
 * its own React context and its own key brand, so multiple instances (even of different backends)
 * can be nested in the same React tree.
 *
 * Every hook passes its own SWR fetcher, a closure over the method descriptor and the hook's latest
 * call options, so no SWR middleware is involved: a global `SWRConfig.fetcher` never applies to
 * tayori keys, while user middlewares that wrap the fetcher keep working.
 *
 * The hooks returned here are loosely typed on purpose. Adapters wrap them with precisely typed
 * facades for their backend.
 */
export function createTayori<Method, Arg, Data, Client extends object, CallOptions = never>(
  backend: TayoriBackend<Method, Arg, Data, Client, CallOptions>
) {
  type Key = BrandedTayoriKey<Client>;
  type Options = TayoriFetchOptions<CallOptions>;
  type MutationOptions<D> = UseMutationOptions<D, unknown> & Options;

  const token: TayoriInstanceToken = { backend: backend.name };

  // ---------- Client Context and Provider ----------
  const ClientContext = createContext<Client | null>(null);

  function useClient(): Client {
    return nullthrow(use(ClientContext), `[${backend.name}] hooks must be used within <TayoriProvider />`);
  }

  function TayoriProvider({ children, initClient }: TayoriProviderProps<Client>) {
    return (
      <ClientContext value={useSingleton(() => initClient()).current}>
        {children}
      </ClientContext>
    );
  }

  // ---------- Keys and Fetchers ----------
  /**
   * Build the exact SWR key a hook of this instance would use for `method` + `arg`.
   */
  function buildKey(client: Client, method: Method, arg: Arg | Falsy | (() => Arg | Falsy), options: Options | undefined) {
    return getKey(token, backend, client, method, backend.methodKey(method), arg, options?.cacheTags);
  }

  /**
   * The SWR fetcher of one hook. It closes over the method and the hook's current call options;
   * SWR refreshes the fetcher it holds on every render, so revalidations always use the latest ones.
   */
  function createFetcher(method: Method, callOptions: CallOptions | undefined) {
    return async (key: Key): Promise<Data> => {
      const keyError = getKeyError(key);
      if (keyError.hasError) {
        // building the key failed (e.g. backend.argKey could not serialize the request)
        throw keyError.error as Error;
      }
      return backend.fetch(key[0], method, key[2], callOptions);
    };
  }

  // ---------- useData / useDataImmutable ----------
  // `D` is the response type the adapter facade infers for a given method (a subtype of the
  // backend's `Data`). The runtime does not care about it, adapters decide what it is.
  function useData<D extends Data = Data, SWROptions extends SWRConfiguration<D> = SWRConfiguration<D>>(
    method: Method,
    arg: Arg | Falsy | (() => Arg | Falsy),
    config?: SWRConfigurationWithOptionalFallback<SWROptions>,
    options?: Options
  ): SWRResponse<D, unknown, SWROptions> {
    const client = useClient();
    // A per-hook `fetcher` in the SWR config is honoured (handy for tests / stories), a global
    // `SWRConfig.fetcher` is not, since SWR only falls back to it when no fetcher is passed.
    const fetcher = (config as SWRConfiguration<D> | undefined)?.fetcher ?? (createFetcher(method, options?.callOptions) as BareFetcher<D>);
    // This non-null assertion is only to make the overloaded types happy.
    // In the runtime useSWR accepts config as undefined as usual
    return useSWR(buildKey(client, method, arg, options) as SWRKey, fetcher, config!);
  }

  function useDataImmutable<D extends Data = Data, SWROptions extends SWRConfiguration<D> = SWRConfiguration<D>>(
    method: Method,
    arg: Arg | Falsy | (() => Arg | Falsy),
    config?: SWRConfigurationWithOptionalFallback<SWROptions>,
    options?: Options
  ): SWRResponse<D, unknown, SWROptions> {
    const client = useClient();
    const fetcher = (config as SWRConfiguration<D> | undefined)?.fetcher ?? (createFetcher(method, options?.callOptions) as BareFetcher<D>);
    return useSWRImmutable(buildKey(client, method, arg, options) as SWRKey, fetcher, config!);
  }

  // ---------- useInfinite ----------
  function useInfinite<D extends Data = Data, SWROptions extends SWRInfiniteConfiguration<D> = SWRInfiniteConfiguration<D>>(
    method: Method,
    getArg: TayoriInfiniteKeyLoader<D, Arg>,
    config?: SWRInfiniteConfigurationWithOptionalFallback<SWROptions>,
    options?: Options
  ): SWRInfiniteResponse<D, unknown> {
    const client = useClient();
    const methodKey = backend.methodKey(method);

    // Following SWR's semantics, a loader that throws or returns a falsy value stops loading pages.
    const getSwrKey = brand(
      (pageIndex: number, previousPageData: D | null): Key | null => {
        const result = getArg(pageIndex, previousPageData);
        if (!result) {
          return null;
        }
        return buildKeyArray(token, backend, client, method, methodKey, result, options?.cacheTags);
      },
      token
    );

    const fetcher = (config as SWRInfiniteConfiguration<D> | undefined)?.fetcher ?? (createFetcher(method, options?.callOptions) as BareFetcher<D>);
    return useSWRInfinite(getSwrKey as SWRInfiniteKeyLoader<D>, fetcher, config);
  }

  // ---------- useMutation ----------
  function useMutation<D extends Data = Data>(method: Method, options?: MutationOptions<D>) {
    const onErrorFromHook = useStableHandler(options?.onError || noop);
    const onSuccessFromHook = useStableHandler(options?.onSuccess || noop);

    // Hook-level options are read through a stable getter inside `trigger` (an event handler), so
    // that inline option objects (`{ headers: {...} }`, `cacheTags: ['#a']`) don't give `trigger`
    // a new identity every render.
    const getHookOptions = useStableHandler(() => ({
      populateCache: options?.populateCache ?? false,
      cacheTags: options?.cacheTags,
      callOptions: options?.callOptions
    }));

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
      async (arg: Arg, triggerOptions?: MutationOptions<D>) => {
        const mutationTicket = ++latestMutationTicketRef.current;

        // Validate / identify the method BEFORE anything is sent (for tayori-connect this is where
        // non-unary methods are rejected)
        const methodKey = backend.methodKey(method);

        const hookOptions = getHookOptions();
        const callOptions = mergeCallOptions(hookOptions.callOptions, triggerOptions?.callOptions);

        // We could have use swrMutate function here instead of calling the backend directly
        // But I don't want to work with optimisticData and rollbackOnError for now
        //
        // Because fundermentally there is a difference between useMutation and useSWRMutation,
        // where SWR excepts POST and GET use the same key, but we can't (POST and GET are different methods)
        //
        // So we just normally would not have the same key for useMutation and useData/useDataImmutable
        // (unless populateCache is enabled for special edge cases).
        //
        // In the future, we might be able to use `cacheTags` feature to automatically flush corresponding cache,
        // but that still doesn't justify using swrMutate here.
        const promise = backend.call(client, method, arg, callOptions) as Promise<D>;

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
            const shouldPopulateCache = triggerOptions?.populateCache ?? hookOptions.populateCache;
            if (shouldPopulateCache) {
              // buildKey builds [client, methodKey, argKey, cacheTags] —
              // the exact same key useData/useDataImmutable would use for this call.
              // revalidate:false writes the data without triggering a re-fetch.
              const cacheKey = buildKey(client, method, arg, {
                cacheTags: triggerOptions?.cacheTags ?? hookOptions.cacheTags,
                callOptions
              });

              // `mutate` from useSWRConfig/global can't use SWR function key. That's because when supplied
              // with a function, `mutate` will treat this function as a key filter callback, not a SWR key:
              //
              // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/_internal/utils/mutate.ts#L72
              //
              // useMutation doesn't accept a function as arg (only useData/useDataImmutable do), so buildKey
              // always returns a non-function value here. The runtime guard below is just in case.
              if (cacheKey && typeof cacheKey !== 'function') {
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
      [client, method, setState, onSuccessFromHook, onErrorFromHook, getHookOptions, swrMutate]
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

    return useCallback((method: Method, arg: Arg, options?: Options) => {
      const key = buildKey(client, method, arg, options);
      if (key) {
        swrPreload(key as SWRKey, createFetcher(method, options?.callOptions) as BareFetcher<Data>);
      }
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
    getKey: buildKey
  } as const;
}

function mergeCallOptions<CallOptions>(fromHook: CallOptions | undefined, fromTrigger: CallOptions | undefined): CallOptions | undefined {
  if (fromHook === undefined) return fromTrigger;
  if (fromTrigger === undefined) return fromHook;
  if (typeof fromHook === 'object' && typeof fromTrigger === 'object' && fromHook !== null && fromTrigger !== null) {
    return { ...fromHook, ...fromTrigger };
  }
  return fromTrigger;
}
