import { describe, it, afterEach } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import useSWR, { mutate } from 'swr';

import { createTayori, isTayoriKey, unstable_mutateWithTags } from '.';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeArg, FakeBackend, FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

const fetchedIds = (backend: FakeBackend) => backend.calls.map((call) => (call.arg as FakeArg).id);

describe('unstable_mutateWithTags', () => {
  // mutateWithTags goes through SWR's global `mutate`, which only reaches the default SWR cache.
  // So these tests opt out of the isolated cache provider, and afterwards reset every tayori entry
  // of the default cache so that no test sees the data of another one.
  afterEach(async () => {
    await act(async () => {
      await mutate(isTayoriKey, undefined, { revalidate: false });
    });
  });

  it('revalidates exactly the entries sharing a tag (thunk args included) and nothing else', async () => {
    const backend = createFakeBackend();
    const client: FakeClient = { name: 'tags' };
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => client, swr: { provider: undefined } });
    let plainFetches = 0;

    const { result } = renderHook(() => ({
      a: instance.useData<string>('Get', { id: 1, cacheTags: ['#a'] }),
      ab: instance.useData<string>('Get', () => ({ id: 2 }), undefined, { cacheTags: ['#a', '#b'] }),
      untagged: instance.useData<string>('Get', { id: 3 }),
      plain: useSWR('plain-key', () => {
        plainFetches += 1;
        return 'plain';
      })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.a.data).toEqual('tags:Get:1');
    });
    await waitFor(() => {
      expect(result.current.ab.data).toEqual('tags:Get:2');
    });
    await waitFor(() => {
      expect(result.current.untagged.data).toEqual('tags:Get:3');
    });
    await waitFor(() => {
      expect(result.current.plain.data).toEqual('plain');
    });
    expect(fetchedIds(backend)).toEqual([1, 2, 3]);

    // only the thunk-arg entry carries #b
    let revalidated: unknown[] = [];
    await act(async () => {
      revalidated = await unstable_mutateWithTags(['#b']);
    });
    expect(revalidated).toEqual(['tags:Get:2']);
    expect(fetchedIds(backend).slice(3)).toEqual([2]);

    // both tagged entries carry #a
    await act(async () => {
      await unstable_mutateWithTags(['#a']);
    });
    expect(fetchedIds(backend).slice(4).sort()).toEqual([1, 2]);

    // unknown tags match nothing
    await act(async () => {
      await unstable_mutateWithTags(['#nobody']);
    });
    expect(backend.calls.length).toEqual(6);

    // the untagged tayori entry and the userland SWR entry were never touched
    expect(fetchedIds(backend).slice(3)).not.toInclude(3);
    expect(plainFetches).toEqual(1);
  });

  it('matches tagged entries of every tayori instance and backend', async () => {
    const backendA = createFakeBackend('alpha');
    const backendB = createFakeBackend('beta');
    const instanceA = createTayori(backendA);
    const instanceB = createTayori(backendB);
    const wrapperA = createWrapper({ Provider: instanceA.TayoriProvider, initClient: () => ({ name: 'tags-alpha' }), swr: { provider: undefined } });
    const wrapperB = createWrapper({ Provider: instanceB.TayoriProvider, initClient: () => ({ name: 'tags-beta' }), swr: { provider: undefined } });

    // Two separate component trees: each reads `data` during render (as a real component would),
    // otherwise SWR would not re-render the tree whose fetch settles while the other one is awaited.
    const { result: a } = renderHook(() => instanceA.useData<string>('Get', { id: 1, cacheTags: ['#shared'] }).data, { wrapper: wrapperA });
    const { result: b } = renderHook(() => instanceB.useData<string>('Get', { id: 1, cacheTags: ['#shared'] }).data, { wrapper: wrapperB });

    await waitFor(() => {
      expect(a.current).toEqual('tags-alpha:Get:1');
    });
    await waitFor(() => {
      expect(b.current).toEqual('tags-beta:Get:1');
    });

    await act(async () => {
      await unstable_mutateWithTags(['#shared']);
    });

    expect(backendA.calls.length).toEqual(2);
    expect(backendB.calls.length).toEqual(2);
  });
});
