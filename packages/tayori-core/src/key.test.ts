import { describe, it } from 'mocha';
import { expect } from 'earl';
import { unstable_serialize } from 'swr';

import { brand, buildKey, getKeyError, isTayoriKey, kTayoriKey, kTayoriKeyError } from './key';
import type { TayoriInstanceToken } from './key';
import type { TayoriBackend, TayoriSimpleTypes } from './types';

const token: TayoriInstanceToken = { backend: 'test' };
/** Copy a (branded) key into a plain array so that earl compares only the enumerable slots */
const plain = (key: unknown) => Array.from(key as Iterable<unknown>);
const client = { name: 'client' };

type Arg = { id: number, timeout?: number, cacheTags?: Array<`#${string}`> };

const backend: Pick<TayoriBackend<TayoriSimpleTypes<string, Arg, unknown>, typeof client>, 'argKey'> = {
  // `timeout` never changes the response, so it stays out of the key
  argKey(_method, { cacheTags, timeout: _timeout, ...rest }) {
    return [rest, cacheTags];
  }
};

describe('buildKey', () => {
  it('builds a branded [client, methodKey, argKey, cacheTags] array', () => {
    const key = buildKey(token, backend, client, 'Get', 'svc/Get', { id: 1, cacheTags: ['#a'] });

    expect(Array.isArray(key)).toEqual(true);
    expect(plain(key)).toEqual([client, 'svc/Get', { id: 1 }, ['#a']]);
    expect(isTayoriKey(key)).toEqual(true);
    expect(key[kTayoriKey]).toExactlyEqual(token);
    // the brand is non-enumerable and never affects SWR's hash
    expect(Object.keys(key)).toEqual(['0', '1', '2', '3']);
    expect(unstable_serialize(key as never)).toEqual(unstable_serialize([client, 'svc/Get', { id: 1 }, ['#a']]));
  });

  it('leaves non-identifying parts of the arg out of the key, as decided by the backend', () => {
    const a = buildKey(token, backend, client, 'Get', 'svc/Get', { id: 1, timeout: 10 });
    const b = buildKey(token, backend, client, 'Get', 'svc/Get', { id: 1, timeout: 20 });
    expect(plain(a)).toEqual([client, 'svc/Get', { id: 1 }, undefined]);
    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
  });

  it('different clients produce different SWR hashes, same client the same hash', () => {
    const otherClient = { name: 'other' };
    const a = buildKey(token, backend, client, 'Get', 'svc/Get', { id: 1 });
    const b = buildKey(token, backend, client, 'Get', 'svc/Get', { id: 1 });
    const c = buildKey(token, backend, otherClient, 'Get', 'svc/Get', { id: 1 });

    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(c as never));
  });

  it('captures errors thrown by backend.argKey into the key instead of throwing', () => {
    const failing: typeof backend = {
      argKey() {
        throw new Error('cannot serialize');
      }
    };
    const key = buildKey(token, failing, client, 'Get', 'svc/Get', { id: 1 });

    expect(isTayoriKey(key)).toEqual(true);
    expect(plain(key)).toEqual([client, 'svc/Get', { tayoriKeyError: 'Error: cannot serialize' }, undefined]);
    const keyError = getKeyError(key);
    expect(keyError.hasError).toEqual(true);
    expect(key[kTayoriKeyError]).toBeA(Error);
    expect(keyError.hasError && (keyError.error as Error).message).toEqual('cannot serialize');
    // the captured error is hidden from SWR's hash, the message-bearing slot keeps the hash stable
    expect(Object.keys(key)).toEqual(['0', '1', '2', '3']);
    expect(unstable_serialize(key as never)).toEqual(unstable_serialize(buildKey(token, failing, client, 'Get', 'svc/Get', { id: 1 }) as never));
  });

  it('marks healthy keys as error-free', () => {
    const key = buildKey(token, backend, client, 'Get', 'svc/Get', { id: 1 });
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

  it('recognizes keys and key loaders branded by any instance', () => {
    const other: TayoriInstanceToken = { backend: 'other' };
    expect(isTayoriKey(brand(['a'], other))).toEqual(true);
    expect(isTayoriKey(brand(() => null, other))).toEqual(true);
  });
});
