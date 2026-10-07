import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import useSWR, { SWRConfig } from 'swr';
import type { Middleware, SWRConfiguration } from 'swr';

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

describe('SWR fetcher integration', () => {
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
      a: instanceA.useData('Get', { id: 1 }),
      b: instanceB.useData('Get', { id: 2 })
    }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.a.data).toEqual('a:Get:1');
    });
    await waitFor(() => {
      expect(result.current.b.data).toEqual('b:Get:2');
    });

    expect(backendA.calls).toEqual([{ client: clientA, method: 'Get', arg: { id: 1 } }]);
    expect(backendB.calls).toEqual([{ client: clientB, method: 'Get', arg: { id: 2 } }]);
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

    // SWR only re-renders for the fields a render has read, so read `data` during render
    const { result } = renderHook(() => ({
      tayori: instance.useData('Get', { id: 1 }).data,
      // no fetcher given: SWR falls back to the global one
      plain: useSWR<string>('plain').data
    }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.plain).toEqual('hijacked');
      expect(result.current.tayori).toEqual('c1:Get:1');
    });
    expect(backend.calls).toEqual([{ client, method: 'Get', arg: { id: 1 } }]);
  });

  it('honours a per-hook fetcher passed in the SWR config', async () => {
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result } = renderHook(() => instance.useData('Get', { id: 1 }, { fetcher: () => Promise.resolve('fixture') }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual('fixture');
    });
    expect(backend.calls).toEqual([]);
  });

  it('keeps working under a user SWR middleware that wraps the fetcher (installed above the provider)', async () => {
    const backend = createFakeBackend();
    const client: FakeClient = { name: 'c1' };
    const instance = createTayori(backend);
    const seen: unknown[] = [];

    // SWR's documented "logger" pattern
    const logger: Middleware = (useSWRNext) => (key, fetcher, config) => {
      const extendedFetcher = fetcher
        ? (...args: unknown[]) => {
          seen.push(args[0]);
          return (fetcher as (...a: unknown[]) => unknown)(...args);
        }
        : fetcher;
      return useSWRNext(key, extendedFetcher as typeof fetcher, config);
    };

    function Wrapper({ children }: React.PropsWithChildren) {
      return (
        <SWRConfig value={{ ...isolatedSwr, use: [logger] }}>
          <instance.TayoriProvider initClient={() => client}>
            {children}
          </instance.TayoriProvider>
        </SWRConfig>
      );
    }

    const { result } = renderHook(() => instance.useData('Get', { id: 1 }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual('c1:Get:1');
    });
    expect(seen.length).toEqual(1);
    expect(backend.calls.length).toEqual(1);
  });

  it('sends the request stored in the key, and a changed request option is a new key', async () => {
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result, rerender } = renderHook(
      ({ timeout }: { timeout: number }) => instance.useData('Get', { id: 1, timeout }),
      { wrapper, initialProps: { timeout: 1 } }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual('c1:Get:1');
    });
    expect(backend.calls[0].arg).toEqual({ id: 1, timeout: 1 });

    // keys are lossless, so another `timeout` is another request
    rerender({ timeout: 2 });
    await waitFor(() => {
      expect(backend.calls.length).toEqual(2);
    });
    expect(backend.calls[1].arg).toEqual({ id: 1, timeout: 2 });
  });

  it('throws synchronously when a hook is rendered outside of <TayoriProvider />', () => {
    const backend = createFakeBackend('lonely');
    const instance = createTayori(backend);

    expect(() => renderHook(() => instance.useData('Get', { id: 1 }), { wrapper: Isolated }))
      .toThrow('[lonely] hooks must be used within <TayoriProvider />');
    expect(() => renderHook(() => instance.useInfinite('Get', () => ({ id: 1 })), { wrapper: Isolated }))
      .toThrow('[lonely] hooks must be used within <TayoriProvider />');
    expect(() => renderHook(() => instance.useMutation('Post'), { wrapper: Isolated }))
      .toThrow('[lonely] hooks must be used within <TayoriProvider />');
    expect(backend.calls).toEqual([]);
  });

  it('nested providers of the same instance give the inner subtree its own client and cache entries', async () => {
    const backend = createFakeBackend();
    const instance = createTayori(backend);
    const outer: FakeClient = { name: 'outer' };
    const inner: FakeClient = { name: 'inner' };

    function Probe() {
      const { data } = instance.useData('Get', { id: 1 });
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
