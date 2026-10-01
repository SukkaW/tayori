import { describe, it } from 'mocha';
import { expect } from 'earl';
import { renderHook, waitFor } from '@testing-library/react';

import { createTayori } from '.';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

// SWR keeps preloaded requests in a global map keyed by the serialized key, so a dedicated
// client name keeps these entries from ever colliding with the keys of other test files.
function setup() {
  const backend = createFakeBackend();
  const client: FakeClient = { name: 'preloader' };
  const instance = createTayori(backend);
  const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => client });
  return { backend, client, instance, wrapper };
}

describe('usePreload', () => {
  it('fetches through the backend once and a later useData reuses the preloaded request', async () => {
    const { backend, client, instance, wrapper } = setup();

    const { result: preload } = renderHook(() => instance.usePreload(), { wrapper });
    preload.current('Get', { id: 1, timeout: 5 });
    // preloading the same request again before it is consumed is a no-op
    preload.current('Get', { id: 1 });

    expect(backend.calls).toEqual([{ client, method: 'Get', arg: { id: 1, timeout: 5 } }]);

    const { result } = renderHook(() => instance.useData<string>('Get', { id: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual('preloader:Get:1');
    });
    expect(backend.calls.length).toEqual(1);
  });

  it('only requests with a matching key reuse the preload', async () => {
    const { backend, instance, wrapper } = setup();

    const { result: preload } = renderHook(() => instance.usePreload(), { wrapper });
    preload.current('Get', { id: 1, cacheTags: ['#tag'] });

    const { result } = renderHook(() => ({
      tagged: instance.useData<string>('Get', { id: 1, cacheTags: ['#tag'] }),
      untagged: instance.useData<string>('Get', { id: 1 })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.tagged.data).toEqual('preloader:Get:1');
    });
    await waitFor(() => {
      expect(result.current.untagged.data).toEqual('preloader:Get:1');
    });
    // the preload itself plus one real fetch for the key that did not match
    expect(backend.calls.length).toEqual(2);
  });
});
