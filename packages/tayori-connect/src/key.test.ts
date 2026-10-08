import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';
import sinon from 'sinon';
import type { Middleware } from 'swr';
import { unstable_serialize } from 'swr';
import type { DescMethod, DescMethodUnary } from '@bufbuild/protobuf';
import { create, createFileRegistry } from '@bufbuild/protobuf';
import type { Any } from '@bufbuild/protobuf/wkt';
import { anyPack, anyUnpack, file_google_protobuf_any, FileDescriptorProtoSchema, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createContextValues, createRouterTransport } from '@connectrpc/connect';

import type { TayoriConnectArgKey } from '.';
import { isTayoriConnectKey, tayoriConnect } from '.';
import { createConnectBackend, getMethodKey } from './backend';
import { EchoRequestSchema, Kind, TestService } from '../test/gen/tayori/test/v1/test_pb';
import type { EchoRequest, EchoResponse } from '../test/gen/tayori/test/v1/test_pb';
import { createTestTransport } from '../test/router';
import { createWrapper } from '../test/wrapper';

const { useData, useInfinite, TayoriProvider } = tayoriConnect();

/** Copy a (branded) key into a plain array so that earl compares only the enumerable slots */
const plain = (key: unknown) => Array.from(key as Iterable<unknown>);
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
  it('builds [transport, "<service>/<method>", request], with the message created', async () => {
    const { transport, calls, spy, wrapper } = setup();
    const at = new Date('2024-01-02T03:04:05Z');
    const message = {
      text: 'a',
      big: 9_007_199_254_740_993n,
      blob: new Uint8Array([1, 2, 3]),
      at: timestampFromDate(at),
      tags: ['x'],
      counts: { a: 1 },
      kind: Kind.A,
      nested: { value: 'n' }
    };

    const { result } = renderHook(() => useData(TestService.method.echo, { message }), { wrapper });
    await waitFor(() => {
      expect(result.current.data?.text).toEqual('a');
    });

    const key = spy.keys[0];
    expect(isTayoriConnectKey(key)).toEqual(true);
    const [client, methodKey, argKey] = plain(key);
    expect(transport).toExactlyEqual(client);
    expect(methodKey).toEqual('tayori.test.v1.TestService/Echo');
    // the key holds the request itself (lossless), with the message created like the transport
    // would; no `headers` property at all when the request has none
    expect(argKey).toEqual({ message: create(EchoRequestSchema, message) });
    // nothing else is enumerable (the tayori brand is a hidden property)
    expect(Object.keys(key as object)).toEqual(['0', '1', '2']);

    // the handler received exactly the request from the key
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

  it('fills in default values, so equivalent messages share one key and one request', async () => {
    const { calls, spy, wrapper } = setup();
    // (no explicit `blob`: bytes compare by identity, see TayoriConnectRequest)
    const explicitDefaults = {
      text: 'a',
      big: 0n,
      tags: [],
      counts: {},
      kind: Kind.UNSPECIFIED,
      pageToken: ''
    };

    const { result } = renderHook(() => ({
      a: useData(TestService.method.echo, { message: explicitDefaults }),
      b: useData(TestService.method.echo, { message: { text: 'a' } })
    }), { wrapper });
    await waitFor(() => {
      expect(result.current.a.data?.text).toEqual('a');
      expect(result.current.b.data?.text).toEqual('a');
    });

    const [a, b] = spy.keys;
    expect(plain(a)[2]).toEqual({ message: create(EchoRequestSchema, { text: 'a' }) });
    expect(plain(b)[2]).toEqual({ message: create(EchoRequestSchema, { text: 'a' }) });
    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    // same key: the second hook deduped onto the first request
    expect(calls.length).toEqual(1);
    expect(calls[0].request.big).toEqual(0n);
    expect(calls[0].request.tags).toEqual([]);
  });

  it('puts every call option into the key, with headers normalized so equivalent headers share one entry', async () => {
    const { calls, spy, wrapper } = setup();

    const { result } = renderHook(() => ({
      a: useData(TestService.method.echo, { message: { text: 'a' }, headers: { 'X-Test': 'a' } }),
      // same headers spelled differently: same key
      b: useData(TestService.method.echo, { message: { text: 'a' }, headers: new Headers({ 'x-test': 'a' }) }),
      c: useData(TestService.method.echo, { message: { text: 'a' }, headers: { 'x-test': 'c' } }),
      // keys are lossless: the other call options are part of the key too
      d: useData(TestService.method.echo, { message: { text: 'a' }, timeoutMs: 5000 }),
      e: useData(TestService.method.echo, { message: { text: 'a' } })
    }), { wrapper });
    await waitFor(() => {
      expect(result.current.a.data?.text).toEqual('a');
      expect(result.current.b.data?.text).toEqual('a');
      expect(result.current.c.data?.text).toEqual('a');
      expect(result.current.d.data?.text).toEqual('a');
      expect(result.current.e.data?.text).toEqual('a');
    });

    const [a, b, c, d, e] = spy.keys;
    const message = create(EchoRequestSchema, { text: 'a' });
    expect(plain(a)[2]).toEqual({ message, headers: { 'x-test': 'a' } });
    expect(plain(c)[2]).toEqual({ message, headers: { 'x-test': 'c' } });
    expect(plain(d)[2]).toEqual({ message, timeoutMs: 5000 });
    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(c as never));
    expect(unstable_serialize(d as never)).not.toEqual(unstable_serialize(e as never));
    // four distinct keys: four requests, each sending the request of its key
    expect(calls.length).toEqual(4);
    expect(calls.map((call) => call.headers['x-test'] ?? '').sort()).toEqual(['', '', 'a', 'c']);
    expect(result.current.a.data?.receivedHeaders).toEqual({ 'x-test': 'a' });
    expect(result.current.c.data?.receivedHeaders).toEqual({ 'x-test': 'c' });
    expect(result.current.d.data?.receivedHeaders).toEqual({ 'x-test': '' });
  });

  it('different transports produce different keys', async () => {
    const first = setup();
    const second = setup();

    const a = renderHook(() => useData(TestService.method.echo, { message: { text: 'same' } }), { wrapper: first.wrapper });
    const b = renderHook(() => useData(TestService.method.echo, { message: { text: 'same' } }), { wrapper: second.wrapper });
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

  it('pauses on a falsy request: null SWR key, no request', async () => {
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

  it('resolves a request thunk at render, so SWR gets the branded key array (not a key function)', async () => {
    const { spy, wrapper } = setup();

    const { result } = renderHook(() => useData(TestService.method.echo, () => ({ message: { text: 'thunk', big: 1n } })), { wrapper });
    await waitFor(() => {
      expect(result.current.data?.text).toEqual('thunk');
    });

    const key = spy.keys[0];
    expect(Array.isArray(key)).toEqual(true);
    expect(isTayoriConnectKey(key)).toEqual(true);
    expect(plain(key)[1]).toEqual('tayori.test.v1.TestService/Echo');
    expect(plain(key)[2]).toEqual({ message: create(EchoRequestSchema, { text: 'thunk', big: 1n }) });
  });

  it('pauses when the request thunk returns a falsy value or throws (no error is surfaced)', async () => {
    const { calls, spy, wrapper } = setup();

    const { result } = renderHook(() => ({
      nullish: useData(TestService.method.echo, () => null),
      throwing: useData(TestService.method.echo, () => {
        throw new Error('not ready yet');
      })
    }), { wrapper });

    expect(spy.keys.slice(0, 2)).toEqual([null, null]);
    await settle();
    expectPaused(result.current.nullish);
    expectPaused(result.current.throwing);
    expect(calls.length).toEqual(0);
  });

  it('hands SWR a branded key loader for useInfinite, which builds one branded key per page', async () => {
    const { spy, wrapper } = setup();

    const { result } = renderHook(() => useInfinite(TestService.method.echo, (pageIndex) => ({
      message: { text: 'list', pageToken: String(pageIndex) }
    })), { wrapper });
    await waitFor(() => {
      expect(result.current.data?.length).toEqual(1);
    });

    // SWR hands middlewares the raw `useSWRInfinite` key, i.e. the key loader
    const loader = spy.keys[0];
    expect(typeof loader).toEqual('function');
    expect(Array.isArray(loader)).toEqual(false);
    expect(isTayoriConnectKey(loader)).toEqual(true);

    const page = (loader as (pageIndex: number, previousPageData: EchoResponse | null) => unknown)(1, result.current.data![0]);
    expect(isTayoriConnectKey(page)).toEqual(true);
    expect(plain(page)[1]).toEqual('tayori.test.v1.TestService/Echo');
    expect(plain(page)[2]).toEqual({ message: create(EchoRequestSchema, { text: 'list', pageToken: '1' }) });
  });
});

describe('createConnectBackend().argKey', () => {
  const backend = createConnectBackend();

  it('creates the message and only adds `headers` when the request has any', () => {
    const message = create(EchoRequestSchema, { text: 'a' });
    expect(backend.argKey(TestService.method.echo, { message: { text: 'a' } })).toEqual({ message });
    // an already created message is kept as is
    expect((backend.argKey(TestService.method.echo, { message }) as TayoriConnectArgKey).message).toExactlyEqual(message);
    // an empty request message
    expect(backend.argKey(TestService.method.echo, { message: {} })).toEqual({ message: create(EchoRequestSchema) });
    // empty headers are no headers
    expect(backend.argKey(TestService.method.echo, { message, headers: {} })).toEqual({ message });
    expect(backend.argKey(TestService.method.echo, { message, headers: new Headers() })).toEqual({ message });
    expect(backend.argKey(TestService.method.echo, { message, headers: { 'X-Tenant': 't1', 'accept-language': 'ja' } }))
      .toEqual({ message, headers: { 'accept-language': 'ja', 'x-tenant': 't1' } });
  });

  it('keeps every call option but the abort signal', () => {
    const onHeader = sinon.spy();
    const onTrailer = sinon.spy();
    const contextValues = createContextValues();
    expect(backend.argKey(TestService.method.echo, {
      message: { text: 'a' },
      timeoutMs: 5000,
      contextValues,
      onHeader,
      onTrailer,
      signal: new AbortController().signal
    })).toEqual({ message: create(EchoRequestSchema, { text: 'a' }), timeoutMs: 5000, contextValues, onHeader, onTrailer });
    // building a key never performs the request
    expect(onHeader.called).toEqual(false);
    expect(onTrailer.called).toEqual(false);
  });

  it('builds the same key for the same request built again on the next render', () => {
    const onHeader = sinon.spy();
    const render = () => backend.argKey(TestService.method.echo, {
      message: { text: 'a', big: 1n, at: timestampFromDate(new Date('2024-01-02T03:04:05Z')), tags: ['x'], counts: { a: 1 }, nested: { value: 'n' } },
      headers: new Headers({ 'X-Tenant': 't1' }),
      timeoutMs: 5000,
      onHeader
    });
    expect(unstable_serialize([render()])).toEqual(unstable_serialize([render()]));
    // but these compare by identity: created anew, they are a new key (documented on TayoriConnectRequest)
    const withBytes = () => backend.argKey(TestService.method.echo, { message: { blob: new Uint8Array([1]) } });
    const withCallback = () => backend.argKey(TestService.method.echo, { message: {}, onHeader() { /* noop */ } });
    expect(unstable_serialize([withBytes()])).not.toEqual(unstable_serialize([withBytes()]));
    expect(unstable_serialize([withCallback()])).not.toEqual(unstable_serialize([withCallback()]));
  });

  it('normalizes header names and order so equivalent headers hash the same', () => {
    const a = backend.argKey(TestService.method.echo, { message: { text: 'a' }, headers: { 'X-Tenant': 't1', 'Accept-Language': 'ja' } });
    const b = backend.argKey(TestService.method.echo, { message: { text: 'a' }, headers: new Headers([['accept-language', 'ja'], ['x-tenant', 't1']]) });
    const c = backend.argKey(TestService.method.echo, { message: { text: 'a' }, headers: { 'x-tenant': 't2' } });
    const d = backend.argKey(TestService.method.echo, { message: { text: 'a' } });
    expect(unstable_serialize(a as never)).toEqual(unstable_serialize(b as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(c as never));
    expect(unstable_serialize(a as never)).not.toEqual(unstable_serialize(d as never));
  });
});

describe('isTayoriConnectKey', () => {
  it('rejects keys that were not built by tayori-connect', () => {
    expect(isTayoriConnectKey(null)).toEqual(false);
    expect(isTayoriConnectKey('tayori.test.v1.TestService/Echo')).toEqual(false);
    expect(isTayoriConnectKey([{}, 'tayori.test.v1.TestService/Echo', { message: { text: 'a' } }, undefined])).toEqual(false);
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

describe('google.protobuf.Any requests', () => {
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
  const packed = anyPack(EchoRequestSchema, create(EchoRequestSchema, { text: 'inside' }));

  it('are keyed and sent as they are, no type registry needed', async () => {
    const backend = createConnectBackend();
    const request = { message: packed };
    const argKey = backend.argKey(wrap, request);
    expect(argKey).toEqual({ message: packed });

    const transport = createRouterTransport(({ rpc }) => {
      rpc(wrap, (received) => received);
    });
    const response = await backend.call(transport, wrap, argKey as TayoriConnectArgKey);
    const unpacked = anyUnpack(response as Any, EchoRequestSchema);
    expect(unpacked?.text).toEqual('inside');
  });
});

// Compiled by `tsc` (part of `pnpm run typecheck`), never executed: `EchoRequest` is the runtime shape the handler receives
function checkRequestFieldTypes(request: EchoRequest): [string, bigint, Uint8Array, string[]] {
  return [request.text, request.big, request.blob, request.tags];
}

// `isTayoriConnectKey` narrows to the key array OR the `useInfinite` key loader, so `Array.isArray` is needed before indexing
function checkKeyNarrowing(key: unknown): TayoriConnectArgKey | null {
  if (isTayoriConnectKey(key) && Array.isArray(key)) {
    return key[2];
  }
  return null;
}

describe('type-level checks', () => {
  it('compiles', () => {
    expect(typeof checkRequestFieldTypes).toEqual('function');
    expect(typeof checkKeyNarrowing).toEqual('function');
  });
});
