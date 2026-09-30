'use client';

import type { DescMessage, DescMethodUnary, JsonValue, MessageInitShape, MessageShape } from '@bufbuild/protobuf';
import type { CallOptions, Transport } from '@connectrpc/connect';
import { useCallback } from 'react';
import type { SWRConfiguration, SWRResponse } from 'swr';
import type { SWRInfiniteConfiguration, SWRInfiniteKeyLoader, SWRInfiniteResponse } from 'swr/infinite';
import type {
  CacheTag,
  Falsy,
  SWRConfigurationWithOptionalFallback,
  SWRInfiniteConfigurationWithOptionalFallback,
  TayoriKey,
  UseMutationOptions
} from 'tayori-core';
import { createTayori, isTayoriKey, kTayoriKey } from 'tayori-core';

import type {
  TayoriConnectBackendOptions,
  TayoriConnectCallOptions,
  TayoriConnectMethodKey,
  TayoriConnectTriggerCallOptions
} from './backend';
import { createConnectBackend } from './backend';

export type { CacheTag, Falsy, UseMutationOptions } from 'tayori-core';
export type { TayoriConnectBackendOptions, TayoriConnectCallOptions, TayoriConnectMethodKey, TayoriConnectTriggerCallOptions } from './backend';

/**
 * tayori's own options for `useData` / `useDataImmutable` / `useInfinite` / `usePreload`. They are
 * passed together with SWR options in the same object.
 */
export interface TayoriConnectOptions extends TayoriConnectCallOptions {
  /**
   * Tags that can later be used to revalidate this request via `unstable_mutateWithTags`.
   * Tags are part of the SWR key.
   */
  cacheTags?: CacheTag[]
}

/**
 * Options for `useMutation()`: tayori's mutation options plus Connect's per-call options
 */
export interface TayoriConnectMutationOptions<Data> extends UseMutationOptions<Data, unknown>, TayoriConnectCallOptions {
  cacheTags?: CacheTag[]
}

/**
 * Options for `useMutation().trigger()`: everything `useMutation()` accepts, plus an `AbortSignal`
 * for this specific call. Trigger-level options win over hook-level ones, field by field.
 */
export interface TayoriConnectTriggerOptions<Data> extends TayoriConnectMutationOptions<Data>, Pick<CallOptions, 'signal'> {}

/**
 * The SWR key of a tayori-connect request: `[transport, "<service>/<method>", requestAsProtoJson, cacheTags]`
 */
export type TayoriConnectKey = TayoriKey<Transport, TayoriConnectMethodKey, JsonValue>;

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

interface SplitOptions {
  /** Whatever is left after removing tayori / Connect options: SWR options or `UseMutationOptions` */
  rest: unknown,
  cacheTags: CacheTag[] | undefined,
  callOptions: TayoriConnectTriggerCallOptions | undefined
}

/**
 * Split a hook options object into SWR / mutation options, tayori `cacheTags`, and Connect call options.
 * Only defined call options are kept, so that trigger-level options can be merged over hook-level ones.
 */
function split(options: (TayoriConnectOptions & Partial<TayoriConnectTriggerCallOptions>) | undefined): SplitOptions {
  if (!options) {
    return { rest: undefined, cacheTags: undefined, callOptions: undefined };
  }
  const { cacheTags, headers, timeoutMs, contextValues, onHeader, onTrailer, signal, ...rest } = options;

  let callOptions: TayoriConnectTriggerCallOptions | undefined;
  if (headers !== undefined) (callOptions ??= {}).headers = headers;
  if (timeoutMs !== undefined) (callOptions ??= {}).timeoutMs = timeoutMs;
  if (contextValues !== undefined) (callOptions ??= {}).contextValues = contextValues;
  if (onHeader !== undefined) (callOptions ??= {}).onHeader = onHeader;
  if (onTrailer !== undefined) (callOptions ??= {}).onTrailer = onTrailer;
  if (signal !== undefined) (callOptions ??= {}).signal = signal;

  return { rest, cacheTags, callOptions };
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
    input: MessageInitShape<I> | Falsy | (() => MessageInitShape<I> | Falsy),
    config?: SWRConfigurationWithOptionalFallback<SWROptions> & TayoriConnectOptions
  ): SWRResponse<MessageShape<O>, unknown, SWROptions> {
    const { rest, cacheTags, callOptions } = split(config);
    return core.useData<MessageShape<O>, SWROptions>(
      method,
      input,
      rest as SWRConfigurationWithOptionalFallback<SWROptions> | undefined,
      { cacheTags, callOptions }
    );
  }

  // ---------- useDataImmutable ----------
  function useDataImmutable<
    I extends DescMessage,
    O extends DescMessage,
    SWROptions extends SWRConfiguration<MessageShape<O>> = SWRConfiguration<MessageShape<O>>
  >(
    method: DescMethodUnary<I, O>,
    input: MessageInitShape<I> | Falsy | (() => MessageInitShape<I> | Falsy),
    config?: SWRConfigurationWithOptionalFallback<SWROptions> & TayoriConnectOptions
  ): SWRResponse<MessageShape<O>, unknown, SWROptions> {
    const { rest, cacheTags, callOptions } = split(config);
    return core.useDataImmutable<MessageShape<O>, SWROptions>(
      method,
      input,
      rest as SWRConfigurationWithOptionalFallback<SWROptions> | undefined,
      { cacheTags, callOptions }
    );
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
   *     pageToken: previousPageData?.nextPageToken,
   *     pageSize: 10
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
    getInput: SWRInfiniteKeyLoader<MessageShape<O>, MessageInitShape<I> | null | undefined | false>,
    config?: SWRInfiniteConfigurationWithOptionalFallback<SWROptions> & TayoriConnectOptions
  ): SWRInfiniteResponse<MessageShape<O>, unknown> {
    const { rest, cacheTags, callOptions } = split(config);
    return core.useInfinite<MessageShape<O>, SWROptions>(
      method,
      getInput,
      rest as SWRInfiniteConfigurationWithOptionalFallback<SWROptions> | undefined,
      { cacheTags, callOptions }
    );
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
   * <button onClick={() => trigger({ name: 'Mars' }, { headers: { 'x-request-id': id } })}>
   *   Save
   * </button>
   * ```
   */
  function useMutation<I extends DescMessage, O extends DescMessage>(
    method: DescMethodUnary<I, O>,
    options?: TayoriConnectMutationOptions<MessageShape<O>>
  ) {
    const { rest, cacheTags, callOptions } = split(options);
    const mutation = core.useMutation<MessageShape<O>>(method, {
      ...(rest as UseMutationOptions<MessageShape<O>, unknown> | undefined),
      cacheTags,
      callOptions
    });

    const coreTrigger = mutation.trigger;
    const trigger = useCallback(
      (input: MessageInitShape<I>, triggerOptions?: TayoriConnectTriggerOptions<MessageShape<O>>) => {
        const { rest: triggerRest, cacheTags: triggerCacheTags, callOptions: triggerCallOptions } = split(triggerOptions);
        return coreTrigger(input, {
          ...(triggerRest as UseMutationOptions<MessageShape<O>, unknown> | undefined),
          cacheTags: triggerCacheTags,
          callOptions: triggerCallOptions
        });
      },
      [coreTrigger]
    );

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
      input: MessageInitShape<I>,
      options?: TayoriConnectOptions
    ) {
      const { cacheTags, callOptions } = split(options);
      preload(method, input, { cacheTags, callOptions });
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
     * useData(ElizaService.method.say, { sentence: 'Hello' });
     *
     * // use falsy value to pause the request
     * useData(ElizaService.method.say, null);
     *
     * // you can pass the request as a function that returns the request message
     * // when this function throws or returns a falsy value, the request will be paused
     * useData(ElizaService.method.say, () => (name ? { sentence: `I am ${name}` } : null));
     *
     * // You can pass SWR options, cacheTags and Connect call options as the third argument
     * useData(ElizaService.method.say, { sentence: 'Hello' }, { revalidateOnFocus: false, headers: { 'x-foo': 'bar' } });
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
 * Whether the given SWR key (or SWR key function) was created by tayori-connect. Useful in your
 * own SWR middlewares. Note that SWR hands middlewares the raw key, which is a function when the
 * hook was called with a function argument, so check `Array.isArray(key)` before indexing into it.
 */
export function isTayoriConnectKey(key: unknown): key is TayoriConnectKey | (() => TayoriConnectKey | null) {
  return isTayoriKey(key) && key[kTayoriKey].backend === 'tayori-connect';
}

export { unstable_mutateWithTags, unstable_useMutateWithTags } from 'tayori-core';
