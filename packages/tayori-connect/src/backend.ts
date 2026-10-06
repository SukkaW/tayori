import type { DescMessage, DescMethod, DescMethodUnary, JsonValue, MessageInitShape, MessageShape, Registry } from '@bufbuild/protobuf';
import { create, toJson } from '@bufbuild/protobuf';
import type { CallOptions, Transport } from '@connectrpc/connect';
import { headersToObject } from 'foxts/headers-to-object';
import type { CacheTag, TayoriBackend, TayoriTypes, TypeFn } from 'tayori-core';

/**
 * Connect per-call options that tayori-connect forwards to the transport: exactly what you would
 * pass as the second argument of a Connect client method. `headers` are part of the SWR key (a
 * request with different headers may get a different response), the others are not.
 */
export type TayoriConnectCallOptions = Pick<CallOptions, 'headers' | 'timeoutMs' | 'contextValues' | 'onHeader' | 'onTrailer'>;

/**
 * Describes one request, the way Hey API's request options describe a request in `tayori`:
 * the request message plus Connect's per-call options plus tayori's `cacheTags`.
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
 * Slot 2 of a tayori-connect SWR key: the request message as canonical proto3 JSON, plus the
 * headers (names lower-cased and sorted) when the request has any.
 */
export interface TayoriConnectArgKey {
  message: JsonValue,
  headers?: Record<string, string>
}

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

export interface TayoriConnectBackendOptions {
  /**
   * A protobuf-es `Registry` used when serializing the request message for the SWR key.
   * Only needed if your request messages contain `google.protobuf.Any` fields.
   */
  registry?: Registry
}

export function createConnectBackend({ registry }: TayoriConnectBackendOptions = {}): TayoriConnectBackend {
  const jsonOptions = registry ? { registry } : undefined;

  return {
    name: 'tayori-connect',
    methodKey: getMethodKey,
    // Canonical proto3 JSON: unset / default fields are omitted, 64-bit integers become strings,
    // bytes become base64, well-known types use their JSON mapping. Equivalent inits yield equal keys.
    argKey(method, request) {
      const argKey: TayoriConnectArgKey = {
        message: toJson(method.input, create(method.input, request.message), jsonOptions)
      };
      const headers = headersToObject(request.headers);
      argKey.headers = headers;

      return [argKey, request.cacheTags];
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
