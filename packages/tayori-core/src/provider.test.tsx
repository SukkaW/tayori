import { describe, it, afterEach } from 'mocha';
import { expect } from 'earl';
import { render, renderHook, screen } from '@testing-library/react';
import sinon from 'sinon';

import { createTayori, isTayoriKey } from '.';
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

  it('isKey recognizes keys and key functions built by this instance only', () => {
    const client: FakeClient = { name: 'c1' };
    const instance = createTayori(createFakeBackend('one'));
    const other = createTayori(createFakeBackend('two'));

    const key = instance.getKey(client, 'Get', { id: 1 }, undefined);
    const thunk = instance.getKey(client, 'Get', () => ({ id: 1 }), undefined);
    const foreign = other.getKey(client, 'Get', { id: 1 }, undefined);

    expect(Array.from(key as Iterable<unknown>)).toEqual([client, 'Get', { id: 1 }, undefined]);
    expect(instance.isKey(key)).toEqual(true);
    expect(instance.isKey(thunk)).toEqual(true);
    expect(instance.isKey(foreign)).toEqual(false);
    expect(other.isKey(foreign)).toEqual(true);
    // the instance-agnostic check accepts keys of any instance
    expect(isTayoriKey(foreign)).toEqual(true);
    // an unbranded array with the same slots is not a tayori key
    expect(instance.isKey([client, 'Get', { id: 1 }, undefined])).toEqual(false);
    expect(instance.isKey(null)).toEqual(false);
    expect(instance.token).toEqual({ backend: 'one' });
  });
});
