import { describe, it, afterEach } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';
import sinon from 'sinon';

import { createTayori } from '.';
import { createDeferred, createFakeBackend } from '../test/fake-backend';
import type { FakeClient } from '../test/fake-backend';
import { createWrapper } from '../test/wrapper';

function setup() {
  const backend = createFakeBackend();
  const client: FakeClient = { name: 'c1' };
  const instance = createTayori(backend);
  const wrapper = createWrapper({ Provider: instance.TayoriProvider, initClient: () => client });
  return { backend, client, instance, wrapper };
}

describe('useMutation', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('trigger calls the backend and exposes the result as data', async () => {
    const { backend, client, instance, wrapper } = setup();
    const { result } = renderHook(() => instance.useMutation<string>('Create'), { wrapper });

    expect(result.current.data).toEqual(undefined);
    expect(result.current.error).toEqual(undefined);
    expect(result.current.isMutating).toEqual(false);

    let returned: string | undefined;
    await act(async () => {
      returned = await result.current.trigger({ id: 1 });
    });

    expect(returned).toEqual('c1:Create:1');
    expect(result.current.data).toEqual('c1:Create:1');
    expect(result.current.error).toEqual(undefined);
    await waitFor(() => {
      expect(result.current.isMutating).toEqual(false);
    });
    expect(backend.calls).toEqual([{ via: 'call', client, method: 'Create', arg: { id: 1 }, callOptions: undefined }]);
  });

  it('a rejection sets error, calls onError with a string id, and is rethrown to the caller', async () => {
    const { backend, instance, wrapper } = setup();
    backend.respond = () => Promise.reject(new Error('nope'));
    const onError = sinon.spy();
    const { result } = renderHook(() => instance.useMutation<string>('Create', { onError }), { wrapper });

    await act(async () => {
      await expect(result.current.trigger({ id: 1 })).toBeRejectedWith(Error, 'nope');
    });

    expect(result.current.error).toBeA(Error);
    expect((result.current.error as Error).message).toEqual('nope');
    expect(result.current.data).toEqual(undefined);
    expect(onError.callCount).toEqual(1);
    expect(onError.firstCall.args[0]).toBeA(Error);
    expect(onError.firstCall.args[1]).toBeA(String);
  });

  it('isMutating is true while the backend promise is pending and false afterwards', async () => {
    const { backend, instance, wrapper } = setup();
    const deferred = createDeferred<string>();
    backend.respond = () => deferred.promise;
    const { result } = renderHook(() => instance.useMutation<string>('Create'), { wrapper });

    let pending: Promise<string> | undefined;
    act(() => {
      pending = result.current.trigger({ id: 1 });
    });

    await waitFor(() => {
      expect(result.current.isMutating).toEqual(true);
    });
    expect(result.current.data).toEqual(undefined);

    await act(async () => {
      deferred.resolve('done');
      await pending;
    });

    await waitFor(() => {
      expect(result.current.isMutating).toEqual(false);
    });
    expect(result.current.data).toEqual('done');
  });

  it('a rapid double trigger only applies the latest result', async () => {
    const { backend, instance, wrapper } = setup();
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    backend.respond = (_client, _method, arg) => (arg.id === 1 ? first.promise : second.promise);
    const onSuccess = sinon.spy();
    const { result } = renderHook(() => instance.useMutation<string>('Create', { onSuccess }), { wrapper });

    let firstTrigger: Promise<string> | undefined;
    let secondTrigger: Promise<string> | undefined;
    act(() => {
      firstTrigger = result.current.trigger({ id: 1 });
      secondTrigger = result.current.trigger({ id: 2 });
    });

    await act(async () => {
      second.resolve('second');
      await secondTrigger;
    });
    expect(result.current.data).toEqual('second');

    // the stale mutation resolves last: its caller still gets the value, but the hook ignores it
    let firstResult: string | undefined;
    await act(async () => {
      first.resolve('first');
      firstResult = await firstTrigger;
    });

    expect(firstResult).toEqual('first');
    expect(result.current.data).toEqual('second');
    expect(onSuccess.callCount).toEqual(1);
    expect(onSuccess.firstCall.args[0]).toEqual('second');
  });

  it('reset() clears data and error and ignores results that resolve afterwards', async () => {
    const { backend, instance, wrapper } = setup();
    const onSuccess = sinon.spy();
    const { result } = renderHook(() => instance.useMutation<string>('Create', { onSuccess }), { wrapper });

    await act(async () => {
      await result.current.trigger({ id: 1 });
    });
    expect(result.current.data).toEqual('c1:Create:1');

    const deferred = createDeferred<string>();
    backend.respond = () => deferred.promise;
    let pending: Promise<string> | undefined;
    act(() => {
      pending = result.current.trigger({ id: 2 });
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toEqual(undefined);
    expect(result.current.error).toEqual(undefined);

    await act(async () => {
      deferred.resolve('late');
      await pending;
    });

    expect(result.current.data).toEqual(undefined);
    expect(onSuccess.callCount).toEqual(1);
  });

  it('populateCache: true writes the result into the matching useData cache slot without refetching', async () => {
    const { backend, instance, wrapper } = setup();
    const { result } = renderHook(() => ({
      mutation: instance.useMutation<string>('Get', { populateCache: true }),
      query: instance.useData<string>('Get', { id: 1 })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.query.data).toEqual('c1:Get:1');
    });

    backend.respond = () => Promise.resolve('fresh');
    await act(async () => {
      await result.current.mutation.trigger({ id: 1 });
    });

    await waitFor(() => {
      expect(result.current.query.data).toEqual('fresh');
    });
    // one initial fetch, one mutation call, and no revalidation of the query
    expect(backend.calls.map((call) => call.via)).toEqual(['fetch', 'call']);
  });

  it('leaves the cache alone by default, but a trigger-level populateCache opts in', async () => {
    const { backend, instance, wrapper } = setup();
    const { result } = renderHook(() => ({
      mutation: instance.useMutation<string>('Get'),
      query: instance.useData<string>('Get', { id: 1 })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.query.data).toEqual('c1:Get:1');
    });

    backend.respond = () => Promise.resolve('fresh');
    await act(async () => {
      await result.current.mutation.trigger({ id: 1 });
    });
    expect(result.current.mutation.data).toEqual('fresh');
    expect(result.current.query.data).toEqual('c1:Get:1');

    await act(async () => {
      await result.current.mutation.trigger({ id: 1 }, { populateCache: true });
    });
    await waitFor(() => {
      expect(result.current.query.data).toEqual('fresh');
    });
    expect(backend.calls.map((call) => call.via)).toEqual(['fetch', 'call', 'call']);
  });

  it('a trigger-level onSuccess replaces the hook-level one', async () => {
    const { instance, wrapper } = setup();
    const hookOnSuccess = sinon.spy();
    const triggerOnSuccess = sinon.spy();
    const { result } = renderHook(() => instance.useMutation<string>('Create', { onSuccess: hookOnSuccess }), { wrapper });

    await act(async () => {
      await result.current.trigger({ id: 1 });
    });
    expect(hookOnSuccess.callCount).toEqual(1);
    expect(hookOnSuccess.firstCall.args[0]).toEqual('c1:Create:1');
    expect(hookOnSuccess.firstCall.args[1]).toBeA(String);

    await act(async () => {
      await result.current.trigger({ id: 2 }, { onSuccess: triggerOnSuccess });
    });
    expect(hookOnSuccess.callCount).toEqual(1);
    expect(triggerOnSuccess.callCount).toEqual(1);
    expect(triggerOnSuccess.firstCall.args[0]).toEqual('c1:Create:2');
  });

  it('merges callOptions from the hook and the trigger, the trigger winning per field', async () => {
    const { backend, instance, wrapper } = setup();
    const { result } = renderHook(() => instance.useMutation<string>('Create', { callOptions: { header: 'hook', timeoutMs: 100 } }), { wrapper });

    await act(async () => {
      await result.current.trigger({ id: 1 });
    });
    await act(async () => {
      await result.current.trigger({ id: 2 }, { callOptions: { header: 'trigger' } });
    });

    expect(backend.calls.map((call) => call.callOptions)).toEqual([
      { header: 'hook', timeoutMs: 100 },
      { header: 'trigger', timeoutMs: 100 }
    ]);
  });
});
