import { afterEach, describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';
import type { Middleware } from 'swr';
import { mutate } from 'swr';
import sinon from 'sinon';

import { isInternalSWRKey, isZodError, tayori, unstable_mutateWithTags } from '.';
import { createFakeClient, createFakeSdk } from '../test/fake-sdk';
import type { FakeSdkOptions } from '../test/fake-sdk';
import { createWrapper } from '../test/wrapper';
import { clearTayoriDefaultCache } from '../../../test/swr-cache.cjs';

const { useData, useDataImmutable, useInfinite, useMutation, usePreload, TayoriProvider } = tayori();

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

interface Item {
  id: number
}

function setup() {
  const client = createFakeClient();
  const wrapper = createWrapper({ TayoriProvider, initClient: () => client });
  return { client, wrapper };
}

describe('useData', () => {
  it('calls the SDK method with the client, the arg, throwOnError and responseStyle, and returns .data', async () => {
    const { client, wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>((options) => ({ id: Number(options.query?.id) }));

    const { result } = renderHook(() => useData(sdk, { query: { id: 1 }, cacheTags: ['#items'] }), { wrapper });

    expect(result.current.isLoading).toEqual(true);
    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 });
    });
    // `cacheTags` is tayori's, it never reaches the SDK
    expect(calls).toEqual([{
      client,
      query: { id: 1 },
      throwOnError: true,
      responseStyle: 'fields'
    }]);
  });

  it('forces kyOptions.throwHttpErrors on the fetch path', async () => {
    const { client, wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 1 }));

    const { result } = renderHook(() => useData(sdk, { kyOptions: { retry: 0, throwHttpErrors: false } }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 });
    });
    expect(calls).toEqual([{
      client,
      kyOptions: { retry: 0, throwHttpErrors: true },
      throwOnError: true,
      responseStyle: 'fields'
    }]);
  });

  it('exposes SDK errors through SWR error', async () => {
    const { wrapper } = setup();
    const { sdk } = createFakeSdk<Item>(() => Promise.reject(new Error('boom')));

    const { result } = renderHook(() => useData(sdk, {}, { shouldRetryOnError: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeA(Error);
    });
    expect((result.current.error as Error).message).toEqual('boom');
    expect(result.current.data).toEqual(undefined);
  });

  it('pauses on a falsy arg or a falsy / throwing arg function', async () => {
    const { wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 1 }));

    const { result } = renderHook(() => ({
      nil: useData(sdk, null),
      nullish: useData(sdk, () => null),
      throwing: useData(sdk, () => {
        throw new Error('not ready yet');
      })
    }), { wrapper });

    await settle();
    expectPaused(result.current.nil);
    expectPaused(result.current.nullish);
    expectPaused(result.current.throwing);
    expect(calls.length).toEqual(0);
  });

  it('dedupes hooks with the same SDK method and arg into one request', async () => {
    const { wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 1 }));

    const { result } = renderHook(() => ({
      a: useData(sdk, { query: { id: 1 } }),
      b: useData(sdk, { query: { id: 1 } })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.a.data).toEqual({ id: 1 });
      expect(result.current.b.data).toEqual({ id: 1 });
    });
    expect(calls.length).toEqual(1);
  });
});

describe('useDataImmutable', () => {
  it('returns .data', async () => {
    const { wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 2 }));

    const { result } = renderHook(() => useDataImmutable(sdk, { path: { id: 2 } }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 2 });
    });
    expect(calls.length).toEqual(1);
    expect(calls[0].path).toEqual({ id: 2 });
  });
});

describe('useInfinite', () => {
  it('pages with the arg returned by the loader', async () => {
    const { wrapper } = setup();
    const { sdk, calls } = createFakeSdk<{ items: Item[], nextCursor: string | null }>((options) => {
      const cursor = options.query?.cursor;
      return cursor === 'c2'
        ? { items: [{ id: 2 }], nextCursor: null }
        : { items: [{ id: 1 }], nextCursor: 'c2' };
    });

    const { result } = renderHook(() => useInfinite(sdk, (_pageIndex, previous) => {
      if (previous && !previous.nextCursor) return null; // reached the end
      return { query: { cursor: previous?.nextCursor } };
    }, {
      // SWR infinite option, passed through untouched: don't refetch page 1 whenever a page is added
      revalidateFirstPage: false
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.length).toEqual(1);
    });
    await act(async () => {
      await result.current.setSize(2);
    });
    await waitFor(() => {
      expect(result.current.data?.length).toEqual(2);
    });
    expect(result.current.data?.flatMap((page) => page.items)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(calls.map((call) => call.query)).toEqual([{ cursor: undefined }, { cursor: 'c2' }]);
  });
});

describe('useMutation', () => {
  it('trigger() passes the arg through (cacheTags stripped, ky errors forced like the fetch path) and resolves with .data', async () => {
    const { client, wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 3 }));

    const { result } = renderHook(() => useMutation(sdk), { wrapper });

    let response: Item | undefined;
    await act(async () => {
      response = await result.current.trigger({ body: { name: 'x' }, kyOptions: { retry: 0 }, cacheTags: ['#items'] });
    });
    expect(response).toEqual({ id: 3 });
    expect(result.current.data).toEqual({ id: 3 });
    expect(result.current.isMutating).toEqual(false);
    // the mutation path goes through the same SDK call as the fetch path
    expect(calls).toEqual([{
      client,
      body: { name: 'x' },
      kyOptions: { retry: 0, throwHttpErrors: true },
      throwOnError: true,
      responseStyle: 'fields'
    }]);
  });

  it('trigger() rethrows SDK errors and reports them through error / onError', async () => {
    const { wrapper } = setup();
    const { sdk } = createFakeSdk<Item>(() => Promise.reject(new Error('rejected')));
    const onError = sinon.spy();

    const { result } = renderHook(() => useMutation(sdk, { onError }), { wrapper });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.trigger({});
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toBeA(Error);
    expect((caught as Error).message).toEqual('rejected');
    expect(caught as Error).toExactlyEqual(result.current.error);
    expect(onError.calledOnce).toEqual(true);
  });

  it('populateCache: true writes the result into the slot useData reads from', async () => {
    const { wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 4 }));
    const arg = { query: { id: 4 } };

    const { result, rerender } = renderHook(({ read }: { read: boolean }) => ({
      mutation: useMutation(sdk, { populateCache: true }),
      query: useData(sdk, read && arg, { revalidateIfStale: false })
    }), { wrapper, initialProps: { read: false } });

    await act(async () => {
      await result.current.mutation.trigger(arg);
    });
    rerender({ read: true });
    expect(result.current.query.data).toEqual({ id: 4 });
    await settle();
    expect(calls.length).toEqual(1);
  });
});

describe('usePreload', () => {
  it('preloads a request that a later useData reuses without a second fetch', async () => {
    const { wrapper } = setup();
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 5 }));
    const arg = { query: { id: 5 } };

    const { result, rerender } = renderHook(({ read }: { read: boolean }) => ({
      preload: usePreload(),
      query: useData(sdk, read && arg)
    }), { wrapper, initialProps: { read: false } });

    result.current.preload(sdk, arg);
    await waitFor(() => {
      expect(calls.length).toEqual(1);
    });
    rerender({ read: true });
    // the preloaded response is a promise, so it is not available synchronously
    expect(result.current.query.isLoading).toEqual(true);
    await waitFor(() => {
      expect(result.current.query.data).toEqual({ id: 5 });
    });
    await settle();
    expect(calls.length).toEqual(1);
  });
});

describe('TayoriProvider', () => {
  it('runs initClient once per provider instance', async () => {
    const client = createFakeClient();
    const initClient = sinon.spy(() => client);
    const wrapper = createWrapper({ TayoriProvider, initClient });
    const { sdk, calls } = createFakeSdk<Item>(() => ({ id: 1 }));

    const { result, rerender } = renderHook(() => useData(sdk, {}), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 });
    });
    rerender();
    rerender();
    expect(initClient.callCount).toEqual(1);
    expect(client).toExactlyEqual(calls[0].client);
  });
});

describe('isInternalSWRKey', () => {
  it('recognizes the keys tayori builds and rejects everything else', async () => {
    const client = createFakeClient();
    const { sdk } = createFakeSdk<Item>(() => ({ id: 1 }));
    const keys: unknown[] = [];
    const spy: Middleware = (useSWRNext) => (key, fetcher, config) => {
      keys.push(key);
      return useSWRNext(key, fetcher, config);
    };
    const wrapper = createWrapper({ TayoriProvider, initClient: () => client, swr: { use: [spy] } });

    const { result } = renderHook(() => useData(sdk, { query: { id: 1 }, cacheTags: ['#items'] }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 });
    });
    const key = keys[0];
    expect(isInternalSWRKey(key)).toEqual(true);
    if (!isInternalSWRKey(key)) {
      throw new Error('unreachable');
    }
    if (typeof key === 'function') {
      throw new TypeError('expected a resolved key array');
    }
    // [client, sdkMethod, argWithoutCacheTags, cacheTags]
    expect(Array.from(key)).toEqual([client, sdk, { query: { id: 1 } }, ['#items']]);

    expect(isInternalSWRKey(null)).toEqual(false);
    expect(isInternalSWRKey('/api/items')).toEqual(false);
    expect(isInternalSWRKey([client, sdk, { query: { id: 1 } }, undefined])).toEqual(false);
    expect(isInternalSWRKey(() => [client, sdk, {}, undefined])).toEqual(false);
  });
});

describe('unstable_mutateWithTags', () => {
  // `unstable_mutateWithTags` uses SWR's global `mutate`, which only reaches the default cache, so these
  // tests share it and clear every tayori entry afterwards (inside act: the hooks are still mounted)
  afterEach(() => clearTayoriDefaultCache());

  it('revalidates the hooks whose cacheTags match', async () => {
    const client = createFakeClient();
    const wrapper = createWrapper({ TayoriProvider, initClient: () => client, swr: { provider: undefined } });
    const { sdk, calls } = createFakeSdk<Item>((options) => ({ id: Number(options.query?.id) }));

    const { result } = renderHook(() => ({
      tagged: useData(sdk, { query: { id: 1 }, cacheTags: ['#t', '#other'] }),
      untagged: useData(sdk, { query: { id: 2 } })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.tagged.data).toEqual({ id: 1 });
      expect(result.current.untagged.data).toEqual({ id: 2 });
    });
    expect(calls.length).toEqual(2);

    await act(async () => {
      await unstable_mutateWithTags(['#t']);
    });
    expect(calls.map((call) => call.query)).toEqual([{ id: 1 }, { id: 2 }, { id: 1 }]);

    await act(async () => {
      await unstable_mutateWithTags(['#unrelated']);
    });
    expect(calls.length).toEqual(3);
  });
});

describe('isZodError', () => {
  it('duck-types on an `issues` array', () => {
    expect(isZodError({ issues: [] })).toEqual(true);
    expect(isZodError({ issues: [{ message: 'Required' }] })).toEqual(true);
    expect(isZodError(new Error('boom'))).toEqual(false);
    expect(isZodError({ issues: 'nope' })).toEqual(false);
    expect(isZodError(null)).toEqual(false);
    expect(isZodError(undefined)).toEqual(false);
  });
});

// Compiled by `tsc` (part of `pnpm run typecheck`), never executed
function useTypeChecks() {
  const { sdk } = createFakeSdk<Item>(() => ({ id: 1 }));

  // @ts-expect-error -- `nope` is not an SDK option
  useData(sdk, { nope: 1 });
  // @ts-expect-error -- tayori forces responseStyle, callers cannot set it
  useData(sdk, { responseStyle: 'data' });

  const plain = useData(sdk, { query: { id: 1 } });
  const maybe: Item | undefined = plain.data;
  // @ts-expect-error -- without fallbackData, data may be undefined
  const notNullable: Item = plain.data;

  const withFallback = useData(sdk, { query: { id: 1 } }, { fallbackData: { id: 0 } });
  const nonNullable: Item = withFallback.data;

  const { trigger } = useMutation(sdk);
  // @ts-expect-error -- `query` must be an object
  const rejected: Promise<Item> = trigger({ query: 1 });
  const triggered: Promise<Item> = trigger({ query: { id: 1 } });

  const preload = usePreload();
  // @ts-expect-error -- `nope` is not an SDK option
  preload(sdk, { nope: 1 });

  return [maybe, notNullable, nonNullable, rejected, triggered] as const;
}

describe('type-level checks', () => {
  it('compiles', () => {
    expect(typeof useTypeChecks).toEqual('function');
    // the fake SDK option type is what the checks above rely on
    const options: FakeSdkOptions = { query: {}, throwOnError: true, responseStyle: 'fields' };
    expect(options.responseStyle).toEqual('fields');
  });
});
