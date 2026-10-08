import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSWRConfig } from 'swr';

import { createTayori } from '.';
import { createFakeBackend } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

// SWR's own cache tags (SWR 2.6+): the `tags` SWR option is forwarded untouched, so `revalidateTag`
// from the nearest `<SWRConfig />` refetches tagged tayori hooks. Tags are not part of the key.
describe('SWR tags', () => {
  it('revalidateTag() refetches the useData and useInfinite hooks tagged through the SWR options', async () => {
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => ({
      tagged: instance.useData('Get', { id: 1 }, { tags: ['items'] }).data,
      untagged: instance.useData('Get', { id: 2 }).data,
      list: instance.useInfinite('List', (pageIndex) => ({ id: pageIndex + 1 }), { tags: ['items'] }).data,
      swr: useSWRConfig()
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.tagged).toEqual('c1:Get:1');
      expect(result.current.untagged).toEqual('c1:Get:2');
      expect(result.current.list).toEqual(['c1:List:1']);
    });
    expect(backend.calls.length).toEqual(3);

    // the tagged useData refetches; the tagged useInfinite list refetches its first page, as any
    // revalidation of an infinite list does
    await act(() => result.current.swr.revalidateTag('items'));
    await waitFor(() => {
      expect(backend.calls.length).toEqual(5);
    });
    expect(backend.calls.slice(3).map((call) => `${call.method}:${call.arg.id}`).sort()).toEqual(['Get:1', 'List:1']);

    await act(() => result.current.swr.revalidateTag('unrelated'));
    expect(backend.calls.length).toEqual(5);
  });
});
