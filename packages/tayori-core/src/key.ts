import type { TayoriKey } from './types';

/**
 * Brand attached (as a non-enumerable property) to every SWR key array and `useInfinite` key loader
 * created by tayori. Its value is the name of the backend that created the key. SWR never hashes it
 * (`stableHash` only visits array indices), it only lets `isTayoriKey` recognize tayori keys.
 *
 * `Symbol.for` is used on purpose: if a bundle ends up with two copies of `tayori-core`
 * (dual package hazard, mismatched versions), they still recognize each other's keys.
 */
export const kTayoriKey: unique symbol = Symbol.for('tayori.key');

export interface TayoriKeyBrand {
  readonly [kTayoriKey]: string
}

export type BrandedTayoriKey<Client = unknown, MethodKey = unknown, ArgKey = unknown> =
  TayoriKey<Client, MethodKey, ArgKey> & TayoriKeyBrand;
/**
 * The branded key loader `useInfinite` hands to SWR. SWR middlewares see it as the "key".
 */
export type BrandedTayoriKeyLoader<Client = unknown, MethodKey = unknown, ArgKey = unknown> =
  ((...args: never[]) => BrandedTayoriKey<Client, MethodKey, ArgKey> | null) & TayoriKeyBrand;

export function brand<T extends object>(target: T, backendName: string): T & TayoriKeyBrand {
  Object.defineProperty(target, kTayoriKey, {
    value: backendName,
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
    && typeof (key as Partial<TayoriKeyBrand>)[kTayoriKey] === 'string';
}
