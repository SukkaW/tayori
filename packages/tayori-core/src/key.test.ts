import { describe, it } from 'mocha';
import { expect } from 'earl';
import { unstable_serialize } from 'swr';

import { createTayori } from '.';
import { brand, isTayoriKey, kTayoriKey } from './key';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeClient } from '../test/fake-backend';

/** Copy a (branded) key into a plain array so that earl compares only the enumerable slots */
const plain = (key: unknown) => Array.from(key as Iterable<unknown>);
const client: FakeClient = { name: 'client' };

describe('getKey', () => {
  it('builds a branded [client, methodKey, argKey, cacheTags] array', () => {
    const key = createTayori(createFakeBackend('test')).getKey(client, 'Get', { id: 1, cacheTags: ['#a'] });

    expect(Array.isArray(key)).toEqual(true);
    expect(plain(key)).toEqual([client, 'Get', { id: 1 }, ['#a']]);
    expect(isTayoriKey(key)).toEqual(true);
    // the brand is the backend name, non-enumerable, and never affects SWR's hash
    expect(key?.[kTayoriKey]).toEqual('test');
    expect(Object.keys(key ?? {})).toEqual(['0', '1', '2', '3']);
    expect(unstable_serialize(key as never)).toEqual(unstable_serialize([client, 'Get', { id: 1 }, ['#a']]));
  });

  it('is lossless: every request option is part of the key, only cacheTags move to their own slot', () => {
    const { getKey } = createTayori(createFakeBackend());
    const a = getKey(client, 'Get', { id: 1, timeout: 10, cacheTags: ['#a'] });
    const b = getKey(client, 'Get', { id: 1, timeout: 20, cacheTags: ['#a'] });
    expect(plain(a)).toEqual([client, 'Get', { id: 1, timeout: 10 }, ['#a']]);
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(b as never));
  });

  it('different clients produce different SWR hashes, same client the same hash', () => {
    const { getKey } = createTayori(createFakeBackend());
    const a = getKey(client, 'Get', { id: 1 });
    const b = getKey(client, 'Get', { id: 1 });
    const c = getKey({ name: 'other' }, 'Get', { id: 1 });

    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(c as never));
  });

  it('resolves request functions like SWR key functions', () => {
    const { getKey } = createTayori(createFakeBackend());
    expect(plain(getKey(client, 'Get', () => ({ id: 2 })))).toEqual([client, 'Get', { id: 2 }, undefined]);
  });

  it('returns null ("not ready") for falsy requests, falsy or throwing request functions, and requests the backend cannot key', () => {
    const backend = createFakeBackend();
    backend.argKey = (_method, arg) => {
      if (arg.id === 13) throw new Error('cannot serialize');
      const { cacheTags, ...rest } = arg;
      return [rest, cacheTags];
    };
    const { getKey } = createTayori(backend);

    expect(getKey(client, 'Get', null)).toEqual(null);
    expect(getKey(client, 'Get', false)).toEqual(null);
    expect(getKey(client, 'Get', () => null)).toEqual(null);
    expect(getKey(client, 'Get', () => {
      throw new Error('not ready yet');
    })).toEqual(null);
    expect(getKey(client, 'Get', { id: 13 })).toEqual(null);
    expect(getKey(client, 'Get', () => ({ id: 13 }))).toEqual(null);
  });
});

describe('isTayoriKey', () => {
  it('rejects foreign keys', () => {
    expect(isTayoriKey(null)).toEqual(false);
    expect(isTayoriKey('foo')).toEqual(false);
    expect(isTayoriKey(['foo', 1])).toEqual(false);
    expect(isTayoriKey(() => 'foo')).toEqual(false);
    expect(isTayoriKey({ [kTayoriKey]: 'test' })).toEqual(false);
  });

  it('recognizes keys and key loaders branded by any backend', () => {
    expect(isTayoriKey(brand(['a'], 'other'))).toEqual(true);
    expect(isTayoriKey(brand(() => null, 'other'))).toEqual(true);
  });
});
