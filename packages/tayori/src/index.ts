'use client';

import type { BrandedTayoriKeyLoader, CacheTag, TayoriKey, TayoriProviderProps as CoreTayoriProviderProps } from 'tayori-core';
import { createTayori, isTayoriKey, kTayoriKey } from 'tayori-core';

import type { DefaultSdkRequestResult, GeneralSdkMethod, GeneralSdkOptions, GeneralSdkRequestResult, HeyAPIClientLike } from './backend';
import { createHeyApiBackend, HEY_API_BACKEND_NAME } from './backend';

export type { UseMutationOptions } from 'tayori-core';
export type {
  GeneralSdkMethod,
  HeyAPIClientLike,
  HeyApiBackend,
  HeyApiSdkArg,
  HeyApiSdkData,
  HeyApiTypes,
  SdkData,
  TayoriSdkArg
} from './backend';

type InternalSWRKey<SdkArg = unknown> = TayoriKey<HeyAPIClientLike, GeneralSdkMethod, SdkArg>;

export interface TayoriProviderProps extends CoreTayoriProviderProps<HeyAPIClientLike> {
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
  /**
   * The `Options` type of your generated SDK: what every SDK function accepts (and what tayori spreads
   * `client`, `throwOnError` and `responseStyle` into).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the default must accept every generated SDK
  SDKOptions extends GeneralSdkOptions = any,
  /**
   * The `RequestResult` type of your generated client: what every SDK function resolves to. Hey API
   * resolves it conditionally from `throwOnError` / `responseStyle` and it differs between client
   * plugins and versions, so it cannot be inferred from an SDK function. tayori reads `.data` from it.
   */
  SDKRequestResult extends GeneralSdkRequestResult = DefaultSdkRequestResult
>() {
  const core = createTayori(createHeyApiBackend<SDKOptions, SDKRequestResult>());

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
    useData: core.useData,
    /**
     * @see https://tayori.skk.moe
     *
     * @example
     *
     * ```ts
     * const preload = usePreload();
     *
     * <Link onMouseEnter={() => preload(getData, { query: {} })} />
     * ```
     */
    usePreload: core.usePreload,
    /**
     * @see https://tayori.skk.moe
     */
    useDataImmutable: core.useDataImmutable,
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
     *   };
     * });
     *
     * <div>You have loaded {size} pages</div>
     * <button onClick={() => setSize(size + 1)}>Load more</button>
     * ```
     */
    useInfinite: core.useInfinite,
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
     * import { updateData } from 'path/to/hey-api-generated-sdk';
     *
     * const { trigger, isMutating } = useMutation(updateData, optionalTriggerOptions);
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
    useMutation: core.useMutation
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
  return isTayoriKey(key) && key[kTayoriKey].backend === HEY_API_BACKEND_NAME;
}

export { unstable_mutateWithTags, unstable_useMutateWithTags } from 'tayori-core';
export type { CacheTag };

export { isZodError } from './_is-zod-error';
