import type { CacheTag, TayoriBackend, TayoriKey, TayoriSimpleTypes } from './types';

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
 * Non-enumerable property on `useInfinite` page keys carrying the arg the page was built from.
 * SWR-infinite rebuilds every page key right before fetching it and hands the fetcher that very
 * array, so the arg is always the latest one.
 */
export const kTayoriArg: unique symbol = Symbol.for('tayori.arg');

/**
 * Identifies the backend / `createTayori()` instance a key belongs to. Stored under `kTayoriKey`.
 */
export interface TayoriInstanceToken {
  readonly backend: string
}

export interface TayoriKeyBrand {
  readonly [kTayoriKey]: TayoriInstanceToken,
  readonly [kTayoriKeyError]?: unknown,
  readonly [kTayoriArg]?: unknown
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
 * Attach the arg a (page) key was built from, for fetchers that only receive the key.
 */
export function withKeyArg<K extends object, Arg>(key: K, arg: Arg): K {
  Object.defineProperty(key, kTayoriArg, {
    value: arg,
    enumerable: false
  });
  return key;
}

export function getKeyArg<Arg>(key: object): Arg | undefined {
  return (key as TayoriKeyBrand)[kTayoriArg] as Arg | undefined;
}

/**
 * Build one SWR key array: `[client, methodKey, argKey, cacheTags]`.
 *
 * This is THE key layout, shared by `useData`, `useDataImmutable`, `useInfinite` (per page),
 * `usePreload` and `useMutation`'s `populateCache`. Errors thrown by `backend.argKey` are
 * captured into the key (see `kTayoriKeyError`) rather than thrown. Hooks that build their key
 * eagerly rethrow them at render (`buildKeyOrThrow`); `useInfinite`, whose loader SWR calls
 * lazily, lets its fetcher rethrow them so they surface through SWR's `error`.
 */
export function buildKey<Method, Arg, Client>(
  token: TayoriInstanceToken,
  backend: Pick<TayoriBackend<TayoriSimpleTypes<Method, Arg, unknown>, Client>, 'argKey'>,
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

/**
 * `buildKey` for hooks that build their key during render: a key that could not be built is a
 * deterministic configuration error, so it is thrown right away instead of being handed to SWR
 * (which would retry it forever).
 */
export function buildKeyOrThrow<Method, Arg, Client>(
  token: TayoriInstanceToken,
  backend: Pick<TayoriBackend<TayoriSimpleTypes<Method, Arg, unknown>, Client>, 'argKey'>,
  client: Client,
  method: Method,
  methodKey: unknown,
  arg: Arg
): BrandedTayoriKey<Client> {
  const key = buildKey(token, backend, client, method, methodKey, arg);
  const keyError = getKeyError(key);
  if (keyError.hasError) {
    throw keyError.error as Error;
  }
  return key;
}
