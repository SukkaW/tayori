import type { CacheTag, TayoriBackend } from '../src/types';

export interface FakeClient {
  readonly name: string
}

export interface FakeArg {
  id: number,
  cacheTags?: CacheTag[]
}

export interface FakeCallOptions {
  header?: string,
  timeoutMs?: number
}

export interface FakeCall {
  via: 'fetch' | 'call',
  client: FakeClient,
  method: string,
  arg: unknown,
  callOptions: FakeCallOptions | undefined
}

export interface FakeBackend extends TayoriBackend<string, FakeArg, unknown, FakeClient, FakeCallOptions> {
  calls: FakeCall[],
  /** Replace the response producer. Return a rejected promise to simulate errors. */
  respond: (client: FakeClient, method: string, arg: { id: number }) => Promise<unknown>
}

/**
 * A minimal backend: methods are strings, args are `{ id, cacheTags? }`, responses are
 * `${client.name}:${method}:${id}` unless `respond` is overridden. Every call is recorded.
 */
export function createFakeBackend(name = 'fake'): FakeBackend {
  const backend: FakeBackend = {
    name,
    calls: [],
    respond: (client, method, arg) => Promise.resolve(`${client.name}:${method}:${arg.id}`),
    methodKey: (method) => method,
    argKey(_method, { cacheTags, ...rest }) {
      return [rest, cacheTags];
    },
    fetch(client, methodKey, argKey, callOptions) {
      backend.calls.push({ via: 'fetch', client, method: methodKey as string, arg: argKey, callOptions });
      return backend.respond(client, methodKey as string, argKey as { id: number });
    },
    call(client, method, { cacheTags: _cacheTags, ...rest }, callOptions) {
      backend.calls.push({ via: 'call', client, method, arg: rest, callOptions });
      return backend.respond(client, method, rest);
    }
  };
  // eslint-disable-next-line sukka/no-redundant-variable -- the methods above reference `backend` itself
  return backend;
}

export function createDeferred<T>() {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}
