'use client';

import type { Transport } from '@connectrpc/connect';
import type { BrandedTayoriKeyLoader, TayoriKey } from 'tayori-core';
import { createTayori, isTayoriKey, kTayoriKey } from 'tayori-core';

import type { TayoriConnectMethodKey, TayoriConnectRequest } from './backend';
import { createConnectBackend } from './backend';

export type { CacheTag, Falsy, UseMutationOptions } from 'tayori-core';
export type {
  MethodInput,
  MethodOutput,
  TayoriConnectBackend,
  TayoriConnectCallOptions,
  TayoriConnectMethodKey,
  TayoriConnectMutationRequest,
  TayoriConnectRequest,
  TayoriConnectTypes
} from './backend';

/**
 * Slot 2 of a tayori-connect SWR key: the request itself without `cacheTags`, with the message
 * created (`create()`) and the headers as a plain record with lower-cased names.
 */
export type TayoriConnectArgKey = Omit<TayoriConnectRequest, 'cacheTags'>;

/**
 * The SWR key of a tayori-connect request: `[transport, "<service>/<method>", request, cacheTags]`
 */
export type TayoriConnectKey = TayoriKey<Transport, TayoriConnectMethodKey, TayoriConnectArgKey>;

export interface TayoriConnectProviderProps extends React.PropsWithChildren {
  /**
   * A function that creates the Connect `Transport`, e.g. `createConnectTransport()` from
   * `@connectrpc/connect-web`. It only runs once per `<TayoriProvider />` instance.
   *
   * Nest another `<TayoriProvider />` to use a different transport for a subtree. The transport
   * is part of every SWR key, so different transports never share cache entries.
   *
   * @example
   *
   * ```tsx
   * <TayoriProvider
   *   initTransport={() => createConnectTransport({
   *     baseUrl: 'https://demo.connectrpc.com',
   *     interceptors: [authInterceptor]
   *   })}
   * >
   *   {your app/routes goes here}
   * </TayoriProvider>
   * ```
   */
  initTransport: () => Transport
}

/**
 * @see https://tayori.skk.moe/connect
 *
 * @example
 *
 * ```ts
 * import { tayoriConnect } from 'tayori-connect';
 *
 * export const {
 *   useData,
 *   useInfinite,
 *   useMutation,
 *   TayoriProvider
 * } = tayoriConnect();
 * ```
 */
export function tayoriConnect() {
  const core = createTayori(createConnectBackend());

  const CoreProvider = core.TayoriProvider;

  /**
   * You should wrap your app/routes with TayoriProvider and pass a function that creates the Connect transport.
   *
   * @see https://tayori.skk.moe/connect
   */
  function TayoriProvider({ children, initTransport }: TayoriConnectProviderProps) {
    return (
      <CoreProvider initClient={initTransport}>
        {children}
      </CoreProvider>
    );
  }

  return {
    /**
     * @see https://tayori.skk.moe/connect
     *
     * @example
     *
     * ```ts
     * import { ElizaService } from 'path/to/gen/connectrpc/eliza/v1/eliza_pb';
     *
     * useData(ElizaService.method.say, { message: { sentence: 'Hello' } });
     *
     * // use falsy value to pause the request
     * useData(ElizaService.method.say, null);
     *
     * // you can pass the request as a function that returns the request
     * // when this function throws or returns a falsy value, the request will be paused
     * useData(ElizaService.method.say, () => (name ? { message: { sentence: `I am ${name}` } } : null));
     *
     * // Connect call options and cacheTags live in the request, SWR options go third
     * useData(
     *   ElizaService.method.say,
     *   { message: { sentence: 'Hello' }, headers: { 'x-foo': 'bar' }, cacheTags: ['#eliza'] },
     *   { revalidateOnFocus: false }
     * );
     * ```
     */
    useData: core.useData,
    /**
     * @see https://tayori.skk.moe/connect
     */
    useDataImmutable: core.useDataImmutable,
    /**
     * @see https://tayori.skk.moe/connect
     *
     * @example
     *
     * ```tsx
     * const { data, error, size, setSize } = useInfinite(PlanetService.method.listPlanets, (pageIndex, previousPageData) => {
     *   if (previousPageData && !previousPageData.nextPageToken) return null; // reached the end
     *   return {
     *     message: {
     *       pageToken: previousPageData?.nextPageToken,
     *       pageSize: 10
     *     }
     *   };
     * });
     * ```
     */
    useInfinite: core.useInfinite,
    /**
     * @see https://tayori.skk.moe/connect
     *
     * @example
     *
     * ```tsx
     * const { trigger, isMutating } = useMutation(PlanetService.method.createPlanet);
     *
     * <button onClick={() => trigger({ message: { name: 'Mars' }, headers: { 'x-request-id': id } })}>
     *   Save
     * </button>
     * ```
     */
    useMutation: core.useMutation,
    /**
     * @see https://tayori.skk.moe/connect
     *
     * @example
     *
     * ```tsx
     * const preload = usePreload();
     *
     * <Link onMouseEnter={() => preload(ElizaService.method.say, { message: { sentence: 'Hello' } })} />
     * ```
     */
    usePreload: core.usePreload,
    /**
     * You should wrap your app/routes with TayoriProvider and pass a function that creates the Connect transport.
     *
     * @see https://tayori.skk.moe/connect
     */
    TayoriProvider,
    /**
     * Returns the Connect `Transport` of the nearest `<TayoriProvider />`, e.g. to create a
     * Connect `createClient()` for streaming methods that tayori-connect does not support yet.
     */
    useTransport: core.useClient
  } as const;
}

/**
 * Whether the given SWR key (or `useInfinite` key loader) was created by tayori-connect. Useful in
 * your own SWR middlewares. Note that SWR hands middlewares the raw key, which is the key loader
 * function for `useInfinite`, so check `Array.isArray(key)` before indexing into it.
 */
export function isTayoriConnectKey(key: unknown): key is TayoriConnectKey | BrandedTayoriKeyLoader<Transport, TayoriConnectMethodKey, TayoriConnectArgKey> {
  return isTayoriKey(key) && key[kTayoriKey] === 'tayori-connect';
}

export { unstable_mutateWithTags, unstable_useMutateWithTags } from 'tayori-core';
