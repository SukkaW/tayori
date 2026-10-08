import { describe, it, afterEach } from 'mocha';
import { expect } from 'earl';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import sinon from 'sinon';

import { createTayori } from '.';
import { createFakeBackend } from '../test/fake-backend';
import type { FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

describe('TayoriProvider', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('runs initClient exactly once and useClient() returns that client across re-renders', () => {
    const instance = createTayori(createFakeBackend());
    const initClient = sinon.spy((): FakeClient => ({ name: 'c1' }));
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient });

    const { result, rerender } = renderHook(() => instance.useClient(), { wrapper });
    const first = result.current;
    rerender();
    rerender();

    expect(initClient.callCount).toEqual(1);
    expect(result.current).toEqual({ name: 'c1' });
    expect(result.current).toExactlyEqual(first);
  });

  it('keeps the first client even when a different initClient is passed later', () => {
    const instance = createTayori(createFakeBackend());

    function Probe() {
      return <output>{instance.useClient().name}</output>;
    }

    const { rerender } = render(
      <instance.TayoriProvider initClient={() => ({ name: 'first' })}>
        <Probe />
      </instance.TayoriProvider>
    );
    rerender(
      <instance.TayoriProvider initClient={() => ({ name: 'second' })}>
        <Probe />
      </instance.TayoriProvider>
    );

    expect(screen.getByText('first').tagName).toEqual('OUTPUT');
    expect(screen.queryByText('second')).toEqual(null);
  });

  it('useClient() outside of the provider throws a message naming the backend', () => {
    const instance = createTayori(createFakeBackend('lonely'));

    expect(() => renderHook(() => instance.useClient())).toThrow('[lonely] hooks must be used within <TayoriProvider />');
  });

  it('installs no SWR options: a changed request shows no previous data while loading, like plain SWR', async () => {
    const instance = createTayori(createFakeBackend());
    const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => ({ name: 'c1' }) });

    const { result, rerender } = renderHook(({ id }: { id: number }) => {
      const { data, isLoading } = instance.useData('Get', { id });
      return { data, isLoading };
    }, { wrapper, initialProps: { id: 1 } });
    await waitFor(() => {
      expect(result.current.data).toEqual('c1:Get:1');
    });

    rerender({ id: 2 });
    // SWR's default `keepPreviousData: false` (0.3.x's provider forced it to true)
    expect(result.current).toEqual({ data: undefined, isLoading: true });
    await waitFor(() => {
      expect(result.current.data).toEqual('c1:Get:2');
    });
  });

  it('lets an app-level <SWRConfig /> above the provider configure the hooks (keepPreviousData)', async () => {
    const instance = createTayori(createFakeBackend());
    function Wrapper({ children }: React.PropsWithChildren) {
      return (
        <SWRConfig value={{ keepPreviousData: true, provider: () => new Map(), dedupingInterval: 0 }}>
          <instance.TayoriProvider initClient={() => ({ name: 'c1' })}>
            {children}
          </instance.TayoriProvider>
        </SWRConfig>
      );
    }

    const { result, rerender } = renderHook(({ id }: { id: number }) => {
      const { data, isLoading } = instance.useData('Get', { id });
      return { data, isLoading };
    }, { wrapper: Wrapper, initialProps: { id: 1 } });
    await waitFor(() => {
      expect(result.current.data).toEqual('c1:Get:1');
    });

    rerender({ id: 2 });
    expect(result.current).toEqual({ data: 'c1:Get:1', isLoading: true });
    await waitFor(() => {
      expect(result.current.data).toEqual('c1:Get:2');
    });
  });
});
