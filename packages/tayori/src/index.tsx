'use client';

import { useStableHandler } from 'foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired';
import { useStateWithDeps } from 'foxact/use-state-with-deps';
import { createContext, startTransition, use, useCallback, useRef, useTransition } from 'react';
import { stableHash } from 'stable-hash';

import type { SWRConfiguration, Key as SWRKey, Middleware as SWRMiddleware, SWRResponse } from 'swr';
import type { SWRInfiniteConfiguration, SWRInfiniteKeyLoader, SWRInfiniteResponse } from 'swr/infinite';

import useSWR, { mutate, SWRConfig, useSWRConfig } from 'swr';
import useSWRImmutable from 'swr/immutable';
import useSWRInfinite from 'swr/infinite';
import { nullthrow } from 'foxact/nullthrow';
import { useSingleton } from 'foxact/use-singleton';

import type { ZodError } from 'zod';
import type { Options as KyOptions } from 'ky';
import { noop } from 'foxact/noop';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this has to be any for TypeScript to proper infer type
type GeneralSdkMethod = (arg: any) => any;
type SdkReturn<SdkMethod extends GeneralSdkMethod> = Awaited<ReturnType<SdkMethod>>;
type SdkData<SdkMethod extends GeneralSdkMethod> =
  SdkReturn<SdkMethod> extends { data: infer D, request?: Request, response?: Response } ? NonNullable<D> : never;

type OriginalSdkArg<SdkMethod extends GeneralSdkMethod> = Omit<
  NonNullable<Parameters<SdkMethod>[0]>,
  'responseStyle' | 'throwOnError'
>;

export type TayoriSdkArg<SdkMethod extends GeneralSdkMethod> = OriginalSdkArg<SdkMethod> & {
  cacheTags?: Array<`#${string}`>
};

type InternalSWRKey<SdkArg = unknown> = [GeneralSdkMethod, SdkArg, cacheTags: Array<`#${string}`> | undefined];

// SWR doesn't export this type, so I just copy this from SWR impl
// This types ensures that if user indeed provides the "fallbackData"
// the "data" response will be non-nullable, vice versa, replicating
// SWR's types and runtime behavior regarding "fallbackData"
type SWRConfigurationWithOptionalFallback<SWROptions> = SWROptions extends SWRConfiguration
  & Required<Pick<SWRConfiguration, 'fallbackData'>>
  ? Omit<SWROptions, 'fallbackData'> & Pick<Partial<SWROptions>, 'fallbackData'>
  : SWROptions;
// Similar to above but for SWRInfiniteConfiguration
type SWRInfiniteConfigurationWithOptionalFallback<SWROptions> = SWROptions extends SWRInfiniteConfiguration
  & Required<Pick<SWRInfiniteConfiguration, 'fallbackData'>>
  ? Omit<SWROptions, 'fallbackData'> & Pick<Partial<SWROptions>, 'fallbackData'>
  : SWROptions;

interface HeyAPIClientLike {
  buildUrl: any,
  getConfig: any,
  request: any,
  setConfig: any
};

export interface TayoriProviderProps extends React.PropsWithChildren {
  /**
     * @example
     *
     * ```
     * initClient: () => createClient({
     *   throwOnError: true,
     *   credentials: 'include',
     *   kyOptions: {}
     * })
     * ```
     */
  initClient: () => HeyAPIClientLike
}

export interface UseMutationOptions<Data = any, Error = any> {
  onSuccess?: (
    data: Data,
    /**
     * A serialized key that is generated with stable-hash based on the mutation's sdk method and sdk arg. It has nothing
     * to do with SWR's key, and may be useful for generating unique identifiers for toast notifications.
     */
    unique_key_this_is_not_an_swr_key: string
  ) => void,
  onError?: (
    err: Error,
    /**
     * A serialized key that is generated with stable-hash based on the mutation's sdk method and sdk arg. It has nothing
     * to do with SWR's key, and may be useful for generating unique identifiers for toast notifications.
     */
    unique_key_this_is_not_an_swr_key: string
  ) => void,
  /**
   * Normally, you would fetch data with useData. And when you need to fetch data on demand, you can pass a fasly value
   * or a function that returns a falsy value as the sdkArg to useData(), which will pause the useData() from automatically
   * fetching.
   *
   * However, sometimes you might wanna fetch data on demand but in places like event handlers where you can't use useData().
   * Then you can use useMutation to fetch data on demand, which will only fetch when you call the trigger function.
   *
   * By default, useMutation won't cache the result, which makes sense because normally you would use useMutation for things
   * like POST/PUT/PATCH requests. But in the aforementioned scenario, you may wanna cache the result for later useData() calls.
   *
   * In this case, you can set `populateCache` to true, which will write the mutation result into the same SWR cache slot that useData/useDataImmutable
   */
  populateCache?: boolean
}

/**
 * Right now, tayori() is a a dummy function that simply returns an object with React hooks and components.
 *
 * The main purpose of tayori() is to accept and carry the generic type parameters that are used across
 * the hooks and components.
 *
 * tayori() does not accept any runtime parameters for the time being. Those should be passed to
 * TayoriProvider, where you can also inject parameters from within React tree, which is more flexible.
 *
 * @example
 *
 * ```ts
 * import { tayori } from 'tayori';
 * import type { Options } from 'path/to/hey-api-generated-sdk';
 * import type { RequestResult } from 'path/to/hey-api-generated-sdk/client';
 *
 * export const {
 *   useData,
 *   useInfinite,
 *   useMutation,
 *   TayoriProvider
 * } = tayori<Options, RequestResult>();
 * ```
 */
export function tayori<
  SDKOptions extends { client?: unknown, meta?: unknown, kyOptions?: unknown } = any,
  SDKRequestResult extends Promise<any> = Promise<{
    data: unknown,
    request: Request,
    response: Response
  }>
>() {
  // ---------- useData ----------
  /**
   * You should avoid using `useData()` directly in your codebase.
   * Instead, we recommend that you wrap your own hooks on top of `useData()` to abstract away,
   * and share SWR options across your app.
   *
   * @example
   *
   * ```ts
   * import { getData } from 'path/to/hey-api-generated-sdk';
   *
   * // You should do this first
   * function useGetData(search) { return useData(getData, { query: { search } }); }
   * // And only use wrapped hooks in your app.
   * ```
   *
   * When wrapping your own hooks on top of `useData()`, DO NOT spread the `useData()`'s return value
   * like `{ ...useData(...) }`, you are breaking tayori and SWR's re-render reduction optimization
   * (which is built on top of the getter). Instead, return `useData(...)` directly from your wrapper hook
   *
   * Here is how you can use `useData()`
   *
   * ```ts
   * useData(getData, {});
   * useData(getData, { query: {}, body: 'hey api request options goes here' });
   *
   * // use falsy value to pause the request
   * useData(getData, null);
   *
   * // you can pass sdkArg as an function that will return a sdkArg
   * // when this function throw or return a falsy value, the request will be paused
   * useData(getData, () => ({ query: {}, body: 'hey api request options goes here' }));
   *
   * // You can pass SWR options as the third argument
   * useData(getData, { query: {} }, { revalidateOnFocus: false });
   * ```
   */
  function useData<
    SdkMethod extends GeneralSdkMethod,
    SWROptions extends SWRConfiguration<SdkData<SdkMethod>> = SWRConfiguration<SdkData<SdkMethod>>
  >(
    sdkMethod: SdkMethod,
    sdkArg:
      | TayoriSdkArg<SdkMethod>
      | null
      | undefined
      | 0
      | false
      | (() => TayoriSdkArg<SdkMethod> | null | undefined | 0 | false),
    config?: SWRConfigurationWithOptionalFallback<SWROptions>
  ): SWRResponse<SdkData<SdkMethod>, unknown, SWROptions> {
    // This non-null assertion is only to make the overloaded types happy.
    // In the runtime useSWR accepts config as undefined as usual
    return useSWR(getSwrKeyFromSdkArg<SdkMethod, SDKOptions>(sdkMethod, sdkArg), null, config!);
  }

  // ---------- useDataImmutable ----------
  /**
   * Similar to useData, but it uses useSWRImmutable internally, which means the data will
   * never be revalidated or updated after the first fetch.
   */
  function useDataImmutable<
    SdkMethod extends GeneralSdkMethod,
    SWROptions extends SWRConfiguration<SdkData<SdkMethod>> = SWRConfiguration<SdkData<SdkMethod>>
  >(
    sdkMethod: SdkMethod,
    sdkArg:
      | TayoriSdkArg<SdkMethod>
      | null
      | undefined
      | 0
      | false
      | (() => TayoriSdkArg<SdkMethod> | null | undefined | 0 | false),
    config?: SWRConfigurationWithOptionalFallback<SWROptions>
  ): SWRResponse<SdkData<SdkMethod>, unknown, SWROptions> {
    // This non-null assertion is only to make the overloaded types happy.
    // In the runtime useSWR accepts config as undefined as usual
    return useSWRImmutable(getSwrKeyFromSdkArg<SdkMethod, SDKOptions>(sdkMethod, sdkArg), null, config!);
  }

  // ---------- useInfinite ----------
  /**
   * Similar to useData, but it uses useSWRInfinite internally, which means it's designed for infinite loading scenarios like "load more", infinite scroll, or pagination based on last page's data (like cursor)
   *
   * If your pagination is based on page number, you should just use `useData()`, pass page index and per page
   * count as request query parameters
   *
   * @example
   *
   * ```tsx
   * const { data, error, size, setSize } = useInfinite(getData, (pageIndex, previousPageData) => {
   *   if (previousPageData && !previousPageData.nextCursor) return null; // reached the end
   *   return {
   *     query: {
   *       cursor: previousPageData?.nextCursor,
   *       perPage: 10
   *     }
   *   }
   * });
   *
   * <div>You have loaded {size} pages</div>
   * <button onClick={() => setSize(size + 1)}>Load more</button>
   * ```
   */
  function useInfinite<
    SdkMethod extends GeneralSdkMethod,
    SWROptions extends SWRInfiniteConfiguration<SdkData<SdkMethod>> = SWRInfiniteConfiguration<SdkData<SdkMethod>>
  >(
    sdkMethod: SdkMethod,
    getSdkArg: SWRInfiniteKeyLoader<
      SdkData<SdkMethod>,
      TayoriSdkArg<SdkMethod> | null | undefined | false
    >,
    config?: SWRInfiniteConfigurationWithOptionalFallback<SWROptions>
  ): SWRInfiniteResponse<SdkData<SdkMethod>, unknown> {
    const getKey = withKUseDataSwrKey(
      (pageIndex: number, previousPageData: SdkData<SdkMethod> | null): InternalSWRKey<OriginalSdkArg<SdkMethod>> | null => {
        const result = getSdkArg(pageIndex, previousPageData);
        if (!result) {
          return null;
        }
        const { cacheTags, ...restSdkArg } = result;
        const _restSdkArg = restSdkArg as SDKOptions;
        return [sdkMethod, _restSdkArg, cacheTags] satisfies InternalSWRKey<OriginalSdkArg<SdkMethod>>;
      }
    );

    return useSWRInfinite(getKey, null, config);
  }

  // ---------- useMutation ----------
  /**
   * useMutation looks like useSWRMutation, but it doesn't really use useSWRMutation internally.
   *
   * It should be noted that by default "useMutation" WILL NOT flush other useSWR/useData hooks' cache.
   * You WILL HAVE TO call mutate() manually if you want to flush the cache after mutation.
   *
   * This is intentional. Imagine Hey API generated two SDK methods, `getData` & `updateData`,
   * two functions will have different identity and referential equality, so you won't get the
   * same SWR key, and you really can't get auto invalidation.
   *
   * @example
   *
   * ```tsx
   * import { updateData } from 'path/to/hey-api-generated-sdk';
   *
   * const { trigger } = useMutation(updateData, optionalTriggerOptions);
   *
   * <button
   *   onClick={() => trigger(
   *     { query: {}, body: 'hey api request options goes here' },
   *     optionalTriggerOptions
   *   )}
   * >
   *   Save
   * </button>
   * ```
   *
   * Special Note on useMutation + fetch on demand scenario:
   *
   * In most case, you should use `useData()` to fetch data on demand:
   *
   * ```tsx
   * // if `search` is falsy, useData will skip this request
   * useData(getData, search ? { query: { search } } : null);
   *
   * // if `otherData` is undefined, this function will throw, `useData()` also skip this request
   * useData(getData, () => ({ query: { otherData.search } }));
   *
   * // use button to manually start loading
   * const [shouldFetch, setShouldFetch] = useState(false);
   * useData(getData, shouldFetch ? { query: { search } } : null);
   * <button onClick={() => setShouldFetch(true)}>Begin Load!</button>
   * ```
   *
   * However, sometimes you might wanna trigger a fetch within an event handler, and you still
   * want the result to be accessible within your event handler. You can achieve this with
   * `useMutation()` like this:
   *
   * ```tsx
   * const { trigger } = useMutation(getData, { onSuccess(data) { toast.success(`Data loaded: ${data}`); } });
   *
   * <button
   *   onClick={async () => {
   *     const data = await trigger({});
   *     // do something else with data here
   *   }}
   * >
   *   Fetch Data
   * </button>
   * ```
   *
   * Now, imagine you also have another `useData(getData, {})` hook that is fetching the same data (maybe in
   * another page, or soon to be rendered component). Since `getData` SDK method is side-effect free, you may
   * want the other `useData(getData, {})` to re-use the same cache that your `useMutation(getData)` just
   * fetched.
   *
   * Here is the `populateCache` option comes in. By setting `populateCache` to true, after your mutation
   * successfully fetches the data, it will write the cache into SWR for other `useData(getData, {})` to re-use:
   *
   * ```tsx
   * const { trigger } = useMutation(getData, { populateCache: true });
   * // you can specify option inside trigger
   * trigger({}, { populateCache: true });
   *
   * // in othrt page
   * // this first loads instantly with the previously fetched cache, and may or may not start a revalidation
   * useData(getData, {});
   * ```
   */
  function useMutation<SdkMethod extends GeneralSdkMethod>(sdkMethod: SdkMethod, options?: UseMutationOptions<SdkData<SdkMethod>, unknown>) {
    const onErrorFromHook = useStableHandler(options?.onError || noop);
    const onSuccessFromHook = useStableHandler(options?.onSuccess || noop);

    const populateCacheFromHook = options?.populateCache ?? false;

    const { mutate: swrMutate } = useSWRConfig();
    const client = useSdkClient();

    // Ditch all mutation results that happened earlier than this timestamp.
    // So if trigger is called multiple times in a short time, only the latest one will be applied.
    const ditchMutationsUntilRef = useRef(0);

    const [stateRef, stateDependenciesRef, setState] = useStateWithDeps<{
      data: SdkData<SdkMethod> | undefined,
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
      async (sdkArg: TayoriSdkArg<SdkMethod>, triggerOptions?: UseMutationOptions<SdkData<SdkMethod>, unknown>) => {
        const mutationStartedAt = Date.now();
        ditchMutationsUntilRef.current = mutationStartedAt;

        // Strip cacheTags before forwarding to the SDK
        // We don't pass it to the SDK
        const { cacheTags: _unusedCacheTags, ...restSdkArg } = sdkArg;

        // We could have use swrMutate function here instead of calling sdkMethod directly
        // But I don't want to work with optimisticData and rollbackOnError for now
        //
        // Because fundermentally there is a difference between useMutation and useSWRMutation,
        // where SWR excepts POST and GET use the same key, but we can't (POST and GET are different SDK methods)
        //
        // So we just normally would not have the same key for useMutation and useData/useDataImmutable
        // (unless populateCache is enabled for special edge cases).
        //
        // In the future, we might be able to use `cacheTags` feature to automatically flush corresponding cache,
        // but that still doesn't justify using swrMutate here.
        const promise = sdkMethod({
          client,
          ...restSdkArg,
          // allows to be catched by SWR
          throwOnError: true,
          // https://github.com/hey-api/openapi-ts/issues/2319
          //
          // TLDR: currently Hey API's responseStyle setting is only runtime and
          // not reflected in typescript types, so we just force it to 'fields' here
          // to make sure the typescript types align with the runtime behavior
          responseStyle: 'fields'
        });

        const handleSuccess = triggerOptions?.onSuccess || onSuccessFromHook;
        const handleError = triggerOptions?.onError || onErrorFromHook;

        const stringifiedSerializedKey = stableHash([sdkMethod, sdkArg, triggerOptions]);

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
          const result: Awaited<SDKRequestResult> = await promise;
          const resultData = result.data as SdkData<SdkMethod>;

          // We will always return current resultData for the trigger caller.
          //
          // But if it's reset after the mutation, we don't broadcast any state change
          if (ditchMutationsUntilRef.current <= mutationStartedAt) {
            const shouldPopulateCache = triggerOptions?.populateCache ?? populateCacheFromHook;
            if (shouldPopulateCache) {
              // getSwrKeyFromSdkArg builds [sdkMethod, restSdkArg, cacheTags] —
              // the exact same key useData/useDataImmutable would use for this call.
              // revalidate:false writes the data without triggering a re-fetch.

              // We need to fill the cache with the same SWR key that useData/useDataImmutable uses
              // so we still use getSwrKeyFromSdkArg here to generate the key
              const cacheKey = getSwrKeyFromSdkArg<SdkMethod, SDKOptions>(sdkMethod, sdkArg);

              // `mutate` from useSWRConfig/global can't use SWR function key. That's because when supplied
              // with a function, `mutate` will treat this function as a key filter callback, not a SWR key:
              //
              // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/_internal/utils/mutate.ts#L72
              //
              // So, useSWRMutation pre-serializes the key internally:
              //
              // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/mutation/index.ts#L50
              // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/mutation/index.ts#L77-L78
              // https://github.com/vercel/swr/blob/46f3954a35c39771ba3dcc00af774e4002062418/src/_internal/utils/serialize.ts#L6
              //
              // However, there is a good news for us: currently, we do not allow useMutation to accept a function as sdkArg,
              // (only useData/useDataImmutable can accept a function as sdkArg). So getSwrKeyFromSdkArg will always return
              // a non-function value for us to use directly.
              //
              // Just to be noted that in case if we would to allow function form of sdkArg in useMutation in the future, we would
              // also need to serialize the key. The overload type of getSwrKeyFromSdkArg will ensure the type safety when we do that.

              if (typeof cacheKey === 'function') {
                // ensure cacheKey is not a function at typing level
                const _typecheck: never = cacheKey;
              } else {
                // we already know that cacheKey is not a function, but just in case we still add that runtime
                // guard, to prevent any potential SWR treating the cacheKey as a filter callback
                swrMutate<SdkData<SdkMethod>>(
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
          if (ditchMutationsUntilRef.current <= mutationStartedAt) {
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
      [client, sdkMethod, setState, onSuccessFromHook, onErrorFromHook, populateCacheFromHook, swrMutate]
    );

    const reset = useCallback(() => {
      ditchMutationsUntilRef.current = Date.now();
      setState({
        data: undefined,
        error: undefined
      });
    }, [setState]);

    return {
      trigger,
      reset,
      get data() {
        stateDependenciesRef.current.data = true;
        return stateRef.current.data;
      },
      get error() {
        stateDependenciesRef.current.error = true;
        return stateRef.current.error;
      },
      isMutating
    } as const;
  }

  // ---------- SWR Middleware and SWRConfig Provider ----------
  const fetchMiddleware: SWRMiddleware =
    (useSWRNext) => (key: SWRKey, customFetcher, config): SWRResponse => {
      if (!isInternalSWRKey(key)) {
        // Not from useData, fallback to default SWR behavior
        return useSWRNext(key, customFetcher, config);
      }

      const sdkClient = useSdkClient();

      const defaultFetcher = useCallback(
        async (key: InternalSWRKey<SDKOptions>) => {
          const [sdkMethod, sdkArg] = key;
          const result: Awaited<SDKRequestResult> = await sdkMethod({
            // default method options
            client: sdkClient,
            ...sdkArg,
            kyOptions: {
              ...(sdkArg.kyOptions as KyOptions | undefined),
              throwHttpErrors: true
            } satisfies KyOptions,
            // TODO: we might wanna use throwOnError: false once Hey API actually respects the option
            // see https://github.com/hey-api/openapi-ts/pull/3814
            throwOnError: true,
            // https://github.com/hey-api/openapi-ts/issues/2319
            //
            // TLDR: currently Hey API's responseStyle setting is only runtime and
            // not reflected in typescript types, so we just force it to 'fields' here
            // to make sure the typescript types align with the runtime behavior
            responseStyle: 'fields'
          });

          // Though we force responseStyle to 'fields' above to ensure the typescript types align with runtime behavior,
          // We only really need the "data", so we only return it.
          //
          // We could return more fields in the future if needed, like response, request, etc.
          return result.data;
        },
        [sdkClient]
      );

      const swr = useSWRNext(key, customFetcher ?? defaultFetcher, config);

      if (isZodError(swr.error)) {
        swr.error.cause ??= {
          key
        };
      }

      return swr;
    };

  // ---------- SDK Client Context and Provider ----------
  const SdkClientContext = createContext<HeyAPIClientLike | null>(null);

  function useSdkClient() {
    return nullthrow(use(SdkClientContext), '[tayori] useSdkClient must be used within a <SdkClientProvider />');
  }

  /**
   * You should wrap your app/routes with TayoriProvider and pass the Hey API client instance
   *
   * @example
   *
   * ```tsx
   * <TayoriProvider
   *   initClient={() => createClient({
   *     throwOnError: true,
   *   })}
   * >
   *   {your app/routes goes here}
   * </TayoriProvider>
   * ```
   *
   * Since TayoriProvider is within React tree, you can also inject parameters that are only available
   * within React tree, like authentication react hooks:
   *
   * ```tsx
   * const { getAccessTokenSilently } = useAuth0();
   *
   * <TayoriProvider
   *   initClient={() => createClient({
   *     throwOnError: true,
   *     kyOptions: {
   *       hooks: {
   *         beforeRequest: [
   *           async (request) => {
   *             const token = await getAccessTokenSilently();
   *             request.headers.set('Authorization', `Bearer ${token}`);
   *           }
   *         ]
   *       }
   *     }
   *   })}
   * >
   *   {your app/routes goes here}
   * </TayoriProvider>
   * ```
   */
  function TayoriProvider({ children, initClient }: TayoriProviderProps) {
    return (
      <SdkClientContext value={useSingleton(() => initClient()).current}>
        <SWRConfig
          value={{
            use: [fetchMiddleware],
            keepPreviousData: true
          }}
        >
          {children}
        </SWRConfig>
      </SdkClientContext>
    );
  }

  return { useData, useDataImmutable, useInfinite, TayoriProvider, useMutation };
}

const kUseDataSwrKey = Symbol('tayori SWR key');

function getSwrKeyFromSdkArg<SdkMethod extends GeneralSdkMethod, SDKOptions>(
  sdkMethod: SdkMethod,
  sdkArg: () => TayoriSdkArg<SdkMethod> | null | undefined | 0 | false
): (() => InternalSWRKey<SDKOptions> | null) & { [kUseDataSwrKey]: true };
function getSwrKeyFromSdkArg<SdkMethod extends GeneralSdkMethod, _SDKOptions>(
  sdkMethod: SdkMethod,
  sdkArg: null | undefined | 0 | false
): null;
function getSwrKeyFromSdkArg<SdkMethod extends GeneralSdkMethod, SDKOptions>(
  sdkMethod: SdkMethod,
  sdkArg: TayoriSdkArg<SdkMethod>
): InternalSWRKey<SDKOptions> & { [kUseDataSwrKey]: true };
function getSwrKeyFromSdkArg<SdkMethod extends GeneralSdkMethod, SDKOptions>(
  sdkMethod: SdkMethod,
  sdkArg:
    | TayoriSdkArg<SdkMethod>
    | null
    | undefined
    | 0
    | false
    | (() => TayoriSdkArg<SdkMethod> | null | undefined | 0 | false)
): InternalSWRKey<SDKOptions> | (() => InternalSWRKey<SDKOptions> | null) | null;
function getSwrKeyFromSdkArg<SdkMethod extends GeneralSdkMethod, SDKOptions>(
  sdkMethod: SdkMethod,
  sdkArg:
    | TayoriSdkArg<SdkMethod>
    | null
    | undefined
    | 0
    | false
    | (() => TayoriSdkArg<SdkMethod> | null | undefined | 0 | false)
): InternalSWRKey | (() => InternalSWRKey | null) | null {
  if (!sdkArg) return null;
  if (typeof sdkArg === 'function') {
    return withKUseDataSwrKey((): InternalSWRKey<SDKOptions> | null => {
      const result = sdkArg();
      if (!result) return null;
      const { cacheTags, ...restSdkArg } = result;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- our sdk arg is too complicated for omit to get proper types, so we just assert it as any here
      return [sdkMethod, restSdkArg as any, cacheTags];
    });
  }
  const { cacheTags, ...restSdkArg } = sdkArg;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- our sdk arg is too complicated for omit to get proper types, so we just assert it as any here
  return withKUseDataSwrKey<InternalSWRKey<SDKOptions>>([sdkMethod, restSdkArg as any, cacheTags]);
}

function withKUseDataSwrKey<T extends SWRKey>(key: T): T & { [kUseDataSwrKey]: true } {
  return Object.defineProperty(key, kUseDataSwrKey, {
    value: true,
    enumerable: false
  }) as T & { [kUseDataSwrKey]: true };
}

/**
 * This is an internal function for distinguishing SWR requests is either from useData
 * or other userland useSWR calls.
 *
 * If you also write your own SWR middleware, you can use this function to check if the SWR
 * request is from tayori or not.
 */
export function isInternalSWRKey(key: unknown): key is InternalSWRKey {
  return !!(key && (typeof key === 'function' || Array.isArray(key)) && kUseDataSwrKey in key && key[kUseDataSwrKey]);
}

/**
 * This is an internal function for distinguishing Zod errors that came from Hey API
 * client (by Hey API's request and response validation). This function uses duck typing.
 *
 * You can re-use this function as you wish, this might be useful when implementing your own
 * error handling logic.
 */
export function isZodError(e: unknown): e is ZodError {
  return e != null && typeof e === 'object' && 'issues' in e && Array.isArray(e.issues);
}

function mutateWithTags(cacheTags: Array<`#${string}`>) {
  return mutate((key) => {
    if (!isInternalSWRKey(key)) {
      return false;
    }
    const cacheTagsFromKey = key[2];
    if (!cacheTagsFromKey?.length) {
      return false;
    }
    return cacheTags.some((tag) => cacheTagsFromKey.includes(tag));
  });
}

export { mutateWithTags as unstable_mutateWithTags };
