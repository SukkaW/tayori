import type { ZodError } from 'zod';

/**
 * This is an internal function for distinguishing Zod errors that came from Hey API
 * client (by Hey API's request and response validation). This function uses duck typing.
 *
 * You can re-use this function as you wish, this might be useful when implementing your own
 * error handling logic.
 */
export function isZodError(e: unknown): e is ZodError {
  return e != null && typeof e === 'object' && 'issues' in e && Array.isArray(e.issues);
}
