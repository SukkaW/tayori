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
 * Slot 2 of a tayori-connect SWR key: the request message as canonical proto3 JSON, or, when the
 * hook was given `headers`, a `[request, headers]` pair (header names lower-cased and sorted).
 * Like in Hey API mode, headers identify a request; the other call options don't.
 */
export type TayoriConnectArgKey = JsonValue | [request: JsonValue, headers: Record<string, string>];

/**
 * A plain, sorted record of the given headers, or `undefined` when there are none
 */
function headersKey(init: HeadersInit | undefined): Record<string, string> | undefined {
  if (init === undefined) return undefined;
  // `Headers` accepts every HeadersInit shape and joins duplicate names. Names are lower-cased and
  // sorted here rather than relying on the environment's `Headers` to do it (not every DOM
  // implementation follows the spec there), since the result feeds SWR's key hash.
  const entries: Array<[name: string, value: string]> = [];
  for (const [name, value] of new Headers(init)) {
    entries.push([name.toLowerCase(), value]);
  }
  if (entries.length === 0) return undefined;
  entries.sort(([a], [b]) => (a < b ? -1 : (a > b ? 1 : 0)));
  const result: Record<string, string> = {};
  for (let i = 0, len = entries.length; i < len; i++) {
    const [name, value] = entries[i];
    result[name] = value;
  }
  return result;
}

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
    // Headers are part of the key as well (a request with different headers may get a different response).
    argKey(method, init, callOptions) {
      const request = toJson(method.input, create(method.input, init), jsonOptions);
      const headers = headersKey(callOptions?.headers);
      return [headers ? [request, headers] satisfies TayoriConnectArgKey : request, undefined];
    },
    fetch(transport, method, argKey, callOptions) {
      // a message is never serialized to a JSON array, so the pair is unambiguous
      const request = Array.isArray(argKey) ? (argKey as [JsonValue, unknown])[0] : argKey as JsonValue;
      return unary(transport, method, fromJson(method.input, request, jsonOptions), callOptions);
    },
    call: unary
  };
}
