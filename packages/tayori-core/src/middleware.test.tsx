import { describe, it } from 'mocha';
import { expect } from 'earl';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import useSWR, { SWRConfig } from 'swr';
import type { SWRConfiguration } from 'swr';

import { createTayori } from '.';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

/** An isolated SWR cache (a fresh Map per mount) with request dedupe disabled */
const isolatedSwr: SWRConfiguration = { provider: () => new Map(), dedupingInterval: 0 };
/** Same, plus a global fetcher that must never be used for tayori keys */
const hijackingSwr: SWRConfiguration = { ...isolatedSwr, fetcher: () => 'hijacked' };

function Isolated({ children }: React.PropsWithChildren) {
  return <SWRConfig value={isolatedSwr}>{children}</SWRConfig>;
}

describe('SWR middleware', () => {
  it('nested instances of different backends fetch through their own backend and client', async () => {
    const backendA = createFakeBackend('alpha');
    const backendB = createFakeBackend('beta');
    const clientA: FakeClient = { name: 'a' };
    const clientB: FakeClient = { name: 'b' };
    const instanceA = createTayori(backendA);
    const instanceB = createTayori(backendB);

    function Wrapper({ children }: React.PropsWithChildren) {
      return (
        <instanceA.TayoriProvider initClient={() => clientA}>
          <instanceB.TayoriProvider initClient={() => clientB}>
            <Isolated>{children}</Isolated>
          </instanceB.TayoriProvider>
        </instanceA.TayoriProvider>
      );
    }

    const { result } = renderHook(() => ({
      a: instanceA.useData<string>('Get', { id: 1 }),
      b: instanceB.useData<string>('Get', { id: 2 })
    }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.a.data).toEqual('a:Get:1');
    });
    await waitFor(() => {
      expect(result.current.b.data).toEqual('b:Get:2');
    });

    expect(backendA.calls).toEqual([{ via: 'fetch', client: clientA, method: 'Get', arg: { id: 1 }, callOptions: undefined }]);
    expect(backendB.calls).toEqual([{ via: 'fetch', client: clientB, method: 'Get', arg: { id: 2 }, callOptions: undefined }]);
  });

  it('leaves userland useSWR keys and their fetchers untouched', async () => {
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => useSWR(['foreign', 1], ([name, id]) => Promise.resolve(`own:${name}:${id}`)), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual('own:foreign:1');
    });
    expect(backend.calls).toEqual([]);
  });

  it('ignores a global SWRConfig fetcher configured above the provider', async () => {
    const backend = createFakeBackend();
    const client: FakeClient = { name: 'c1' };
    const instance = createTayori(backend);

    function Wrapper({ children }: React.PropsWithChildren) {
      return (
        <SWRConfig value={hijackingSwr}>
          <instance.TayoriProvider initClient={() => client}>
            {children}
          </instance.TayoriProvider>
        </SWRConfig>
      );
    }

    const { result } = renderHook(() => ({
      tayori: instance.useData<string>('Get', { id: 1 }),
      // no fetcher given: SWR falls back to the global one
      plain: useSWR<string>('plain')
    }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.plain.data).toEqual('hijacked');
    });
    await waitFor(() => {
      expect(result.current.tayori.data).toEqual('c1:Get:1');
    });
    expect(backend.calls).toEqual([{ via: 'fetch', client, method: 'Get', arg: { id: 1 }, callOptions: undefined }]);
  });

  it('reports a hook rendered outside of <TayoriProvider /> through SWR error', async () => {
    const backend = createFakeBackend('lonely');
    const instance = createTayori(backend);

    // The sentinel fetcher throws synchronously while SWR mounts, before anything outside the
    // render could have read the response. SWR only re-renders for fields a render touched, so
    // read them during render, exactly like a real component would.
    const { result } = renderHook(() => {
      const { data, error } = instance.useData('Get', { id: 1 }, { shouldRetryOnError: false });
      return { data, error };
    }, { wrapper: Isolated });

    await waitFor(() => {
      expect(result.current.error).toBeA(Error);
    });
    expect((result.current.error as Error).message).toInclude('lonely', '<TayoriProvider />');
    expect(result.current.data).toEqual(undefined);
    expect(backend.calls).toEqual([]);
  });

  it('nested providers of the same instance give the inner subtree its own client and cache entries', async () => {
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    const outer: FakeClient = { name: 'outer' };
    const inner: FakeClient = { name: 'inner' };

    function Probe() {
      const { data } = instance.useData<string>('Get', { id: 1 });
      return <output>{data ?? 'loading'}</output>;
    }

    render(
      <Isolated>
        <instance.TayoriProvider initClient={() => outer}>
          <Probe />
          <instance.TayoriProvider initClient={() => inner}>
            <Probe />
          </instance.TayoriProvider>
        </instance.TayoriProvider>
      </Isolated>
    );

    await screen.findByText('outer:Get:1');
    await screen.findByText('inner:Get:1');

    expect(backend.calls.length).toEqual(2);
    expect(backend.calls.map((call) => call.client.name).sort()).toEqual(['inner', 'outer']);
  });
});
