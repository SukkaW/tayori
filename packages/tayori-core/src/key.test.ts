import { describe, it } from 'mocha';
import { expect } from 'earl';
import { unstable_serialize } from 'swr';

import { brand, buildKeyArray, getKey, getKeyError, isTayoriKey, kTayoriKey, kTayoriKeyError } from './key';
import type { TayoriInstanceToken } from './key';
import type { TayoriBackend } from './types';

const token: TayoriInstanceToken = { backend: 'test' };
/** Copy a (branded) key into a plain array so that earl compares only the enumerable slots */
const plain = (key: unknown) => Array.from(key as Iterable<unknown>);
const client = { name: 'client' };

const backend: Pick<TayoriBackend<string, { id: number, cacheTags?: Array<`#${string}`> }, unknown, typeof client, { header: string }>, 'argKey'> = {
  argKey(_method, { cacheTags, ...rest }) {
    return [rest, cacheTags];
  }
};

describe('getKey', () => {
  it('returns null for falsy args', () => {
    expect(getKey(token, backend, client, 'Get', 'svc/Get', null, undefined)).toEqual(null);
    expect(getKey(token, backend, client, 'Get', 'svc/Get', undefined, undefined)).toEqual(null);
    expect(getKey(token, backend, client, 'Get', 'svc/Get', false, undefined)).toEqual(null);
    expect(getKey(token, backend, client, 'Get', 'svc/Get', 0, undefined)).toEqual(null);
  });

  it('builds a branded [client, methodKey, argKey, cacheTags] array', () => {
    const key = getKey(token, backend, client, 'Get', 'svc/Get', { id: 1, cacheTags: ['#a'] }, undefined);

    expect(Array.isArray(key)).toEqual(true);
    expect(plain(key)).toEqual([client, 'svc/Get', { id: 1 }, ['#a']]);
    expect(isTayoriKey(key)).toEqual(true);
    expect((key as NonNullable<typeof key>)[kTayoriKey]).toExactlyEqual(token);
    // the brand is non-enumerable and never affects SWR's hash
    expect(Object.keys(key as object)).toEqual(['0', '1', '2', '3']);
    expect(unstable_serialize(key as never)).toEqual(unstable_serialize([client, 'svc/Get', { id: 1 }, ['#a']]));
  });

  it('prefers the cacheTags passed by the hook options over arg-level cacheTags', () => {
    const key = getKey(token, backend, client, 'Get', 'svc/Get', { id: 1, cacheTags: ['#a'] }, ['#b']);
    expect(plain(key)).toEqual([client, 'svc/Get', { id: 1 }, ['#b']]);
  });

  it('brands both the key function and the arrays it returns', () => {
    const thunk = getKey(token, backend, client, 'Get', 'svc/Get', () => ({ id: 2 }), undefined);

    expect(typeof thunk).toEqual('function');
    expect(isTayoriKey(thunk)).toEqual(true);

    const resolved = (thunk as () => unknown)();
    expect(plain(resolved)).toEqual([client, 'svc/Get', { id: 2 }, undefined]);
    expect(isTayoriKey(resolved)).toEqual(true);
  });

  it('key function returns null when the arg function returns a falsy value', () => {
    const thunk = getKey(token, backend, client, 'Get', 'svc/Get', () => null, undefined) as () => unknown;
    expect(thunk()).toEqual(null);
  });

  it('different clients produce different SWR hashes, same client the same hash', () => {
    const otherClient = { name: 'other' };
    const a = getKey(token, backend, client, 'Get', 'svc/Get', { id: 1 }, undefined);
    const b = getKey(token, backend, client, 'Get', 'svc/Get', { id: 1 }, undefined);
    const c = getKey(token, backend, otherClient, 'Get', 'svc/Get', { id: 1 }, undefined);

    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(c as never));
  });
});

describe('buildKeyArray', () => {
  const failing: typeof backend = {
    argKey() {
      throw new Error('cannot serialize');
    }
  };

  it('captures errors thrown by backend.argKey into the key instead of throwing', () => {
    const key = buildKeyArray(token, failing, client, 'Get', 'svc/Get', { id: 1 }, ['#a']);

    expect(isTayoriKey(key)).toEqual(true);
    expect(plain(key)).toEqual([client, 'svc/Get', { tayoriKeyError: 'Error: cannot serialize' }, ['#a']]);
    const keyError = getKeyError(key);
    expect(keyError.hasError).toEqual(true);
    expect(key[kTayoriKeyError]).toBeA(Error);
    expect(keyError.hasError && (keyError.error as Error).message).toEqual('cannot serialize');
    // the captured error is hidden from SWR's hash, the message-bearing slot keeps the hash stable
    expect(Object.keys(key)).toEqual(['0', '1', '2', '3']);
    expect(unstable_serialize(key as never)).toEqual(unstable_serialize(buildKeyArray(token, failing, client, 'Get', 'svc/Get', { id: 1 }, ['#a']) as never));
  });

  it('marks healthy keys as error-free', () => {
    const key = buildKeyArray(token, backend, client, 'Get', 'svc/Get', { id: 1 }, undefined);
    expect(getKeyError(key)).toEqual({ hasError: false });
  });
});

describe('isTayoriKey', () => {
  it('rejects foreign keys', () => {
    expect(isTayoriKey(null)).toEqual(false);
    expect(isTayoriKey('foo')).toEqual(false);
    expect(isTayoriKey(['foo', 1])).toEqual(false);
    expect(isTayoriKey(() => 'foo')).toEqual(false);
    expect(isTayoriKey({ [kTayoriKey]: token })).toEqual(false);
  });

  it('recognizes keys branded by any instance', () => {
    const other: TayoriInstanceToken = { backend: 'other' };
    expect(isTayoriKey(brand(['a'], other))).toEqual(true);
  });
});
