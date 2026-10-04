import { describe, it } from 'mocha';
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
import { createTag } from '../test/cache-tag';

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

    const { result } = renderHook(() => useData(TestService.method.echo, { message: { text: 'hello', big: 42n } }), { wrapper });

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

  it('sends an empty request message when `message` is omitted', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => useData(TestService.method.echo, { message: {} }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).not.toEqual(undefined);
    });
    expect(result.current.data?.text).toEqual('');
    expect(calls.length).toEqual(1);
    expect(calls[0].request.text).toEqual('');
    expect(calls[0].request.big).toEqual(0n);
  });

  it('exposes the ConnectError thrown by the handler through SWR error', async () => {
    const { wrapper } = setup({
      echo() {
        throw new ConnectError('bad input', Code.InvalidArgument);
      }
    });

    const { result } = renderHook(() => useData(TestService.method.echo, { message: { text: 'x' } }, { shouldRetryOnError: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeA(ConnectError);
    });
    const error = ConnectError.from(result.current.error);
    expect(error.code).toEqual(Code.InvalidArgument);
    expect(error.rawMessage).toEqual('bad input');
    expect(result.current.data).toEqual(undefined);
  });

  it('forwards headers to the handler and makes them part of the key', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => ({
      a: useData(TestService.method.echo, { message: { text: 'h' }, headers: { 'x-test': 'a' } }),
      b: useData(TestService.method.echo, { message: { text: 'h' }, headers: { 'x-test': 'b' } }),
      // same headers as `a`, spelled differently: same key
      c: useData(TestService.method.echo, { message: { text: 'h' }, headers: new Headers({ 'X-Test': 'a' }) })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.a.data?.text).toEqual('h');
      expect(result.current.b.data?.text).toEqual('h');
      expect(result.current.c.data?.text).toEqual('h');
    });
    // different headers: two requests, two cache entries, each with its own headers
    expect(calls.length).toEqual(2);
    expect(calls.map((call) => call.headers['x-test']).sort()).toEqual(['a', 'b']);
    expect(result.current.a.data?.receivedHeaders).toEqual({ 'x-test': 'a' });
    expect(result.current.b.data?.receivedHeaders).toEqual({ 'x-test': 'b' });
    // equivalent headers share the entry
    expect(result.current.a.data!).toExactlyEqual(result.current.c.data);
  });

  it('forwards timeoutMs to the handler', async () => {
    let remaining: number | undefined;
    const { wrapper } = setup({
      echo(request, context) {
        remaining = context.timeoutMs();
        return { text: request.text };
      }
    });

    const { result } = renderHook(() => useData(TestService.method.echo, { message: { text: 't' }, timeoutMs: 5000 }), { wrapper });

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

    const { result } = renderHook(() => useData(TestService.method.echo, {
      message: { text: 'x' },
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

  it('throws at render when used outside of <TayoriProvider />', () => {
    expect(() => renderHook(() => useData(TestService.method.echo, { message: { text: 'x' } })))
      .toThrow('[tayori-connect] hooks must be used within <TayoriProvider />');
  });
});

describe('useDataImmutable', () => {
  it('serves a remount from the cache without revalidating', async () => {
    const { transport, calls } = createTestTransport();
    // one cache shared by both mounts
    const cache = new Map();
    const wrapper = createWrapper({ TayoriProvider, initTransport: () => transport, swr: { provider: () => cache } });

    const first = renderHook(() => useDataImmutable(TestService.method.echo, { message: { text: 'imm' } }), { wrapper });
    await waitFor(() => {
      expect(first.result.current.data?.text).toEqual('imm');
    });
    first.unmount();

    const second = renderHook(() => useDataImmutable(TestService.method.echo, { message: { text: 'imm' } }), { wrapper });
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
      return { message: { text: 'list', pageToken: previous?.nextPageToken } };
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
  it('trigger() calls the method with the request headers and resolves with the response', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => useMutation(TestService.method.update), { wrapper });

    expect(result.current.isMutating).toEqual(false);
    expect(result.current.data).toEqual(undefined);
    let response: EchoResponse | undefined;
    await act(async () => {
      response = await result.current.trigger({ message: { text: 'saved', big: 7n }, headers: { 'x-test': 'mut' } });
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

  it('every trigger() carries its own call options, nothing is shared between calls', async () => {
    const { calls, wrapper } = setup();

    const { result } = renderHook(() => useMutation(TestService.method.update), { wrapper });

    await act(async () => {
      await result.current.trigger({ message: { text: 'a' }, headers: { 'x-test': 'first', 'x-first': '1' } });
    });
    await act(async () => {
      await result.current.trigger({ message: { text: 'b' } });
    });
    expect(calls[0].headers['x-test']).toEqual('first');
    expect(calls[0].headers['x-first']).toEqual('1');
    expect(Object.hasOwn(calls[1].headers, 'x-test')).toEqual(false);
    expect(Object.hasOwn(calls[1].headers, 'x-first')).toEqual(false);
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
        await result.current.trigger({ message: { text: 'x' } });
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
        await result.current.trigger({ message: { text: 'x' }, signal: controller.signal });
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
    const request = { message: { text: 'cached', big: 3n } };

    const { result, rerender } = renderHook(({ read }: { read: boolean }) => ({
      mutation: useMutation(TestService.method.echo, { populateCache: true }),
      query: useData(TestService.method.echo, read && request, { revalidateIfStale: false })
    }), { wrapper, initialProps: { read: false } });

    await act(async () => {
      await result.current.mutation.trigger(request);
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
    // headers are part of the key, so the preload and the later useData must use the same request
    const request = { message: { text: 'pre' }, headers: { 'x-test': 'preload' } };

    const { result, rerender } = renderHook(({ read }: { read: boolean }) => ({
      preload: usePreload(),
      query: useData(TestService.method.echo, read && request)
    }), { wrapper, initialProps: { read: false } });

    result.current.preload(TestService.method.echo, request);
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
  // `unstable_mutateWithTags` uses SWR's global `mutate`, which only reaches SWR's default cache, so this
  // test opts out of the isolated cache provider and uses tags unique to itself (see `createTag`)
  it('revalidates the hooks whose cacheTags match', async () => {
    const [tag, other, unrelated] = [createTag('t'), createTag('other'), createTag('unrelated')];
    const { transport, calls } = createTestTransport();
    const wrapper = createWrapper({ TayoriProvider, initTransport: () => transport, swr: { provider: undefined } });

    const { result } = renderHook(() => ({
      tagged: useData(TestService.method.echo, { message: { text: 'tagged' }, cacheTags: [tag, other] }),
      untagged: useData(TestService.method.echo, { message: { text: 'untagged' } })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.tagged.data?.text).toEqual('tagged');
      expect(result.current.untagged.data?.text).toEqual('untagged');
    });
    expect(calls.length).toEqual(2);

    await act(async () => {
      await unstable_mutateWithTags([tag]);
    });
    expect(calls.map((call) => call.request.text)).toEqual(['tagged', 'untagged', 'tagged']);

    await act(async () => {
      await unstable_mutateWithTags([unrelated]);
    });
    expect(calls.length).toEqual(3);
  });
});

// Compiled by `tsc` (part of `pnpm run typecheck`), never executed
function useTypeChecks() {
  // @ts-expect-error -- `nope` is not a field of EchoRequest
  useData(TestService.method.echo, { message: { nope: 1 } });
  // @ts-expect-error -- `text` is a string field
  useData(TestService.method.echo, { message: { text: 1 } });
  // `message` may be omitted: an empty request message
  useData(TestService.method.echo, { message: {} });
  // @ts-expect-error -- `message` is required, a request that forgot it must not compile
  useData(TestService.method.echo, { headers: { 'x-test': 'typed' } });

  const plain = useData(TestService.method.echo, { message: { text: 'a' } });
  const maybe: EchoResponse | undefined = plain.data;
  // @ts-expect-error -- without fallbackData, data may be undefined
  const notNullable: EchoResponse = plain.data;

  const withFallback = useData(
    TestService.method.echo,
    { message: { text: 'a' }, headers: { 'x-test': 'typed' }, timeoutMs: 1000, cacheTags: ['#typed'] },
    { fallbackData: create(EchoResponseSchema, { text: 'fallback' }) }
  );
  const nonNullable: EchoResponse = withFallback.data;
  // @ts-expect-error -- call options live in the request, the third argument is SWR config only
  useData(TestService.method.echo, { message: { text: 'a' } }, { headers: { 'x-test': 'typed' } });
  // @ts-expect-error -- so do cacheTags
  useData(TestService.method.echo, { message: { text: 'a' } }, { cacheTags: ['#typed'] });
  // @ts-expect-error -- `signal` only exists for mutations, SWR manages the lifecycle of useData requests
  useData(TestService.method.echo, { message: { text: 'a' }, signal: new AbortController().signal });

  const { trigger } = useMutation(TestService.method.update);
  // @ts-expect-error -- `text` is a string field
  void trigger({ message: { text: 1 } });
  const triggered: Promise<EchoResponse> = trigger({ message: { text: 'a' }, headers: { 'x-test': 'typed' }, signal: new AbortController().signal });
  // @ts-expect-error -- `signal` belongs to the trigger request, useMutation has no hook-level call options
  useMutation(TestService.method.update, { signal: new AbortController().signal });
  // @ts-expect-error -- neither do headers
  useMutation(TestService.method.update, { headers: { 'x-test': 'typed' } });

  // @ts-expect-error -- streaming methods are not unary methods
  useData(TestService.method.stream, { message: { text: 'a' } });

  return [maybe, notNullable, nonNullable, triggered] as const;
}

describe('type-level checks', () => {
  it('compiles', () => {
    expect(typeof useTypeChecks).toEqual('function');
  });
});
