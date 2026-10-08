import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';
import { unstable_serialize, useSWRConfig } from 'swr';

import { createTayori } from '.';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeArg, FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

function setup() {
  const backend = createFakeBackend();
  const client: FakeClient = { name: 'c1' };
  const instance = createTayori(backend);
  const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => client });
  return { backend, client, instance, wrapper };
}

describe('useInfinite', () => {
  it('fetches the first page through the backend with the client from the provider', async () => {
    const { backend, client, instance, wrapper } = setup();

    const { result } = renderHook(() => instance.useInfinite('List', (pageIndex) => ({ id: pageIndex + 1 })), { wrapper });

    expect(result.current.isLoading).toEqual(true);
    await waitFor(() => {
      expect(result.current.data).toEqual(['c1:List:1']);
    });
    expect(backend.calls).toEqual([{ client, method: 'List', arg: { id: 1 } }]);
  });

  it('setSize(2) loads the next page and hands previousPageData to the loader', async () => {
    const { backend, client, instance, wrapper } = setup();
    const loaderCalls: Array<[pageIndex: number, previousPageData: string | null]> = [];

    const { result } = renderHook(() => instance.useInfinite(
      'List',
      (pageIndex, previousPageData) => {
        loaderCalls.push([pageIndex, previousPageData]);
        return { id: pageIndex + 1 };
      },
      { revalidateFirstPage: false }
    ), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(['c1:List:1']);
    });
    expect(loaderCalls[0]).toEqual([0, null]);

    await act(async () => {
      await result.current.setSize(2);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(['c1:List:1', 'c1:List:2']);
    });
    expect(result.current.size).toEqual(2);
    expect(backend.calls).toEqual([
      { client, method: 'List', arg: { id: 1 } },
      { client, method: 'List', arg: { id: 2 } }
    ]);
    // the second page was requested with the data of the first page
    expect(loaderCalls).toInclude([1, 'c1:List:1']);
  });

  it('stops loading pages once the loader returns a falsy value', async () => {
    const { backend, instance, wrapper } = setup();

    const { result } = renderHook(() => instance.useInfinite(
      'List',
      (pageIndex) => (pageIndex < 2 ? { id: pageIndex + 1 } : null),
      { initialSize: 5, revalidateFirstPage: false }
    ), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(['c1:List:1', 'c1:List:2']);
    });
    expect(backend.calls.map((call) => call.arg)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('a falsy first page pauses the request entirely', async () => {
    const { backend, instance, wrapper } = setup();

    const { result } = renderHook(() => ({
      paused: instance.useInfinite('List', () => null),
      active: instance.useInfinite('Other', () => ({ id: 1 }))
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.active.data).toEqual(['c1:Other:1']);
    });
    expect(result.current.paused.data).toEqual(undefined);
    expect(result.current.paused.isLoading).toEqual(false);
    expect(backend.calls.map((call) => call.method)).toEqual(['Other']);
  });

  it('stores every page under the key useData would build for the same request, and sends that request', async () => {
    const { backend, client, instance, wrapper } = setup();

    const { result } = renderHook(() => ({
      list: instance.useInfinite(
        'List',
        (pageIndex) => ({ id: pageIndex + 1, timeout: 7 }),
        { revalidateFirstPage: false }
      ),
      swr: useSWRConfig()
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.list.data).toEqual(['c1:List:1']);
    });

    // Every page lives in the cache under the same key `useData` would build for it
    const { cache } = result.current.swr;
    const cachedPage = (method: string, arg: FakeArg) => cache.get(unstable_serialize(instance.getKey(client, method, arg)))?.data;

    expect(cachedPage('List', { id: 1, timeout: 7 })).toEqual('c1:List:1');
    // keys are lossless, so another `timeout` (or none) is another request
    expect(cachedPage('List', { id: 1, timeout: 99 })).toEqual(undefined);
    expect(cachedPage('List', { id: 1 })).toEqual(undefined);
    // the backend receives the request stored in the page key
    expect(backend.calls.map((call) => call.arg)).toEqual([{ id: 1, timeout: 7 }]);
  });
});

// The loader goes to SWR as is, so SWR's semantics for a throwing key loader apply: "not ready" on the
// first page (SWR builds it during render, inside a try/catch), the hook's `error` on later pages
// (SWR builds them inside its fetcher).
describe('useInfinite requests that cannot be keyed', () => {
  it('pause the hook when it is the first page', async () => {
    const backend = createFakeBackend();
    backend.argKey = (_method, arg) => {
      if (arg.id === 13) throw new Error('cannot serialize');
      return arg;
    };
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => {
      const { isLoading, data, error } = instance.useInfinite('Get', () => ({ id: 13 }));
      return { isLoading, data, error };
    }, { wrapper });

    // eslint-disable-next-line sukka/prefer-foxts-wait -- foxts is not a dependency of tayori-core
    await act(() => delay(20));
    expect(result.current).toEqual({ isLoading: false, data: undefined, error: undefined });
    expect(backend.calls).toEqual([]);
  });

  it('surface through SWR error when it is a later page', async () => {
    const backend = createFakeBackend();
    backend.argKey = (_method, arg) => {
      if (arg.id === 13) throw new Error('cannot serialize');
      return arg;
    };
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => {
      const { data, error } = instance.useInfinite('Get', (pageIndex) => ({ id: pageIndex === 0 ? 1 : 13 }), { initialSize: 2, shouldRetryOnError: false });
      return { data, error };
    }, { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeA(Error);
    });
    expect((result.current.error as Error).message).toEqual('cannot serialize');
    expect(backend.calls.map((call) => call.arg)).toEqual([{ id: 1 }]);
  });
});
