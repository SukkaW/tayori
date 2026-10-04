import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
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

  it('puts arg-level cacheTags into every page key and forwards the whole arg to the backend', async () => {
    const { backend, client, instance, wrapper } = setup();

    const { result } = renderHook(() => ({
      list: instance.useInfinite(
        'List',
        (pageIndex) => ({ id: pageIndex + 1, cacheTags: ['#arg'], timeout: 7 }),
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

    // cacheTags are part of the page key
    expect(cachedPage('List', { id: 1, cacheTags: ['#arg'] })).toEqual('c1:List:1');
    expect(cachedPage('List', { id: 1 })).toEqual(undefined);
    // `timeout` is not part of the key (see the fake backend), but the whole arg reaches the backend
    expect(cachedPage('List', { id: 1, cacheTags: ['#arg'], timeout: 99 })).toEqual('c1:List:1');
    expect(backend.calls.map((call) => call.arg)).toEqual([{ id: 1, cacheTags: ['#arg'], timeout: 7 }]);
  });
});

describe('useInfinite key building errors', () => {
  it('surfaces errors thrown by backend.argKey through SWR error instead of pausing', async () => {
    const backend = createFakeBackend();
    backend.argKey = (_method, arg) => {
      if (arg.id === 13) throw new Error('cannot serialize page');
      const { cacheTags, ...rest } = arg;
      return [rest, cacheTags];
    };
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => {
      const { data, error } = instance.useInfinite('Get', () => ({ id: 13 }), { shouldRetryOnError: false });
      return { data, error };
    }, { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeA(Error);
    });
    expect((result.current.error as Error).message).toEqual('cannot serialize page');
    expect(backend.calls).toEqual([]);
  });
});
