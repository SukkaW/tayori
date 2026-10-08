import { describe, it } from 'mocha';
import { expect } from 'earl';
import { renderHook } from '@testing-library/react';
import type { Middleware } from 'swr';
import { unstable_serialize } from 'swr';

import { createTayori } from '.';
import type { Falsy } from '.';
import { brand, isTayoriKey, kTayoriKey } from './key';
import type { TayoriKeyBrand } from './key';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeArg, FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

/** Copy a (branded) key into a plain array so that earl compares only the enumerable slots */
const plain = (key: unknown) => Array.from(key as Iterable<unknown>);
const client: FakeClient = { name: 'client' };

/** The SWR key `useData('Get', input)` hands to SWR on its first render, recorded by an SWR middleware */
function keyOf(input: FakeArg | Falsy | (() => FakeArg | Falsy), backend = createFakeBackend(), initClient = () => client): unknown {
  const keys: unknown[] = [];
  const spy: Middleware = (useSWRNext) => (key, fetcher, config) => {
    keys.push(key);
    return useSWRNext(key, fetcher, config);
  };
  const instance = createTayori(backend);
  const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient, swr: { use: [spy] } });
  renderHook(() => instance.useData('Get', input), { wrapper }).unmount();
  return keys[0];
}

describe('SWR keys', () => {
  it('are branded [client, methodKey, argKey] arrays', () => {
    const key = keyOf({ id: 1 }, createFakeBackend('test'));

    expect(Array.isArray(key)).toEqual(true);
    expect(plain(key)).toEqual([client, 'Get', { id: 1 }]);
    expect(isTayoriKey(key)).toEqual(true);
    // the brand is the backend name, non-enumerable, and never affects SWR's hash
    expect((key as TayoriKeyBrand)[kTayoriKey]).toEqual('test');
    expect(Object.keys(key as object)).toEqual(['0', '1', '2']);
    expect(unstable_serialize(key as never)).toEqual(unstable_serialize([client, 'Get', { id: 1 }]));
  });

  it('are lossless: every request option is part of the key', () => {
    const a = keyOf({ id: 1, timeout: 10 });
    const b = keyOf({ id: 1, timeout: 20 });
    expect(plain(a)).toEqual([client, 'Get', { id: 1, timeout: 10 }]);
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(b as never));
  });

  it('different clients produce different SWR hashes, same client the same hash', () => {
    const a = keyOf({ id: 1 });
    const b = keyOf({ id: 1 });
    const c = keyOf({ id: 1 }, createFakeBackend(), () => ({ name: 'other' }));

    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(c as never));
  });

  it('resolve request functions like SWR key functions', () => {
    expect(plain(keyOf(() => ({ id: 2 })))).toEqual([client, 'Get', { id: 2 }]);
  });

  it('are null ("not ready") for falsy requests, falsy or throwing request functions, and requests the backend cannot key', () => {
    const backend = createFakeBackend();
    backend.argKey = (_method, arg) => {
      if (arg.id === 13) throw new Error('cannot serialize');
      return arg;
    };

    expect(keyOf(null, backend)).toEqual(null);
    expect(keyOf(false, backend)).toEqual(null);
    expect(keyOf(() => null, backend)).toEqual(null);
    expect(keyOf(() => {
      throw new Error('not ready yet');
    }, backend)).toEqual(null);
    expect(keyOf({ id: 13 }, backend)).toEqual(null);
    expect(keyOf(() => ({ id: 13 }), backend)).toEqual(null);
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
