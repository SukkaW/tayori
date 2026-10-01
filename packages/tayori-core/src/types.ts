import type { SWRConfiguration } from 'swr';
import type { SWRInfiniteConfiguration } from 'swr/infinite';

/**
 * Values that pause a request when passed (or returned from a function) as the argument
 * of `useData` / `useDataImmutable` / `useInfinite`.
 */
export type Falsy = null | undefined | 0 | false;

export type CacheTag = `#${string}`;

/**
 * The SWR key tayori builds for every request, shared by all backends.
 *
 * - `client` is the backend client instance (Hey API client, Connect `Transport`, ...). SWR hashes
 *   objects by content but functions by identity, so two different client instances (e.g. two nested
 *   `<TayoriProvider />`) never share cache entries.
 * - `methodKey` identifies the method: the SDK function itself for Hey API, `"<service>/<method>"` for Connect.
 * - `argKey` is the (normalized) request argument.
 * - `cacheTags` are user-provided tags for `unstable_mutateWithTags`.
 */
export type TayoriKey<Client = unknown, MethodKey = unknown, ArgKey = unknown> = [
  client: Client,
  methodKey: MethodKey,
  argKey: ArgKey,
  cacheTags: CacheTag[] | undefined
];

/**
 * Same as SWR's `SWRInfiniteKeyLoader`, but returns the backend argument (or a falsy value to stop
 * loading more pages) instead of an SWR key.
 */
export type TayoriInfiniteKeyLoader<Data, Arg> = (pageIndex: number, previousPageData: Data | null) => Arg | Falsy;

/**
 * The contract a backend adapter implements. `tayori-core` is deliberately loosely typed here:
 * adapters expose their own precisely typed facades on top of `createTayori()`.
 *
 * An `Arg` describes one request completely (for Hey API the generated request options, for
 * Connect `{ message, headers, timeoutMs, ... }`), plus tayori's `cacheTags`.
 */
export interface TayoriBackend<Method = unknown, Arg = unknown, Data = unknown, Client = unknown> {
  /** Used in error messages and to tell keys of different backends apart, e.g. `'tayori'` */
  readonly name: string,
  /**
   * Slot 1 of the SWR key. Must be stable across renders and hashable by SWR
   * (Hey API: the SDK function itself; Connect: `${service.typeName}/${method.name}`).
   */
  methodKey(method: Method): unknown,
  /**
   * Slot 2 of the SWR key, plus the `cacheTags` found in the arg (slot 3). `argKey` must be plain,
   * stable data that identifies the response: everything in the arg that can change what the server
   * answers (the request itself, headers, ...) and nothing that cannot (timeouts, callbacks, signals).
   */
  argKey(method: Method, arg: Arg): readonly [argKey: unknown, cacheTags: CacheTag[] | undefined],
  /**
   * Perform the request. Used both as the SWR fetcher and by `useMutation().trigger()`; `arg` is the
   * original (latest) arg of the hook, not the key.
   */
  call(client: Client, method: Method, arg: Arg): Promise<Data>
  // Reserved extension point (not implemented yet): server streaming
  // stream?(client: Client, method: Method, arg: Arg): AsyncIterable<Data>
}

export interface TayoriProviderProps<Client> extends React.PropsWithChildren {
  /**
   * A function that creates the backend client. It only runs once per `<TayoriProvider />` instance.
   * Nest another `<TayoriProvider />` to use a different client for a subtree.
   */
  initClient: () => Client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- match SWR's own defaults for Data / Error
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

// SWR doesn't export this type, so I just copy this from SWR impl
// This types ensures that if user indeed provides the "fallbackData"
// the "data" response will be non-nullable, vice versa, replicating
// SWR's types and runtime behavior regarding "fallbackData"
export type SWRConfigurationWithOptionalFallback<SWROptions> = SWROptions extends SWRConfiguration
  & Required<Pick<SWRConfiguration, 'fallbackData'>>
  ? Omit<SWROptions, 'fallbackData'> & Pick<Partial<SWROptions>, 'fallbackData'>
  : SWROptions;
// Similar to above but for SWRInfiniteConfiguration
export type SWRInfiniteConfigurationWithOptionalFallback<SWROptions> = SWROptions extends SWRInfiniteConfiguration
  & Required<Pick<SWRInfiniteConfiguration, 'fallbackData'>>
  ? Omit<SWROptions, 'fallbackData'> & Pick<Partial<SWROptions>, 'fallbackData'>
  : SWROptions;
