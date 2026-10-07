import type { DescMessage, DescMethod, DescMethodUnary, MessageInitShape, MessageShape } from '@bufbuild/protobuf';
import { create } from '@bufbuild/protobuf';
import type { CallOptions, Transport } from '@connectrpc/connect';
import type { CacheTag, TayoriBackend, TayoriTypes, TypeFn } from 'tayori-core';

/**
 * Connect per-call options that tayori-connect forwards to the transport: exactly what you would
 * pass as the second argument of a Connect client method. Like the message, they are part of the
 * SWR key, so keep them stable across renders (see `TayoriConnectRequest`).
 */
export type TayoriConnectCallOptions = Pick<CallOptions, 'headers' | 'timeoutMs' | 'contextValues' | 'onHeader' | 'onTrailer'>;

/**
 * Describes one request, the way Hey API's request options describe a request in `tayori`:
 * the request message plus Connect's per-call options plus tayori's `cacheTags`.
 *
 * The whole request is the SWR key, so it must stay the same across renders. Messages, plain
 * values, plain header objects and `new Headers()` are normalized into stable keys, but these are
 * compared by identity, and a new one every render means a new request every render:
 * `Uint8Array`s (`bytes` fields, including `anyPack()` results), `onHeader` / `onTrailer` callbacks
 * and `contextValues`. Create them outside of render or memoize them.
 */
export interface TayoriConnectRequest<I extends DescMessage = DescMessage> extends TayoriConnectCallOptions {
  /**
   * The request message (its init shape, like what you would pass to `create(Schema, ...)`).
   * Pass `{}` for methods whose request message has no fields. It is required on purpose: a
   * request bag that forgot its message would otherwise silently send an empty message.
   */
  message: MessageInitShape<I>,
  /**
   * Tags that can later be used to revalidate this request via `unstable_mutateWithTags`.
   * Tags are part of the SWR key.
   */
  cacheTags?: CacheTag[]
}

/**
 * The request of `useMutation().trigger()`: same as `TayoriConnectRequest`, plus an `AbortSignal`
 * (SWR manages the lifecycle of `useData` requests itself, so `signal` only exists for mutations).
 */
export interface TayoriConnectMutationRequest<I extends DescMessage = DescMessage> extends TayoriConnectRequest<I>, Pick<CallOptions, 'signal'> {}

/** Loosely typed unary method descriptor used by the runtime */
export type AnyUnaryMethod = DescMethodUnary;
export type AnyMessage = MessageShape<DescMessage>;

/** The request message descriptor of a unary method descriptor */
export type MethodInput<Method> = Method extends DescMethodUnary<infer I> ? I : never;
/** The response message descriptor of a unary method descriptor */
export type MethodOutput<Method> = Method extends DescMethodUnary<DescMessage, infer O> ? O : never;

/** `DescMethodUnary<I, O>` → `TayoriConnectRequest<I>` */
export interface TayoriConnectRequestOf extends TypeFn {
  readonly output: TayoriConnectRequest<MethodInput<this['input']>>
}
/** `DescMethodUnary<I, O>` → `TayoriConnectMutationRequest<I>` */
export interface TayoriConnectMutationRequestOf extends TypeFn {
  readonly output: TayoriConnectMutationRequest<MethodInput<this['input']>>
}
/** `DescMethodUnary<I, O>` → `MessageShape<O>` */
export interface TayoriConnectResponseOf extends TypeFn {
  readonly output: MessageShape<MethodOutput<this['input']>>
}

/** The `TayoriTypes` of the Connect backend: hooks accept unary method descriptors and type the request / response from them */
export interface TayoriConnectTypes extends TayoriTypes {
  readonly Method: AnyUnaryMethod,
  readonly Arg: TayoriConnectMutationRequest,
  readonly Data: AnyMessage,
  readonly ArgOf: TayoriConnectRequestOf,
  readonly MutationArgOf: TayoriConnectMutationRequestOf,
  readonly DataOf: TayoriConnectResponseOf
}

export type TayoriConnectBackend = TayoriBackend<TayoriConnectTypes, Transport>;

/**
 * Slot 1 of a tayori-connect SWR key: `<service type name>/<method name>`, e.g.
 * `connectrpc.eliza.v1.ElizaService/Say`. This is also the Connect route path.
 */
export type TayoriConnectMethodKey = `${string}/${string}`;

/**
 * Slot 1 of the key. Also validates that the method is unary: streaming methods are not supported (yet).
 */
export function getMethodKey(method: DescMethod): TayoriConnectMethodKey {
  const key: TayoriConnectMethodKey = `${method.parent.typeName}/${method.name}`;
  if (method.methodKind !== 'unary') {
    throw new TypeError(`[tayori-connect] ${key} is a ${method.methodKind} method, only unary methods are supported for now`);
  }
  return key;
}

/**
 * The request headers as a plain record, or `undefined` when there are none. This is what the key
 * holds and what is sent, so it must stay equivalent to the input.
 *
 * Caveats, since the result feeds SWR's key hash:
 * - A `Headers` instance hashes by identity (a new one every render would be a new key every
 *   render), a plain record hashes by content.
 * - Names are lower-cased here (header names are case-insensitive). Spec-compliant `Headers`
 *   (browsers, Node.js) already lower-case names when iterated, but not every implementation does
 *   (happy-dom keeps the original case), and `{ 'X-Foo': 'a' }` must hash the same as `{ 'x-foo': 'a' }`.
 * - Names are not sorted: SWR's stable-hash sorts plain-object keys, so insertion order never matters.
 * - `undefined` rather than `{}` without headers: stable-hash skips absent properties but hashes `{}`.
 * - `Headers` joins repeated names (`a, b`), the same value the transport sends.
 * - Values are part of the key, so a header that changes on every request (request ids, rotating
 *   tokens) creates a new cache entry each time. Set those in a transport interceptor instead.
 */
function headersKey(init: HeadersInit | undefined): Record<string, string> | undefined {
  if (init === undefined) return undefined;
  let key: Record<string, string> | undefined;
  for (const [name, value] of new Headers(init)) {
    key ??= {};
    key[name.toLowerCase()] = value;
  }
  return key;
}

export function createConnectBackend(): TayoriConnectBackend {
  return {
    name: 'tayori-connect',
    methodKey: getMethodKey,
    // Keys are lossless (the hooks send exactly what is in the key), only normalized into an
    // equivalent request that hashes more stably across renders:
    // - the message goes through `create()`, which the transport would do anyway: defaults are
    //   filled in, so `{ pageSize: 20 }` and `{ pageSize: 20, pageToken: '' }` share one key, and an
    //   already created message is returned as is
    // - headers become a plain record with lower-cased names (see `headersKey`)
    // - the abort signal is left out: it only exists for `useMutation().trigger()`, which sends its
    //   request as is, and must not keep a `populateCache` key from matching `useData`'s
    argKey(method, { cacheTags, signal: _signal, headers, ...request }) {
      const argKey: TayoriConnectRequest = {
        ...request,
        message: create(method.input, request.message)
      };
      const normalizedHeaders = headersKey(headers);
      if (normalizedHeaders) {
        argKey.headers = normalizedHeaders;
      }
      return [argKey, cacheTags];
    },
    // Same as what Connect's own `createClient()` does for unary methods
    async call(transport, method, request) {
      const response = await transport.unary(
        method,
        request.signal,
        request.timeoutMs,
        request.headers,
        request.message,
        request.contextValues
      );
      request.onHeader?.(response.header);
      request.onTrailer?.(response.trailer);
      return response.message;
    }
  };
}
