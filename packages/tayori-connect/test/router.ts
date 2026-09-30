import type { MessageInitShape } from '@bufbuild/protobuf';
import type { HandlerContext, ServiceImpl, Transport } from '@connectrpc/connect';
import { createRouterTransport } from '@connectrpc/connect';

import type { EchoRequest, EchoResponseSchema } from './gen/tayori/test/v1/test_pb';
import { TestService } from './gen/tayori/test/v1/test_pb';

type TestServiceImpl = ServiceImpl<typeof TestService>;
/** The unary RPCs of `TestService` (the streaming one is rejected by tayori-connect) */
type UnaryMethodName = 'echo' | 'update';
type UnaryImpl = TestServiceImpl[UnaryMethodName];

export interface RecordedCall {
  /** RPC name as written in the proto, e.g. `Echo` */
  method: string,
  /** The decoded request message the handler received */
  request: EchoRequest,
  /** Request headers as seen by the handler (lower-cased names) */
  headers: Record<string, string>
}

export interface TestTransport {
  transport: Transport,
  /** Every unary call that reached a handler, in order */
  calls: RecordedCall[]
}

/**
 * The default `echo` / `update` handler: `text` and `big` are echoed back, and the `x-test`
 * request header is reflected in `receivedHeaders` so tests can assert call options reached the server.
 */
export function echo(request: EchoRequest, context: HandlerContext): MessageInitShape<typeof EchoResponseSchema> {
  return {
    text: request.text,
    big: request.big,
    receivedHeaders: { 'x-test': context.requestHeader.get('x-test') ?? '' }
  };
}

/**
 * An in-memory Connect server (`createRouterTransport`) implementing `TestService`. Every unary call is
 * recorded in `calls` before it reaches the handler. Pass `overrides` to replace `echo` / `update`.
 */
export function createTestTransport(overrides: Partial<Pick<TestServiceImpl, UnaryMethodName>> = {}): TestTransport {
  const calls: RecordedCall[] = [];

  const record = (impl: UnaryImpl): UnaryImpl => (request, context) => {
    calls.push({
      method: context.method.name,
      request,
      headers: Object.fromEntries(context.requestHeader)
    });
    return impl(request, context);
  };

  const transport = createRouterTransport(({ service }) => {
    service(TestService, {
      echo: record(overrides.echo ?? echo),
      update: record(overrides.update ?? echo)
    });
  });

  return { transport, calls };
}
