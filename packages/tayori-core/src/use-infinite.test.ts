import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { unstable_serialize, useSWRConfig } from 'swr';

import { createTayori } from '.';
import type { TayoriFetchOptions } from '.';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeArg, FakeCallOptions, FakeClient } from '../test/fake-backend';
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

    const { result } = renderHook(() => instance.useInfinite<string>('List', (pageIndex) => ({ id: pageIndex + 1 })), { wrapper });

    expect(result.current.isLoading).toEqual(true);
    await waitFor(() => {
      expect(result.current.data).toEqual(['c1:List:1']);
    });
    expect(backend.calls).toEqual([{ via: 'fetch', client, method: 'List', arg: { id: 1 }, callOptions: undefined }]);
  });

  it('setSize(2) loads the next page and hands previousPageData to the loader', async () => {
    const { backend, client, instance, wrapper } = setup();
    const loaderCalls: Array<[pageIndex: number, previousPageData: string | null]> = [];

    const { result } = renderHook(() => instance.useInfinite<string>(
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
      { via: 'fetch', client, method: 'List', arg: { id: 1 }, callOptions: undefined },
      { via: 'fetch', client, method: 'List', arg: { id: 2 }, callOptions: undefined }
    ]);
    // the second page was requested with the data of the first page
    expect(loaderCalls).toInclude([1, 'c1:List:1']);
  });

  it('stops loading pages once the loader returns a falsy value', async () => {
    const { backend, instance, wrapper } = setup();

    const { result } = renderHook(() => instance.useInfinite<string>(
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
      paused: instance.useInfinite<string>('List', () => null),
      active: instance.useInfinite<string>('Other', () => ({ id: 1 }))
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.active.data).toEqual(['c1:Other:1']);
    });
    expect(result.current.paused.data).toEqual(undefined);
    expect(result.current.paused.isLoading).toEqual(false);
    expect(backend.calls.map((call) => call.method)).toEqual(['Other']);
  });

  it('puts cacheTags into every page key (options win over arg-level tags) and forwards callOptions', async () => {
    const { backend, client, instance, wrapper } = setup();

    const { result } = renderHook(() => ({
      list: instance.useInfinite<string>(
        'List',
        (pageIndex) => ({ id: pageIndex + 1, cacheTags: ['#arg'] }),
        { revalidateFirstPage: false },
        { callOptions: { header: 'x' } }
      ),
      tagged: instance.useInfinite<string>(
        'Tagged',
        (pageIndex) => ({ id: pageIndex + 1, cacheTags: ['#arg'] }),
        { revalidateFirstPage: false },
        { cacheTags: ['#opt'] }
      ),
      swr: useSWRConfig()
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.list.data).toEqual(['c1:List:1']);
    });
    await waitFor(() => {
      expect(result.current.tagged.data).toEqual(['c1:Tagged:1']);
    });

    // Every page lives in the cache under the same key `useData` would build for it
    const { cache } = result.current.swr;
    const cachedPage = (method: string, arg: FakeArg, options?: TayoriFetchOptions<FakeCallOptions>) => cache.get(unstable_serialize(instance.getKey(client, method, arg, options)))?.data;

    // arg-level tags are part of the page key
    expect(cachedPage('List', { id: 1, cacheTags: ['#arg'] })).toEqual('c1:List:1');
    expect(cachedPage('List', { id: 1 })).toEqual(undefined);
    // options.cacheTags replace arg-level tags
    expect(cachedPage('Tagged', { id: 1 }, { cacheTags: ['#opt'] })).toEqual('c1:Tagged:1');
    expect(cachedPage('Tagged', { id: 1, cacheTags: ['#arg'] })).toEqual(undefined);
    // call options ride along with the key to the backend
    expect(backend.calls.map((call) => call.callOptions)).toEqual([{ header: 'x' }, undefined]);
  });
});
