import type { CacheTag, Falsy, TayoriBackend, TayoriFetchOptions, TayoriKey, TayoriKeyThunk } from './types';

/**
 * Brand attached (as a non-enumerable property) to every SWR key and key function created by tayori.
 *
 * `Symbol.for` is used on purpose: if a bundle ends up with two copies of `tayori-core`
 * (dual package hazard, mismatched versions), they still recognize each other's keys.
 */
export const kTayoriKey: unique symbol = Symbol.for('tayori.key');
/**
 * Backend specific per-call options riding along the key (non-enumerable, so not part of the SWR hash).
 */
export const kTayoriCallOptions: unique symbol = Symbol.for('tayori.callOptions');

/**
 * Identifies a `createTayori()` instance. Stored under `kTayoriKey`.
 */
export interface TayoriInstanceToken {
  readonly backend: string
}

export interface TayoriKeyBrand<CallOptions = unknown> {
  readonly [kTayoriKey]: TayoriInstanceToken,
  readonly [kTayoriCallOptions]?: CallOptions
}

export type BrandedTayoriKey<Client = unknown, MethodKey = unknown, ArgKey = unknown, CallOptions = unknown> =
  TayoriKey<Client, MethodKey, ArgKey> & TayoriKeyBrand<CallOptions>;
export type BrandedTayoriKeyThunk<Client = unknown, MethodKey = unknown, ArgKey = unknown, CallOptions = unknown> =
  (() => BrandedTayoriKey<Client, MethodKey, ArgKey, CallOptions> | null) & TayoriKeyBrand<CallOptions>;

export function brand<T extends object, CallOptions>(target: T, token: TayoriInstanceToken, callOptions: CallOptions | undefined): T & TayoriKeyBrand<CallOptions> {
  Object.defineProperty(target, kTayoriKey, {
    value: token,
    enumerable: false
  });
  if (callOptions !== undefined) {
    Object.defineProperty(target, kTayoriCallOptions, {
      value: callOptions,
      enumerable: false
    });
  }
  return target as T & TayoriKeyBrand<CallOptions>;
}

/**
 * Whether the given SWR key (or SWR key function) was created by tayori, no matter which
 * backend (`tayori`, `tayori-connect`, ...) or which `createTayori()` instance created it.
 *
 * If you write your own SWR middleware, you can use this function to check if the SWR
 * request is from tayori or not.
 */
export function isTayoriKey(key: unknown): key is BrandedTayoriKey | BrandedTayoriKeyThunk {
  return !!key
    && (typeof key === 'function' || Array.isArray(key))
    && kTayoriKey in key
    && !!(key as Partial<TayoriKeyBrand>)[kTayoriKey];
}

/**
 * Build the SWR key for a request.
 *
 * - falsy `arg` pauses the request (`null` key)
 * - a function `arg` becomes a branded SWR key function, whose results are branded too (so
 *   `mutate(filter)`, which sees the resolved key, still recognizes them)
 * - anything else becomes a branded key array
 */
export function getKey<Method, Arg, Client, CallOptions>(
  token: TayoriInstanceToken,
  backend: Pick<TayoriBackend<Method, Arg, unknown, Client, CallOptions>, 'methodKey' | 'argKey'>,
  client: Client,
  method: Method,
  arg: Arg | Falsy | (() => Arg | Falsy),
  options: TayoriFetchOptions<CallOptions> | undefined
): BrandedTayoriKey<Client, unknown, unknown, CallOptions> | BrandedTayoriKeyThunk<Client, unknown, unknown, CallOptions> | null {
  if (!arg) return null;

  const methodKey = backend.methodKey(method);
  const callOptions = options?.callOptions;

  const build = (resolvedArg: Arg) => {
    const [argKey, cacheTagsFromArg] = backend.argKey(method, resolvedArg);
    const cacheTags: CacheTag[] | undefined = options?.cacheTags ?? cacheTagsFromArg;
    const key: TayoriKey<Client> = [client, methodKey, argKey, cacheTags];
    return brand(key, token, callOptions);
  };

  if (typeof arg === 'function') {
    const thunk: TayoriKeyThunk<Client> = () => {
      const resolvedArg = (arg as () => Arg | Falsy)();
      if (!resolvedArg) return null;
      return build(resolvedArg);
    };
    return brand(thunk, token, callOptions) as BrandedTayoriKeyThunk<Client, unknown, unknown, CallOptions>;
  }

  return build(arg);
}
