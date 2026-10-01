'use client';

import type { SWRConfiguration, SWRResponse } from 'swr';
import type { SWRInfiniteConfiguration, SWRInfiniteKeyLoader, SWRInfiniteResponse } from 'swr/infinite';
import type {
  BrandedTayoriKeyLoader,
  CacheTag,
  SWRConfigurationWithOptionalFallback,
  SWRInfiniteConfigurationWithOptionalFallback,
  TayoriKey,
  UseMutationOptions
} from 'tayori-core';
import { createTayori, isTayoriKey, kTayoriKey } from 'tayori-core';

import type { GeneralSdkMethod, HeyAPIClientLike } from './backend';
import { heyApiBackend } from './backend';

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

type InternalSWRKey<SdkArg = unknown> = TayoriKey<HeyAPIClientLike, GeneralSdkMethod, SdkArg>;

export interface TayoriProviderProps extends React.PropsWithChildren {
  /**
   * @example
   *
   * ```
   * initClient: () => createClient({
   *   throwOnError: true,
   *   auth() { return getAccessTokenSilently() },
   * })
   * ```
   */
  initClient: () => HeyAPIClientLike
}

export type { UseMutationOptions } from 'tayori-core';

/**
 * @see https://tayori.skk.moe
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
  // Both generics are kept for backward compatibility of the public signature. Each hook infers
  // its request / response types from the SDK method it receives, so they are not used.
  _SDKOptions extends { client?: unknown } = any,
  _SDKRequestResult extends Promise<any> = Promise<{
    data: unknown,
    request: Request,
    response: Response
  }>
>() {
  const core = createTayori(heyApiBackend);

  // ---------- useData ----------
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
    return core.useData<SdkData<SdkMethod>, SWROptions>(sdkMethod, sdkArg, config);
  }

  // ---------- useDataImmutable ----------
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
    return core.useDataImmutable<SdkData<SdkMethod>, SWROptions>(sdkMethod, sdkArg, config);
  }

  // ---------- useInfinite ----------
  /**
   * @see https://tayori.skk.moe
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
    return core.useInfinite<SdkData<SdkMethod>, SWROptions>(sdkMethod, getSdkArg, config);
  }

  // ---------- useMutation ----------
  /**
   * @see https://tayori.skk.moe
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
   */
  function useMutation<SdkMethod extends GeneralSdkMethod>(sdkMethod: SdkMethod, options?: UseMutationOptions<SdkData<SdkMethod>, unknown>) {
    return core.useMutation<SdkData<SdkMethod>, TayoriSdkArg<SdkMethod>>(sdkMethod, options);
  }

  // ---------- Preloading ----------
  /**
   * @see https://tayori.skk.moe
   */
  function usePreload() {
    const preload = core.usePreload();

    return function preloadSdkMethod<SdkMethod extends GeneralSdkMethod>(sdkMethod: SdkMethod, sdkArg: TayoriSdkArg<SdkMethod>) {
      preload(sdkMethod, sdkArg);
    };
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
  const TayoriProvider: (props: TayoriProviderProps) => React.JSX.Element = core.TayoriProvider;

  return {
    /**
     * @see https://tayori.skk.moe
     *
     * @example
     *
     * ```ts
     * import { getData } from 'path/to/hey-api-generated-sdk';
     *
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
    useData,
    /**
     * @see https://tayori.skk.moe
     */
    usePreload,
    /**
     * @see https://tayori.skk.moe
     */
    useDataImmutable,
    /**
     * @see https://tayori.skk.moe
     *
     * @example
     *
     * ```tsx
     * const { data, error, size, setSize } = useInfinite(getData, (pageIndex, previousPageData) => {
     *   if (previousPageData && !previousPageData.nextCursor) return null;
     *   return {
     *     query: {
     *       cursor: previousPageData?.nextCursor,
     *       perPage: 10
     *     }
     *   };
     * });
     * ```
     */
    useInfinite,
    /**
     * You should wrap your app/routes with TayoriProvider and pass the Hey API client instance.
     *
     * @see https://tayori.skk.moe
     */
    TayoriProvider,
    /**
     * Returns the Hey API client of the nearest `<TayoriProvider />`. The client is slot 0 of every
     * SWR key (`[client, sdkMethod, sdkArg, cacheTags]`), so you need it to build a key by hand
     * for `mutate()` or `SWRConfig`'s `fallback`.
     */
    useClient: core.useClient,
    /**
     * @see https://tayori.skk.moe
     *
     * @example
     *
     * ```tsx
     * const { trigger } = useMutation(updateData);
     *
     * await trigger({
     *   query: {},
     *   body: 'hey api request options goes here'
     * });
     * ```
     */
    useMutation
  } as const;
}

/**
 * This is an internal function for distinguishing SWR requests is either from useData
 * or other userland useSWR calls.
 *
 * If you also write your own SWR middleware, you can use this function to check if the SWR
 * request is from tayori or not.
 *
 * Note that the key layout is `[client, sdkMethod, sdkArg, cacheTags]` (it was `[sdkMethod, sdkArg, cacheTags]`
 * before 0.4.0), and that SWR hands middlewares the raw key, which for `useInfinite` is the branded
 * `(pageIndex, previousPageData) => key` loader, so check `Array.isArray(key)` before indexing into it.
 */
export function isInternalSWRKey(key: unknown): key is InternalSWRKey | BrandedTayoriKeyLoader<HeyAPIClientLike, GeneralSdkMethod> {
  return isTayoriKey(key) && key[kTayoriKey].backend === heyApiBackend.name;
}

export { unstable_mutateWithTags, unstable_useMutateWithTags } from 'tayori-core';
export type { CacheTag };

export { isZodError } from './_is-zod-error';
