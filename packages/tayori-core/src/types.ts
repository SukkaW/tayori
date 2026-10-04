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
 * A type-level function. `Apply<F, X>` evaluates `F['output']` with `F['input']` bound to `X`, so an
 * adapter can describe "the request type for a given method" without higher-kinded types:
 *
 * ```ts
 * interface ResponseOf extends TypeFn { readonly output: Awaited<ReturnType<this['input']>> }
 * type R = Apply<ResponseOf, () => Promise<number>>; // number
 * ```
 */
export interface TypeFn {
  readonly input: unknown,
  readonly output: unknown
}

export type Apply<F extends TypeFn, X> = (F & { readonly input: X })['output'];

/** A `TypeFn` that ignores its input, for backends whose request / response types do not depend on the method */
export interface ConstTypeFn<T> extends TypeFn {
  readonly output: T
}

/**
 * The types of a backend: the loose runtime types the `TayoriBackend` implementation works with,
 * plus the per-method types the hooks expose. Hooks are generic over the method they receive
 * (`M extends Method`) and type their request / response as `Apply<ArgOf, M>` / `Apply<DataOf, M>`,
 * so adapters do not need to re-declare every hook.
 */
export interface TayoriTypes {
  /** Every method the backend accepts, e.g. `(arg: any) => any` (Hey API) or `DescMethodUnary` (Connect) */
  readonly Method: unknown,
  /** Every request arg, what `TayoriBackend.argKey` / `TayoriBackend.call` receive. Includes tayori's `cacheTags`. */
  readonly Arg: unknown,
  /** Every response, what `TayoriBackend.call` resolves to */
  readonly Data: unknown,
  /** `Method` → the request arg of `useData` / `useDataImmutable` / `useInfinite` / `usePreload` for that method (a subtype of `Arg`) */
  readonly ArgOf: TypeFn,
  /** `Method` → the request arg of `useMutation().trigger()` for that method (a subtype of `Arg`) */
  readonly MutationArgOf: TypeFn,
  /** `Method` → the response of that method (a subtype of `Data`) */
  readonly DataOf: TypeFn
}

/** `TayoriTypes` for a backend whose request / response types are the same for every method */
export interface TayoriSimpleTypes<Method, Arg, Data> extends TayoriTypes {
  readonly Method: Method,
  readonly Arg: Arg,
  readonly Data: Data,
  readonly ArgOf: ConstTypeFn<Arg>,
  readonly MutationArgOf: ConstTypeFn<Arg>,
  readonly DataOf: ConstTypeFn<Data>
}

export type ArgOf<T extends TayoriTypes, M> = Apply<T['ArgOf'], M>;
export type MutationArgOf<T extends TayoriTypes, M> = Apply<T['MutationArgOf'], M>;
export type DataOf<T extends TayoriTypes, M> = Apply<T['DataOf'], M>;

/**
 * The contract a backend adapter implements. The runtime only needs `T['Method']`, `T['Arg']` and
 * `T['Data']`; the per-method members of `T` type the hooks `createTayori()` returns.
 *
 * An `Arg` describes one request completely (for Hey API the generated request options, for
 * Connect `{ message, headers, timeoutMs, ... }`), plus tayori's `cacheTags`.
 */
export interface TayoriBackend<T extends TayoriTypes = TayoriTypes, Client = unknown> {
  /**
   * Type-level only, never set at runtime: TypeScript cannot infer `T` back from `T['Method']` in
   * the method signatures below, so this phantom member is what lets `createTayori(backend)` pick up
   * the backend's `TayoriTypes` from a `TayoriBackend<T, Client>`-typed value.
   */
  readonly types?: T,
  /** Used in error messages and to tell keys of different backends apart, e.g. `'tayori'` */
  readonly name: string,
  /**
   * Slot 1 of the SWR key. Must be stable across renders and hashable by SWR
   * (Hey API: the SDK function itself; Connect: `${service.typeName}/${method.name}`).
   */
  methodKey(method: T['Method']): unknown,
  /**
   * Slot 2 of the SWR key, plus the `cacheTags` found in the arg (slot 3). `argKey` must be plain,
   * stable data that identifies the response: everything in the arg that can change what the server
   * answers (the request itself, headers, ...) and nothing that cannot (timeouts, callbacks, signals).
   */
  argKey(method: T['Method'], arg: T['Arg']): readonly [argKey: unknown, cacheTags: CacheTag[] | undefined],
  /**
   * Perform the request. Used both as the SWR fetcher and by `useMutation().trigger()`; `arg` is the
   * original (latest) arg of the hook, not the key.
   */
  call(client: Client, method: T['Method'], arg: T['Arg']): Promise<T['Data']>
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
