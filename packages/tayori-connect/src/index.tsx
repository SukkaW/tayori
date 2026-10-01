'use client';

import type { DescMessage, DescMethodUnary, MessageInitShape, MessageShape } from '@bufbuild/protobuf';
import type { Transport } from '@connectrpc/connect';
import type { SWRConfiguration, SWRResponse } from 'swr';
import type { SWRInfiniteConfiguration, SWRInfiniteKeyLoader, SWRInfiniteResponse } from 'swr/infinite';
import type {
  BrandedTayoriKeyLoader,
  Falsy,
  SWRConfigurationWithOptionalFallback,
  SWRInfiniteConfigurationWithOptionalFallback,
  TayoriKey,
  UseMutationOptions
} from 'tayori-core';
import { createTayori, isTayoriKey, kTayoriKey } from 'tayori-core';

import type {
  TayoriConnectArgKey,
  TayoriConnectBackendOptions,
  TayoriConnectMethodKey,
  TayoriConnectMutationRequest,
  TayoriConnectRequest
} from './backend';
import { createConnectBackend } from './backend';

export type { CacheTag, Falsy, UseMutationOptions } from 'tayori-core';
export type {
  TayoriConnectArgKey,
  TayoriConnectBackendOptions,
  TayoriConnectCallOptions,
  TayoriConnectMethodKey,
  TayoriConnectMutationRequest,
  TayoriConnectRequest
} from './backend';

/**
 * The SWR key of a tayori-connect request: `[transport, "<service>/<method>", { message, headers? }, cacheTags]`
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
export function tayoriConnect(options?: TayoriConnectBackendOptions) {
  const core = createTayori(createConnectBackend(options));

  // ---------- useData ----------
  function useData<
    I extends DescMessage,
    O extends DescMessage,
    SWROptions extends SWRConfiguration<MessageShape<O>> = SWRConfiguration<MessageShape<O>>
  >(
    method: DescMethodUnary<I, O>,
    request: TayoriConnectRequest<I> | Falsy | (() => TayoriConnectRequest<I> | Falsy),
    config?: SWRConfigurationWithOptionalFallback<SWROptions>
  ): SWRResponse<MessageShape<O>, unknown, SWROptions> {
    return core.useData<MessageShape<O>, SWROptions>(method, request, config);
  }

  // ---------- useDataImmutable ----------
  function useDataImmutable<
    I extends DescMessage,
    O extends DescMessage,
    SWROptions extends SWRConfiguration<MessageShape<O>> = SWRConfiguration<MessageShape<O>>
  >(
    method: DescMethodUnary<I, O>,
    request: TayoriConnectRequest<I> | Falsy | (() => TayoriConnectRequest<I> | Falsy),
    config?: SWRConfigurationWithOptionalFallback<SWROptions>
  ): SWRResponse<MessageShape<O>, unknown, SWROptions> {
    return core.useDataImmutable<MessageShape<O>, SWROptions>(method, request, config);
  }

  // ---------- useInfinite ----------
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
  function useInfinite<
    I extends DescMessage,
    O extends DescMessage,
    SWROptions extends SWRInfiniteConfiguration<MessageShape<O>> = SWRInfiniteConfiguration<MessageShape<O>>
  >(
    method: DescMethodUnary<I, O>,
    getRequest: SWRInfiniteKeyLoader<MessageShape<O>, TayoriConnectRequest<I> | null | undefined | false>,
    config?: SWRInfiniteConfigurationWithOptionalFallback<SWROptions>
  ): SWRInfiniteResponse<MessageShape<O>, unknown> {
    return core.useInfinite<MessageShape<O>, SWROptions>(method, getRequest, config);
  }

  // ---------- useMutation ----------
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
  function useMutation<I extends DescMessage, O extends DescMessage>(
    method: DescMethodUnary<I, O>,
    options?: UseMutationOptions<MessageShape<O>, unknown>
  ) {
    const mutation = core.useMutation<MessageShape<O>>(method, options);
    // Narrow the request type to this method's input message (an assignment, not an assertion)
    const trigger: (
      request: TayoriConnectMutationRequest<I>,
      triggerOptions?: UseMutationOptions<MessageShape<O>, unknown>
    ) => Promise<MessageShape<O>> = mutation.trigger;

    return {
      trigger,
      reset: mutation.reset,
      // Read through the tracked snapshot lazily so a property only becomes a
      // rendering dependency (and thus a re-render trigger) when the consumer
      // actually accesses it. Spreading would eagerly read every
      // property and defeat the re-render reduction.
      get data() {
        return mutation.data;
      },
      get error() {
        return mutation.error;
      },
      isMutating: mutation.isMutating
    } as const;
  }

  // ---------- Preloading ----------
  /**
   * @see https://tayori.skk.moe/connect
   */
  function usePreload() {
    const preload = core.usePreload();

    return function preloadMethod<I extends DescMessage, O extends DescMessage>(
      method: DescMethodUnary<I, O>,
      request: TayoriConnectRequest<I>
    ) {
      preload(method, request);
    };
  }

  // ---------- Provider ----------
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
    useData,
    /**
     * @see https://tayori.skk.moe/connect
     */
    useDataImmutable,
    /**
     * @see https://tayori.skk.moe/connect
     */
    useInfinite,
    /**
     * @see https://tayori.skk.moe/connect
     */
    useMutation,
    /**
     * @see https://tayori.skk.moe/connect
     */
    usePreload,
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
  return isTayoriKey(key) && key[kTayoriKey].backend === 'tayori-connect';
}

export { unstable_mutateWithTags, unstable_useMutateWithTags } from 'tayori-core';
