import { describe, it } from 'mocha';
import { expect } from 'earl';
import { unstable_serialize } from 'swr';

import { brand, getKey, isTayoriKey, kTayoriCallOptions, kTayoriKey } from './key';
import type { TayoriInstanceToken } from './key';
import type { TayoriBackend } from './types';

const token: TayoriInstanceToken = { backend: 'test' };
/** Copy a (branded) key into a plain array so that earl compares only the enumerable slots */
const plain = (key: unknown) => Array.from(key as Iterable<unknown>);
const client = { name: 'client' };

const backend: Pick<TayoriBackend<string, { id: number, cacheTags?: Array<`#${string}`> }, unknown, typeof client, { header: string }>, 'methodKey' | 'argKey'> = {
  methodKey: (method) => `svc/${method}`,
  argKey(_method, { cacheTags, ...rest }) {
    return [rest, cacheTags];
  }
};

describe('getKey', () => {
  it('returns null for falsy args', () => {
    expect(getKey(token, backend, client, 'Get', null, undefined)).toEqual(null);
    expect(getKey(token, backend, client, 'Get', undefined, undefined)).toEqual(null);
    expect(getKey(token, backend, client, 'Get', false, undefined)).toEqual(null);
    expect(getKey(token, backend, client, 'Get', 0, undefined)).toEqual(null);
  });

  it('builds a branded [client, methodKey, argKey, cacheTags] array', () => {
    const key = getKey(token, backend, client, 'Get', { id: 1, cacheTags: ['#a'] }, undefined);

    expect(Array.isArray(key)).toEqual(true);
    expect(plain(key)).toEqual([client, 'svc/Get', { id: 1 }, ['#a']]);
    expect(isTayoriKey(key)).toEqual(true);
    expect((key as NonNullable<typeof key>)[kTayoriKey]).toExactlyEqual(token);
  });

  it('prefers options.cacheTags over arg-level cacheTags and attaches call options as a hidden property', () => {
    const key = getKey(token, backend, client, 'Get', { id: 1, cacheTags: ['#a'] }, { cacheTags: ['#b'], callOptions: { header: 'x' } });

    expect(plain(key)).toEqual([client, 'svc/Get', { id: 1 }, ['#b']]);
    expect((key as NonNullable<typeof key>)[kTayoriCallOptions]).toEqual({ header: 'x' });
    // hidden properties are non-enumerable and never affect SWR's hash
    expect(Object.keys(key as object)).toEqual(['0', '1', '2', '3']);
    expect(unstable_serialize(key as never)).toEqual(unstable_serialize([client, 'svc/Get', { id: 1 }, ['#b']]));
  });

  it('brands both the key function and the arrays it returns', () => {
    const thunk = getKey(token, backend, client, 'Get', () => ({ id: 2 }), { callOptions: { header: 'y' } });

    expect(typeof thunk).toEqual('function');
    expect(isTayoriKey(thunk)).toEqual(true);

    const resolved = (thunk as () => unknown)();
    expect(resolved).toEqual([client, 'svc/Get', { id: 2 }, undefined]);
    expect(isTayoriKey(resolved)).toEqual(true);
    expect((resolved as Record<symbol, unknown>)[kTayoriCallOptions]).toEqual({ header: 'y' });
  });

  it('key function returns null when the arg function returns a falsy value', () => {
    const thunk = getKey(token, backend, client, 'Get', () => null, undefined) as () => unknown;
    expect(thunk()).toEqual(null);
  });

  it('different clients produce different SWR hashes, same client the same hash', () => {
    const otherClient = { name: 'other' };
    const a = getKey(token, backend, client, 'Get', { id: 1 }, undefined);
    const b = getKey(token, backend, client, 'Get', { id: 1 }, undefined);
    const c = getKey(token, backend, otherClient, 'Get', { id: 1 }, undefined);

    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(c as never));
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
    expect(isTayoriKey(brand(['a'], other, undefined))).toEqual(true);
  });
});
