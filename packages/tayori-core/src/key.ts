import type { CacheTag, TayoriBackend, TayoriKey } from './types';

/**
 * Brand attached (as a non-enumerable property) to every SWR key array and `useInfinite` key loader
 * created by tayori.
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
/**
 * The branded key loader `useInfinite` hands to SWR. SWR middlewares see it as the "key".
 */
export type BrandedTayoriKeyLoader<Client = unknown, MethodKey = unknown, ArgKey = unknown> =
  ((...args: never[]) => BrandedTayoriKey<Client, MethodKey, ArgKey> | null) & TayoriKeyBrand;

export function brand<T extends object>(target: T, token: TayoriInstanceToken): T & TayoriKeyBrand {
  Object.defineProperty(target, kTayoriKey, {
    value: token,
    enumerable: false
  });
  return target as T & TayoriKeyBrand;
}

/**
 * Whether the given SWR key (or `useInfinite` key loader) was created by tayori, no matter which
 * backend (`tayori`, `tayori-connect`, ...) or which `createTayori()` instance created it.
 *
 * If you write your own SWR middleware, you can use this function to check if the SWR
 * request is from tayori or not. Note that SWR hands middlewares the raw key, which is the
 * (branded) key loader function for `useInfinite`, so check `Array.isArray(key)` before indexing.
 */
export function isTayoriKey(key: unknown): key is BrandedTayoriKey | BrandedTayoriKeyLoader {
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
 * Build one SWR key array: `[client, methodKey, argKey, cacheTags]`.
 *
 * This is THE key layout, shared by `useData`, `useDataImmutable`, `useInfinite` (per page),
 * `usePreload` and `useMutation`'s `populateCache`. Errors thrown by `backend.argKey` are
 * captured into the key (see `kTayoriKeyError`) rather than thrown, so that they surface the
 * same way for every hook, including `useInfinite` whose loader SWR calls lazily.
 */
export function buildKey<Method, Arg, Client>(
  token: TayoriInstanceToken,
  backend: Pick<TayoriBackend<Method, Arg, unknown, Client>, 'argKey'>,
  client: Client,
  method: Method,
  methodKey: unknown,
  arg: Arg
): BrandedTayoriKey<Client> {
  try {
    const [argKey, cacheTags] = backend.argKey(method, arg);
    const key: TayoriKey<Client> = [client, methodKey, argKey, cacheTags];
    return brand(key, token);
  } catch (error) {
    // A stable, distinct slot 2 so that SWR still hashes the key, plus the actual error for the fetcher
    // eslint-disable-next-line sukka/prefer-foxts-error-util -- foxts is not a dependency of tayori-core
    const key: TayoriKey<Client> = [client, methodKey, { tayoriKeyError: String(error) }, undefined];
    Object.defineProperty(key, kTayoriKeyError, {
      value: error,
      enumerable: false
    });
    return brand(key, token);
  }
}
