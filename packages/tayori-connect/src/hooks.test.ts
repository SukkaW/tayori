import { afterEach, describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';
import { mutate } from 'swr';
import sinon from 'sinon';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import type { Transport } from '@connectrpc/connect';

import { isTayoriConnectKey, tayoriConnect, unstable_mutateWithTags } from '.';
import { EchoResponseSchema, TestService } from '../test/gen/tayori/test/v1/test_pb';
import type { EchoResponse } from '../test/gen/tayori/test/v1/test_pb';
import { createTestTransport } from '../test/router';
import { createWrapper } from '../test/wrapper';

const { useData, useDataImmutable, useInfinite, useMutation, usePreload, useTransport, TayoriProvider } = tayoriConnect();

/** Let pending microtasks / fetches settle */
function settle(ms = 20) {
  // eslint-disable-next-line sukka/prefer-foxts-wait -- foxts is not a dependency of this package
  return act(() => delay(ms));
}

function setup(overrides?: Parameters<typeof createTestTransport>[0]) {
  const { transport, calls } = createTestTransport(overrides);
  const wrapper = createWrapper({ TayoriProvider, initTransport: () => transport });
  return { transport, calls, wrapper };
}

describe('useData', () => {
  it('fetches through the transport and exposes the response message', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => useData(TestService.method.echo, { text: 'hello', big: 42n }), { wrapper });

    expect(result.current.isLoading).toEqual(true);
    expect(result.current.data).toEqual(undefined);
    await waitFor(() => {
      expect(result.current.data?.text).toEqual('hello');
    });
    expect(result.current.data?.big).toEqual(42n);
    expect(result.current.data).toEqual(create(EchoResponseSchema, { text: 'hello', big: 42n, receivedHeaders: { 'x-test': '' } }));
    expect(result.current.error).toEqual(undefined);
    expect(calls.map((call) => call.method)).toEqual(['Echo']);
  });

  it('exposes the ConnectError thrown by the handler through SWR error', async () => {
    const { wrapper } = setup({
      echo() {
        throw new ConnectError('bad input', Code.InvalidArgument);
      }
    });

    const { result } = renderHook(() => useData(TestService.method.echo, { text: 'x' }, { shouldRetryOnError: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeA(ConnectError);
    });
    const error = ConnectError.from(result.current.error);
    expect(error.code).toEqual(Code.InvalidArgument);
    expect(error.rawMessage).toEqual('bad input');
    expect(result.current.data).toEqual(undefined);
  });

  it('forwards headers to the handler without making them part of the key', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => ({
      a: useData(TestService.method.echo, { text: 'h' }, { headers: { 'x-test': 'a' } }),
      b: useData(TestService.method.echo, { text: 'h' }, { headers: { 'x-test': 'b' } })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.a.data?.text).toEqual('h');
      expect(result.current.b.data?.text).toEqual('h');
    });
    // same key: one request, whose call options are those of the hook that started it
    expect(calls.length).toEqual(1);
    expect(calls[0].headers['x-test']).toEqual('a');
    expect(result.current.a.data?.receivedHeaders).toEqual({ 'x-test': 'a' });
    // and the very same cache entry
    expect(result.current.a.data!).toExactlyEqual(result.current.b.data);
  });

  it('forwards timeoutMs to the handler', async () => {
    let remaining: number | undefined;
    const { wrapper } = setup({
      echo(request, context) {
        remaining = context.timeoutMs();
        return { text: request.text };
      }
    });

    const { result } = renderHook(() => useData(TestService.method.echo, { text: 't' }, { timeoutMs: 5000 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.text).toEqual('t');
    });
    expect(remaining).toBeA(Number);
    expect(remaining!).toBeLessThanOrEqual(5000);
    expect(remaining!).toBeGreaterThan(0);
  });

  it('calls onHeader / onTrailer with the response headers and trailers', async () => {
    const { wrapper } = setup({
      echo(request, context) {
        context.responseHeader.set('x-res-header', 'h');
        context.responseTrailer.set('x-res-trailer', 't');
        return { text: request.text };
      }
    });
    const headers: Headers[] = [];
    const trailers: Headers[] = [];

    const { result } = renderHook(() => useData(TestService.method.echo, { text: 'x' }, {
      onHeader(header) {
        headers.push(header);
      },
      onTrailer(trailer) {
        trailers.push(trailer);
      }
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.text).toEqual('x');
    });
    expect(headers.length).toEqual(1);
    expect(headers[0]).toBeA(Headers);
    expect(headers[0].get('x-res-header')).toEqual('h');
    expect(trailers.length).toEqual(1);
    expect(trailers[0]).toBeA(Headers);
    expect(trailers[0].get('x-res-trailer')).toEqual('t');
  });

  it('reports a misconfiguration when rendered outside of <TayoriProvider />', async () => {
    // The sentinel fetcher throws synchronously while mounting. SWR only re-renders for the fields a
    // hook has read (dependency collection), so read them during render to observe that update.
    const { result } = renderHook(() => {
      const { data, error, isLoading } = useData(TestService.method.echo, { text: 'x' }, { shouldRetryOnError: false });
      return { data, error, isLoading };
    });

    await waitFor(() => {
      expect(result.current.error).toBeA(Error);
    });
    expect((result.current.error as Error).message).toEqual('[tayori-connect] hooks must be used within <TayoriProvider />');
    expect(result.current.data).toEqual(undefined);
    expect(result.current.isLoading).toEqual(false);
  });
});

describe('useDataImmutable', () => {
  it('serves a remount from the cache without revalidating', async () => {
    const { transport, calls } = createTestTransport();
    // one cache shared by both mounts
    const cache = new Map();
    const wrapper = createWrapper({ TayoriProvider, initTransport: () => transport, swr: { provider: () => cache } });

    const first = renderHook(() => useDataImmutable(TestService.method.echo, { text: 'imm' }), { wrapper });
    await waitFor(() => {
      expect(first.result.current.data?.text).toEqual('imm');
    });
    first.unmount();

    const second = renderHook(() => useDataImmutable(TestService.method.echo, { text: 'imm' }), { wrapper });
    expect(second.result.current.data?.text).toEqual('imm');
    expect(second.result.current.isLoading).toEqual(false);
    await settle();
    expect(calls.length).toEqual(1);
  });
});

describe('useInfinite', () => {
  it('pages with pageToken / nextPageToken', async () => {
    const { calls, wrapper } = setup({
      echo: (request) => ({
        text: `page ${request.pageToken || '1'}`,
        nextPageToken: request.pageToken ? '' : '2'
      })
    });

    const { result } = renderHook(() => useInfinite(TestService.method.echo, (_pageIndex, previous) => {
      if (previous && !previous.nextPageToken) return null; // reached the end
      return { text: 'list', pageToken: previous?.nextPageToken };
    }, {
      // SWR infinite option, passed through untouched: don't refetch page 1 whenever a page is added
      revalidateFirstPage: false
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.length).toEqual(1);
    });
    expect(result.current.data?.[0].text).toEqual('page 1');
    expect(result.current.size).toEqual(1);

    await act(async () => {
      await result.current.setSize(2);
    });
    await waitFor(() => {
      expect(result.current.data?.length).toEqual(2);
    });
    expect(result.current.data?.map((page) => page.text)).toEqual(['page 1', 'page 2']);
    expect(calls.map((call) => call.request.pageToken)).toEqual(['', '2']);

    // the loader returns null for the third page, so nothing more is requested
    await act(async () => {
      await result.current.setSize(3);
    });
    await settle();
    expect(result.current.data?.length).toEqual(2);
    expect(calls.length).toEqual(2);
  });
});

describe('useMutation', () => {
  it('trigger() calls the method with the trigger call options and resolves with the response', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => useMutation(TestService.method.update), { wrapper });

    expect(result.current.isMutating).toEqual(false);
    expect(result.current.data).toEqual(undefined);
    let response: EchoResponse | undefined;
    await act(async () => {
      response = await result.current.trigger({ text: 'saved', big: 7n }, { headers: { 'x-test': 'mut' } });
    });
    expect(response?.text).toEqual('saved');
    expect(response?.big).toEqual(7n);
    expect(response?.receivedHeaders).toEqual({ 'x-test': 'mut' });
    expect(result.current.data).toEqual(response);
    expect(result.current.error).toEqual(undefined);
    expect(result.current.isMutating).toEqual(false);
    expect(calls.map((call) => call.method)).toEqual(['Update']);
    expect(calls[0].headers['x-test']).toEqual('mut');
  });

  it('merges trigger call options over hook call options', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => useMutation(TestService.method.update, { headers: { 'x-test': 'hook', 'x-hook': '1' } }), { wrapper });

    await act(async () => {
      await result.current.trigger({ text: 'a' });
    });
    await act(async () => {
      await result.current.trigger({ text: 'b' }, { headers: { 'x-test': 'trigger' } });
    });
    expect(calls[0].headers['x-test']).toEqual('hook');
    expect(calls[0].headers['x-hook']).toEqual('1');
    expect(calls[1].headers['x-test']).toEqual('trigger');
    // `headers` is replaced as a whole, not merged key by key
    expect(Object.hasOwn(calls[1].headers, 'x-hook')).toEqual(false);
  });

  it('trigger() rejects with a ConnectError and exposes it as error', async () => {
    const { wrapper } = setup({
      update() {
        throw new ConnectError('nope', Code.PermissionDenied);
      }
    });
    const onError = sinon.spy();

    const { result } = renderHook(() => useMutation(TestService.method.update, { onError }), { wrapper });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.trigger({ text: 'x' });
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeA(ConnectError);
    expect(ConnectError.from(caught).code).toEqual(Code.PermissionDenied);
    // `ConnectError.from` returns a ConnectError as is, so this also checks identity
    expect(ConnectError.from(result.current.error)).toExactlyEqual(caught);
    expect(result.current.data).toEqual(undefined);
    expect(onError.calledOnce).toEqual(true);
    expect(onError.firstCall.args[0]).toExactlyEqual(caught);
  });

  it('trigger() with an already aborted signal rejects with Code.Canceled', async () => {
    const { wrapper } = setup();
    const controller = new AbortController();
    controller.abort();

    const { result } = renderHook(() => useMutation(TestService.method.update), { wrapper });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.trigger({ text: 'x' }, { signal: controller.signal });
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeA(ConnectError);
    expect(ConnectError.from(caught).code).toEqual(Code.Canceled);
    expect(ConnectError.from(result.current.error)).toExactlyEqual(caught);
  });

  it('populateCache: true writes the result into the slot useData reads from', async () => {
    const { calls, wrapper } = setup();
    const input = { text: 'cached', big: 3n };

    const { result, rerender } = renderHook(({ read }: { read: boolean }) => ({
      mutation: useMutation(TestService.method.echo, { populateCache: true }),
      query: useData(TestService.method.echo, read && input, { revalidateIfStale: false })
    }), { wrapper, initialProps: { read: false } });

    await act(async () => {
      await result.current.mutation.trigger(input);
    });
    expect(calls.length).toEqual(1);

    rerender({ read: true });
    // available synchronously, straight from the cache
    expect(result.current.query.data?.text).toEqual('cached');
    expect(result.current.query.data?.big).toEqual(3n);
    expect(result.current.query.isLoading).toEqual(false);
    await settle();
    expect(calls.length).toEqual(1);
  });
});

describe('usePreload', () => {
  it('preloads a request that a later useData reuses without a second fetch', async () => {
    const { calls, wrapper } = setup();
    const input = { text: 'pre' };

    const { result, rerender } = renderHook(({ read }: { read: boolean }) => ({
      preload: usePreload(),
      query: useData(TestService.method.echo, read && input)
    }), { wrapper, initialProps: { read: false } });

    result.current.preload(TestService.method.echo, input, { headers: { 'x-test': 'preload' } });
    await waitFor(() => {
      expect(calls.length).toEqual(1);
    });
    expect(calls[0].headers['x-test']).toEqual('preload');

    rerender({ read: true });
    // the preloaded response is a promise, so it is not available synchronously
    expect(result.current.query.isLoading).toEqual(true);
    await waitFor(() => {
      expect(result.current.query.data?.text).toEqual('pre');
    });
    expect(result.current.query.data?.receivedHeaders).toEqual({ 'x-test': 'preload' });
    await settle();
    expect(calls.length).toEqual(1);
  });
});

describe('useTransport', () => {
  it('returns the transport created by the nearest <TayoriProvider />, created only once', () => {
    const { transport } = createTestTransport();
    const initTransport = sinon.spy((): Transport => transport);
    const wrapper = createWrapper({ TayoriProvider, initTransport });

    const { result, rerender } = renderHook(() => useTransport(), { wrapper });

    expect(result.current).toExactlyEqual(transport);
    rerender();
    rerender();
    expect(result.current).toExactlyEqual(transport);
    expect(initTransport.callCount).toEqual(1);
  });

  it('throws outside of <TayoriProvider />', () => {
    expect(() => renderHook(() => useTransport())).toThrow('[tayori-connect] hooks must be used within <TayoriProvider />');
  });
});

describe('unstable_mutateWithTags', () => {
  // `unstable_mutateWithTags` uses SWR's global `mutate`, which only reaches the default cache, so these
  // tests share it and clear every tayori-connect entry afterwards (inside act: the hooks are still mounted)
  afterEach(() => act(async () => {
    await mutate(isTayoriConnectKey, undefined, { revalidate: false });
  }));

  it('revalidates the hooks whose cacheTags match', async () => {
    const { transport, calls } = createTestTransport();
    const wrapper = createWrapper({ TayoriProvider, initTransport: () => transport, swr: { provider: undefined } });

    const { result } = renderHook(() => ({
      tagged: useData(TestService.method.echo, { text: 'tagged' }, { cacheTags: ['#t', '#other'] }),
      untagged: useData(TestService.method.echo, { text: 'untagged' })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.tagged.data?.text).toEqual('tagged');
      expect(result.current.untagged.data?.text).toEqual('untagged');
    });
    expect(calls.length).toEqual(2);

    await act(async () => {
      await unstable_mutateWithTags(['#t']);
    });
    expect(calls.map((call) => call.request.text)).toEqual(['tagged', 'untagged', 'tagged']);

    await act(async () => {
      await unstable_mutateWithTags(['#unrelated']);
    });
    expect(calls.length).toEqual(3);
  });
});

// Compiled by `tsc` (part of `pnpm run typecheck`), never executed
function useTypeChecks() {
  // @ts-expect-error -- `nope` is not a field of EchoRequest
  useData(TestService.method.echo, { nope: 1 });
  // @ts-expect-error -- `text` is a string field
  useData(TestService.method.echo, { text: 1 });

  const plain = useData(TestService.method.echo, { text: 'a' });
  const maybe: EchoResponse | undefined = plain.data;
  // @ts-expect-error -- without fallbackData, data may be undefined
  const notNullable: EchoResponse = plain.data;

  const withFallback = useData(TestService.method.echo, { text: 'a' }, {
    fallbackData: create(EchoResponseSchema, { text: 'fallback' }),
    headers: { 'x-test': 'typed' }
  });
  const nonNullable: EchoResponse = withFallback.data;

  const { trigger } = useMutation(TestService.method.update);
  // @ts-expect-error -- `text` is a string field
  void trigger({ text: 1 });
  const triggered: Promise<EchoResponse> = trigger({ text: 'a' }, { signal: new AbortController().signal });

  // @ts-expect-error -- streaming methods are not unary methods
  useData(TestService.method.stream, { text: 'a' });

  return [maybe, notNullable, nonNullable, triggered] as const;
}

describe('type-level checks', () => {
  it('compiles', () => {
    expect(typeof useTypeChecks).toEqual('function');
  });
});
