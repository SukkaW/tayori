import type { DescMessage, DescMethod, DescMethodUnary, JsonValue, MessageInitShape, MessageShape, Registry } from '@bufbuild/protobuf';
import { create, fromJson, toJson } from '@bufbuild/protobuf';
import type { CallOptions, Transport } from '@connectrpc/connect';
import type { TayoriBackend } from 'tayori-core';

/**
 * Connect per-call options that tayori-connect forwards to the transport. They are NOT part of the
 * SWR key: two hooks with the same method + input but different headers share one cache entry.
 */
export type TayoriConnectCallOptions = Pick<CallOptions, 'headers' | 'timeoutMs' | 'contextValues' | 'onHeader' | 'onTrailer'>;

/**
 * Same as `TayoriConnectCallOptions`, plus `signal`, which only makes sense for `useMutation().trigger()`.
 */
export type TayoriConnectTriggerCallOptions = TayoriConnectCallOptions & Pick<CallOptions, 'signal'>;

/** Loosely typed unary method descriptor used by the runtime */
export type AnyUnaryMethod = DescMethodUnary;
export type AnyMessageInit = MessageInitShape<DescMessage>;
export type AnyMessage = MessageShape<DescMessage>;

/**
 * Slot 1 of a tayori-connect SWR key: `<service type name>/<method name>`, e.g.
 * `connectrpc.eliza.v1.ElizaService/Say`. This is also the Connect route path.
 */
export type TayoriConnectMethodKey = `${string}/${string}`;

/**
 * Slot 1 of a tayori-connect SWR key. Also validates that the method is unary: streaming methods
 * are not supported (yet).
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
   * A protobuf-es `Registry` used when encoding / decoding the request message for the SWR key.
   * Only needed if your request messages contain `google.protobuf.Any` fields.
   */
  registry?: Registry
}

export function createConnectBackend({ registry }: TayoriConnectBackendOptions = {}): TayoriBackend<
  AnyUnaryMethod,
  AnyMessageInit,
  AnyMessage,
  Transport,
  TayoriConnectTriggerCallOptions
> {
  const jsonOptions = registry ? { registry } : undefined;

  async function unary(
    transport: Transport,
    method: AnyUnaryMethod,
    input: AnyMessageInit,
    callOptions: TayoriConnectTriggerCallOptions | undefined
  ): Promise<AnyMessage> {
    // Same as what Connect's own `createClient()` does for unary methods
    const response = await transport.unary(
      method,
      callOptions?.signal,
      callOptions?.timeoutMs,
      callOptions?.headers,
      input,
      callOptions?.contextValues
    );
    callOptions?.onHeader?.(response.header);
    callOptions?.onTrailer?.(response.trailer);
    return response.message;
  }

  return {
    name: 'tayori-connect',
    methodKey: getMethodKey,
    // Canonical proto3 JSON: unset / default fields are omitted, 64-bit integers become strings,
    // bytes become base64, well-known types use their JSON mapping. Equivalent inits yield equal keys.
    argKey: (method, init) => [toJson(method.input, create(method.input, init), jsonOptions), undefined],
    fetch: (transport, method, argKey, callOptions) => unary(transport, method, fromJson(method.input, argKey as JsonValue, jsonOptions), callOptions),
    call: unary
  };
}
