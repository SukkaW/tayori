import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { mutate } from 'swr';

import { createTayori, isTayoriKey, unstable_mutateWithTags, unstable_useMutateWithTags } from '.';
import { createFakeBackend } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';
import { createTag } from '../test/cache-tag';

describe('useMutateWithTags', () => {
  it('revalidates tagged entries in the nearest SWR cache provider, which the global mutateWithTags cannot reach', async () => {
    const tag = createTag('t');
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    // createWrapper installs an isolated `provider: () => new Map()` cache
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => {
      const tagged = instance.useData('Get', { id: 1, cacheTags: [tag] }).data;
      const untagged = instance.useData('Get', { id: 2 }).data;
      return { tagged, untagged, invalidate: unstable_useMutateWithTags() };
    }, { wrapper });

    await waitFor(() => {
      expect(result.current.tagged).toEqual('c1:Get:1');
      expect(result.current.untagged).toEqual('c1:Get:2');
    });
    expect(backend.calls.length).toEqual(2);

    // the global helper only sees SWR's default cache, so nothing happens here
    await act(() => unstable_mutateWithTags([tag]));
    expect(backend.calls.length).toEqual(2);

    // the hook is bound to the isolated cache of the wrapper
    await act(() => result.current.invalidate([tag]));
    await waitFor(() => {
      expect(backend.calls.length).toEqual(3);
    });
    expect(backend.calls[2].arg).toEqual({ id: 1, cacheTags: [tag] });
  });

  it('returns a stable function', () => {
    const instance = createTayori(createFakeBackend());
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result, rerender } = renderHook(() => unstable_useMutateWithTags(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toExactlyEqual(first);
  });
});
