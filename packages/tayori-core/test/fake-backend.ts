import type { TayoriBackend, TayoriSimpleTypes } from '../src/types';

export interface FakeClient {
  readonly name: string
}

/** The request bag of the fake backend */
export interface FakeArg {
  id: number,
  timeout?: number
}

export interface FakeCall {
  client: FakeClient,
  method: string,
  /** the request as sent: the one stored in the key for hooks, the arg as is for useMutation */
  arg: FakeArg
}

/** Methods are strings, every method takes a `FakeArg` and responds with a string */
export type FakeTypes = TayoriSimpleTypes<string, FakeArg, string>;

export interface FakeBackend extends TayoriBackend<FakeTypes, FakeClient> {
  calls: FakeCall[],
  /** Replace the response producer. Return a rejected promise to simulate errors. */
  respond: (client: FakeClient, method: string, arg: FakeArg) => Promise<string>
}

/**
 * A minimal backend: methods are strings, args are `{ id, timeout? }`, responses are
 * `${client.name}:${method}:${id}` unless `respond` is overridden. Every call is recorded.
 */
export function createFakeBackend(name = 'fake'): FakeBackend {
  const backend: FakeBackend = {
    name,
    calls: [],
    respond: (client, method, arg) => Promise.resolve(`${client.name}:${method}:${arg.id}`),
    methodKey: (method) => method,
    // keys are lossless: the request itself
    argKey: (_method, arg) => arg,
    call(client, method, arg) {
      backend.calls.push({ client, method, arg });
      return backend.respond(client, method, arg);
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
