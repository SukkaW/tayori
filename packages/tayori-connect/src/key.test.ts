import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';
import type { Middleware } from 'swr';
import { unstable_serialize } from 'swr';
import type { DescMethod, DescMethodUnary } from '@bufbuild/protobuf';
import { create, createFileRegistry, createRegistry, toJson } from '@bufbuild/protobuf';
import type { Any } from '@bufbuild/protobuf/wkt';
import { anyPack, anyUnpack, file_google_protobuf_any, FileDescriptorProtoSchema, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createRouterTransport } from '@connectrpc/connect';

import { isTayoriConnectKey, tayoriConnect } from '.';
import { createConnectBackend, getMethodKey } from './backend';
import { EchoRequestSchema, Kind, TestService } from '../test/gen/tayori/test/v1/test_pb';
import type { EchoRequest } from '../test/gen/tayori/test/v1/test_pb';
import { createTestTransport } from '../test/router';
import { createWrapper } from '../test/wrapper';

const { useData, TayoriProvider } = tayoriConnect();

/** Copy a (branded) key into a plain array so that earl compares only the enumerable slots */
const plain = (key: unknown) => Array.from(key as Iterable<unknown>);
/** Resolve an SWR key function the way SWR does (a throwing key function pauses the request) */
function resolveKey(key: unknown): unknown {
  if (typeof key !== 'function') return key;
  try {
    return (key as () => unknown)();
  } catch {
    return 'thrown';
  }
}
/** Let pending microtasks / fetches settle */
function settle(ms = 20) {
  // eslint-disable-next-line sukka/prefer-foxts-wait -- foxts is not a dependency of this package
  return act(() => delay(ms));
}
/** A paused hook: no request, no data, not loading */
function expectPaused(swr: { isLoading: boolean, data: unknown, error: unknown }) {
  expect(swr.isLoading).toEqual(false);
  expect(swr.data).toEqual(undefined);
  expect(swr.error).toEqual(undefined);
}
/** Narrow a method descriptor to a unary one (protobuf-es types `methodKind` as a plain union, not a discriminant) */
function asUnary(method: DescMethod | undefined): DescMethodUnary {
  if (method?.methodKind !== 'unary') {
    throw new Error('test setup: expected a unary method');
  }
  return method as DescMethodUnary;
}

/**
 * An SWR middleware that records the raw key of every `useSWR` call. Installed INSIDE the tayori
 * provider, it sees exactly the key tayori-connect built (tayori's own middleware passes it through).
 */
function createKeySpy() {
  const keys: unknown[] = [];
  const middleware: Middleware = (useSWRNext) => (key, fetcher, config) => {
    keys.push(key);
    return useSWRNext(key, fetcher, config);
  };
  return { keys, middleware };
}

function setup() {
  const { transport, calls } = createTestTransport();
  const spy = createKeySpy();
  const wrapper = createWrapper({ TayoriProvider, initTransport: () => transport, swr: { use: [spy.middleware] } });
  return { transport, calls, spy, wrapper };
}

describe('tayori-connect SWR keys', () => {
  it('builds [transport, "<service>/<method>", canonical proto3 JSON, cacheTags]', async () => {
    const { transport, calls, spy, wrapper } = setup();
    const at = new Date('2024-01-02T03:04:05Z');
    const init = {
      text: 'a',
      big: 9_007_199_254_740_993n,
      blob: new Uint8Array([1, 2, 3]),
      at: timestampFromDate(at),
      tags: ['x'],
      counts: { a: 1 },
      kind: Kind.A,
      nested: { value: 'n' }
    };

    const { result } = renderHook(() => useData(TestService.method.echo, init, { cacheTags: ['#k'] }), { wrapper });
    await waitFor(() => {
      expect(result.current.data?.text).toEqual('a');
    });

    const key = spy.keys[0];
    expect(isTayoriConnectKey(key)).toEqual(true);
    const [client, methodKey, argKey, cacheTags] = plain(key);
    expect(transport).toExactlyEqual(client);
    expect(methodKey).toEqual('tayori.test.v1.TestService/Echo');
    // int64 as string, bytes as base64, Timestamp as RFC 3339, enum by name, map as object
    expect(argKey).toEqual({
      text: 'a',
      big: '9007199254740993',
      blob: 'AQID',
      at: '2024-01-02T03:04:05Z',
      tags: ['x'],
      counts: { a: 1 },
      kind: 'KIND_A',
      nested: { value: 'n' }
    });
    expect(argKey).toEqual(toJson(EchoRequestSchema, create(EchoRequestSchema, init)));
    expect(cacheTags).toEqual(['#k']);
    // nothing else is enumerable (call options ride along as a hidden property)
    expect(Object.keys(key as object)).toEqual(['0', '1', '2', '3']);

    // the handler received the request decoded from the key, without loss
    expect(calls.length).toEqual(1);
    const { request } = calls[0];
    expect(request.text).toEqual('a');
    expect(request.big).toEqual(9_007_199_254_740_993n);
    expect(Array.from(request.blob)).toEqual([1, 2, 3]);
    expect(request.at?.seconds).toEqual(BigInt(at.getTime() / 1000));
    expect(request.at?.nanos).toEqual(0);
    expect(request.tags).toEqual(['x']);
    expect(request.counts).toEqual({ a: 1 });
    expect(request.kind).toEqual(Kind.A);
    expect(request.nested?.value).toEqual('n');
  });

  it('omits default values, so equivalent inits share one key and one request', async () => {
    const { calls, spy, wrapper } = setup();
    const explicitDefaults = {
      text: 'a',
      big: 0n,
      blob: new Uint8Array(),
      tags: [],
      counts: {},
      kind: Kind.UNSPECIFIED,
      pageToken: ''
    };

    const { result } = renderHook(() => ({
      a: useData(TestService.method.echo, explicitDefaults),
      b: useData(TestService.method.echo, { text: 'a' })
    }), { wrapper });
    await waitFor(() => {
      expect(result.current.a.data?.text).toEqual('a');
      expect(result.current.b.data?.text).toEqual('a');
    });

    const [a, b] = spy.keys;
    expect(plain(a)[2]).toEqual({ text: 'a' });
    expect(plain(b)[2]).toEqual({ text: 'a' });
    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    // same key: the second hook deduped onto the first request
    expect(calls.length).toEqual(1);
    expect(calls[0].request.big).toEqual(0n);
    expect(calls[0].request.tags).toEqual([]);
  });

  it('different transports produce different keys', async () => {
    const first = setup();
    const second = setup();

    const a = renderHook(() => useData(TestService.method.echo, { text: 'same' }), { wrapper: first.wrapper });
    const b = renderHook(() => useData(TestService.method.echo, { text: 'same' }), { wrapper: second.wrapper });
    // SWR only re-renders for the fields a hook has read (dependency collection): read both roots
    // before either request settles, otherwise the later-read root never observes its response
    expect(a.result.current.isLoading).toEqual(true);
    expect(b.result.current.isLoading).toEqual(true);
    await waitFor(() => {
      expect(a.result.current.data?.text).toEqual('same');
      expect(b.result.current.data?.text).toEqual('same');
    });

    const keyA = first.spy.keys[0];
    const keyB = second.spy.keys[0];
    expect(plain(keyA).slice(1)).toEqual(plain(keyB).slice(1));
    expect(unstable_serialize(keyA as never)).not.toEqual(unstable_serialize(keyB as never));
    expect(first.calls.length).toEqual(1);
    expect(second.calls.length).toEqual(1);
  });

  it('pauses on falsy input: null SWR key, no request', async () => {
    const { calls, spy, wrapper } = setup();

    const { result } = renderHook(() => ({
      nil: useData(TestService.method.echo, null),
      undef: useData(TestService.method.echo, undefined),
      no: useData(TestService.method.echo, false),
      zero: useData(TestService.method.echo, 0)
    }), { wrapper });

    expect(spy.keys.slice(0, 4)).toEqual([null, null, null, null]);
    expectPaused(result.current.nil);
    expectPaused(result.current.undef);
    expectPaused(result.current.no);
    expectPaused(result.current.zero);
    await settle();
    expect(calls.length).toEqual(0);
  });

  it('resolves an input thunk into a branded key', async () => {
    const { spy, wrapper } = setup();

    const { result } = renderHook(() => useData(TestService.method.echo, () => ({ text: 'thunk', big: 1n })), { wrapper });
    await waitFor(() => {
      expect(result.current.data?.text).toEqual('thunk');
    });

    const raw = spy.keys[0];
    expect(typeof raw).toEqual('function');
    expect(isTayoriConnectKey(raw)).toEqual(true);
    const resolved = resolveKey(raw);
    expect(isTayoriConnectKey(resolved)).toEqual(true);
    expect(plain(resolved)[1]).toEqual('tayori.test.v1.TestService/Echo');
    expect(plain(resolved)[2]).toEqual({ text: 'thunk', big: '1' });
  });

  it('pauses when the input thunk returns a falsy value or throws (no error is surfaced)', async () => {
    const { calls, spy, wrapper } = setup();

    const { result } = renderHook(() => ({
      nullish: useData(TestService.method.echo, () => null),
      throwing: useData(TestService.method.echo, () => {
        throw new Error('not ready yet');
      })
    }), { wrapper });

    expect(resolveKey(spy.keys[0])).toEqual(null);
    expect(resolveKey(spy.keys[1])).toEqual('thrown');
    await settle();
    expectPaused(result.current.nullish);
    expectPaused(result.current.throwing);
    expect(calls.length).toEqual(0);
  });
});

describe('isTayoriConnectKey', () => {
  it('rejects keys that were not built by tayori-connect', () => {
    expect(isTayoriConnectKey(null)).toEqual(false);
    expect(isTayoriConnectKey('tayori.test.v1.TestService/Echo')).toEqual(false);
    expect(isTayoriConnectKey([{}, 'tayori.test.v1.TestService/Echo', { text: 'a' }, undefined])).toEqual(false);
    expect(isTayoriConnectKey(() => null)).toEqual(false);
  });
});

describe('getMethodKey', () => {
  it('returns "<service type name>/<method name>" for unary methods', () => {
    expect(getMethodKey(TestService.method.echo)).toEqual('tayori.test.v1.TestService/Echo');
    expect(getMethodKey(TestService.method.update)).toEqual('tayori.test.v1.TestService/Update');
    expect(createConnectBackend().methodKey(TestService.method.echo)).toEqual('tayori.test.v1.TestService/Echo');
  });

  it('rejects non-unary methods with a TypeError', () => {
    expect(() => getMethodKey(TestService.method.stream)).toThrow(TypeError, 'only unary methods');
    expect(() => getMethodKey(TestService.method.stream)).toThrow('tayori.test.v1.TestService/Stream is a server_streaming method');
  });
});

describe('createConnectBackend', () => {
  describe('registry option', () => {
    // A unary method whose input is `google.protobuf.Any`, built at runtime since the fixture proto has none
    const anyFile = createFileRegistry(
      create(FileDescriptorProtoSchema, {
        name: 'tayori/test/v1/any.proto',
        package: 'tayori.test.v1',
        syntax: 'proto3',
        dependency: ['google/protobuf/any.proto'],
        service: [{
          name: 'AnyService',
          method: [{ name: 'Wrap', inputType: '.google.protobuf.Any', outputType: '.google.protobuf.Any' }]
        }]
      }),
      () => file_google_protobuf_any
    );
    const wrap = asUnary(anyFile.getService('tayori.test.v1.AnyService')?.methods[0]);
    const registry = createRegistry(EchoRequestSchema);
    const packed = anyPack(EchoRequestSchema, create(EchoRequestSchema, { text: 'inside' }));

    it('is required to build a key for a populated google.protobuf.Any input', () => {
      expect(() => createConnectBackend().argKey(wrap, packed)).toThrow('is not in the type registry');
      // an empty Any needs no registry
      expect(createConnectBackend().argKey(wrap, {})).toEqual([{}, undefined]);
    });

    it('surfaces the missing registry through SWR error for object and thunk inputs alike', async () => {
      const { wrapper } = setup();

      const { result } = renderHook(() => ({
        object: useData(wrap, packed, { shouldRetryOnError: false }),
        thunk: useData(wrap, () => packed, { shouldRetryOnError: false })
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.object.error).toBeA(Error);
        expect(result.current.thunk.error).toBeA(Error);
      });
      expect(String(result.current.object.error)).toInclude('is not in the type registry');
      expect(String(result.current.thunk.error)).toInclude('is not in the type registry');
    });

    it('encodes the Any for the key and decodes it again for the request', async () => {
      const backend = createConnectBackend({ registry });
      const [argKey] = backend.argKey(wrap, packed);
      expect(argKey).toEqual({ '@type': 'type.googleapis.com/tayori.test.v1.EchoRequest', text: 'inside' });

      const transport = createRouterTransport(({ rpc }) => {
        rpc(wrap, (request) => request);
      });
      const response = await backend.fetch(transport, wrap, argKey, undefined);
      const unpacked = anyUnpack(response as Any, EchoRequestSchema);
      expect(unpacked?.text).toEqual('inside');
    });
  });
});

// Compiled by `tsc` (part of `pnpm run typecheck`), never executed: `EchoRequest` is the runtime shape the handler receives
function checkRequestFieldTypes(request: EchoRequest): [string, bigint, Uint8Array, string[]] {
  return [request.text, request.big, request.blob, request.tags];
}

describe('type-level checks', () => {
  it('EchoRequest keeps its declared field types', () => {
    expect(typeof checkRequestFieldTypes).toEqual('function');
  });
});
