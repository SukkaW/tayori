import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';

import { createTayori } from '.';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

describe('useData', () => {
  it('fetches through the backend with the client from the key', async () => {
    const backend = createFakeBackend();
    const client: FakeClient = { name: 'c1' };
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => client });

    const { result } = renderHook(() => instance.useData('Get', { id: 1 }), { wrapper });

    expect(result.current.isLoading).toEqual(true);
    await waitFor(() => {
      expect(result.current.data).toEqual('c1:Get:1');
    });
    expect(backend.calls).toEqual([{ client, method: 'Get', arg: { id: 1 } }]);
  });

  it('exposes backend errors through SWR error', async () => {
    const backend = createFakeBackend();
    backend.respond = () => Promise.reject(new Error('boom'));
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => instance.useData('Get', { id: 1 }, { shouldRetryOnError: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeA(Error);
    });
    expect((result.current.error as Error).message).toEqual('boom');
  });
});

describe('useDataImmutable', () => {
  it('never revalidates an entry that is already cached, unlike useData', async () => {
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result, rerender } = renderHook(({ mountSecond }: { mountSecond: boolean }) => ({
      immutable: instance.useDataImmutable('Get', { id: 1 }),
      immutableAgain: instance.useDataImmutable('Get', mountSecond && { id: 1 }),
      mutable: instance.useData('Get', { id: 2 }),
      mutableAgain: instance.useData('Get', mountSecond && { id: 2 })
    }), { wrapper, initialProps: { mountSecond: false } });

    await waitFor(() => {
      expect(result.current.immutable.data).toEqual('c1:Get:1');
    });
    await waitFor(() => {
      expect(result.current.mutable.data).toEqual('c1:Get:2');
    });
    expect(backend.calls.length).toEqual(2);

    // a second consumer of each cached entry shows up
    rerender({ mountSecond: true });

    // useData revalidates the stale entry, useDataImmutable serves it from the cache only
    await waitFor(() => {
      expect(backend.calls.length).toEqual(3);
    });
    expect(backend.calls[2].arg).toEqual({ id: 2 });
    expect(result.current.immutableAgain.data).toEqual('c1:Get:1');
  });
});

describe('useData requests that cannot be keyed', () => {
  it('treats them as not ready and pauses, for object and function args alike, like a throwing SWR key function', async () => {
    const backend = createFakeBackend();
    backend.argKey = (_method, arg) => {
      if (arg.id === 13) throw new Error('cannot serialize');
      const { cacheTags, ...rest } = arg;
      return [rest, cacheTags];
    };
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    // SWR only re-renders for the fields a render has read, so read them during render
    const { result } = renderHook(() => {
      const object = instance.useData('Get', { id: 13 });
      const thunk = instance.useData('Get', () => ({ id: 13 }));
      return [object, thunk].map(({ isLoading, data, error }) => ({ isLoading, data, error }));
    }, { wrapper });

    // eslint-disable-next-line sukka/prefer-foxts-wait -- foxts is not a dependency of tayori-core
    await act(() => delay(20));
    expect(result.current).toEqual([
      { isLoading: false, data: undefined, error: undefined },
      { isLoading: false, data: undefined, error: undefined }
    ]);
    expect(backend.calls).toEqual([]);
  });
});
