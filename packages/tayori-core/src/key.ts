import type { CacheTag, Falsy, TayoriBackend, TayoriKey, TayoriKeyThunk } from './types';

/**
 * Brand attached (as a non-enumerable property) to every SWR key and key function created by tayori.
 *
 * `Symbol.for` is used on purpose: if a bundle ends up with two copies of `tayori-core`
 * (dual package hazard, mismatched versions), they still recognize each other's keys.
 */
export const kTayoriKey: unique symbol = Symbol.for('tayori.key');

/**
 * Non-enumerable property carrying an error thrown while building the key (e.g. by `backend.argKey`).
 * The hook's fetcher rethrows it, so the error surfaces through SWR's `error` instead of SWR
 * silently treating a throwing key function as "not ready".
 */
export const kTayoriKeyError: unique symbol = Symbol.for('tayori.keyError');

/**
 * Identifies the backend / `createTayori()` instance a key belongs to. Stored under `kTayoriKey`.
 */
export interface TayoriInstanceToken {
  readonly backend: string
}

export interface TayoriKeyBrand {
  readonly [kTayoriKey]: TayoriInstanceToken,
  readonly [kTayoriKeyError]?: unknown
}

export type BrandedTayoriKey<Client = unknown, MethodKey = unknown, ArgKey = unknown> =
  TayoriKey<Client, MethodKey, ArgKey> & TayoriKeyBrand;
export type BrandedTayoriKeyThunk<Client = unknown, MethodKey = unknown, ArgKey = unknown> =
  (() => BrandedTayoriKey<Client, MethodKey, ArgKey> | null) & TayoriKeyBrand;

export function brand<T extends object>(target: T, token: TayoriInstanceToken): T & TayoriKeyBrand {
  Object.defineProperty(target, kTayoriKey, {
    value: token,
    enumerable: false
  });
  return target as T & TayoriKeyBrand;
}

/**
 * Whether the given SWR key (or SWR key function) was created by tayori, no matter which
 * backend (`tayori`, `tayori-connect`, ...) or which `createTayori()` instance created it.
 *
 * If you write your own SWR middleware, you can use this function to check if the SWR
 * request is from tayori or not. Note that SWR hands middlewares the raw key, which is a
 * function when the hook was called with a function argument.
 */
export function isTayoriKey(key: unknown): key is BrandedTayoriKey | BrandedTayoriKeyThunk {
  return !!key
    && (typeof key === 'function' || Array.isArray(key))
    && kTayoriKey in key
    && !!(key as Partial<TayoriKeyBrand>)[kTayoriKey];
}

/**
 * Whether the key carries an error captured while it was built. The hook's fetcher rethrows it.
 */
export function getKeyError(key: object): { hasError: true, error: unknown } | { hasError: false } {
  if (kTayoriKeyError in key) {
    return { hasError: true, error: (key as TayoriKeyBrand)[kTayoriKeyError] };
  }
  return { hasError: false };
}

/**
 * Build one resolved SWR key array: `[client, methodKey, argKey, cacheTags]`.
 *
 * This is THE key layout, shared by `useData`, `useDataImmutable`, `useInfinite` (per page),
 * `usePreload` and `useMutation`'s `populateCache`. Errors thrown by `backend.argKey` are
 * captured into the key (see `kTayoriKeyError`) rather than thrown, so that they surface the
 * same way for object arguments, function arguments and infinite loaders.
 */
export function buildKeyArray<Method, Arg, Client>(
  token: TayoriInstanceToken,
  backend: Pick<TayoriBackend<Method, Arg, unknown, Client, unknown>, 'argKey'>,
  client: Client,
  method: Method,
  methodKey: unknown,
  arg: Arg,
  cacheTagsFromOptions: CacheTag[] | undefined
): BrandedTayoriKey<Client> {
  try {
    const [argKey, cacheTagsFromArg] = backend.argKey(method, arg);
    const key: TayoriKey<Client> = [client, methodKey, argKey, cacheTagsFromOptions ?? cacheTagsFromArg];
    return brand(key, token);
  } catch (error) {
    // A stable, distinct slot 2 so that SWR still hashes the key, plus the actual error for the fetcher
    // eslint-disable-next-line sukka/prefer-foxts-error-util -- foxts is not a dependency of tayori-core
    const key: TayoriKey<Client> = [client, methodKey, { tayoriKeyError: String(error) }, cacheTagsFromOptions];
    Object.defineProperty(key, kTayoriKeyError, {
      value: error,
      enumerable: false
    });
    return brand(key, token);
  }
}

/**
 * Build the SWR key for a request.
 *
 * - falsy `arg` pauses the request (`null` key)
 * - a function `arg` becomes a branded SWR key function, whose results are branded too (so
 *   `mutate(filter)`, which sees the resolved key, still recognizes them). Following SWR's
 *   semantics, a function that throws or returns a falsy value pauses the request.
 * - anything else becomes a branded key array
 */
export function getKey<Method, Arg, Client>(
  token: TayoriInstanceToken,
  backend: Pick<TayoriBackend<Method, Arg, unknown, Client, unknown>, 'argKey'>,
  client: Client,
  method: Method,
  methodKey: unknown,
  arg: Arg | Falsy | (() => Arg | Falsy),
  cacheTagsFromOptions: CacheTag[] | undefined
): BrandedTayoriKey<Client> | BrandedTayoriKeyThunk<Client> | null {
  if (!arg) return null;

  if (typeof arg === 'function') {
    const thunk: TayoriKeyThunk<Client> = () => {
      const resolvedArg = (arg as () => Arg | Falsy)();
      if (!resolvedArg) return null;
      return buildKeyArray(token, backend, client, method, methodKey, resolvedArg, cacheTagsFromOptions);
    };
    return brand(thunk, token) as BrandedTayoriKeyThunk<Client>;
  }

  return buildKeyArray(token, backend, client, method, methodKey, arg, cacheTagsFromOptions);
}
