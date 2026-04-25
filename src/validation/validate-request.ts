import type { z } from 'zod'

import type { Logger } from '../api/index.ts'
import { AuthenticationError, RateLimitError } from '../errors/index.ts'
import { type HttpError, HttpStatus, isHttpError } from '../http/index.ts'
import {
  type HomeError,
  type Result,
  err as failure,
  ok as success,
} from '../types/index.ts'
import { parseOrThrow } from './schemas.ts'

/** Host contract for {@link validateRequest}: optional logger for diagnostics. */
export interface ValidateHost {
  readonly logger?: Logger
}

const classifyHttpError = (error: HttpError): HomeError =>
  error.response.status === HttpStatus.Unauthorized ?
    { cause: error, kind: 'unauthorized' }
  : { cause: error, kind: 'server', status: error.response.status }

const classifyError = (error: unknown, parseIssue?: string): HomeError => {
  if (parseIssue !== undefined) {
    return { cause: error, issue: parseIssue, kind: 'validation' }
  }
  if (error instanceof AuthenticationError) {
    return { cause: error, kind: 'unauthorized' }
  }
  if (error instanceof RateLimitError) {
    return {
      kind: 'rate-limited',
      retryAfterMs: error.retryAfter?.toMillis() ?? null,
    }
  }
  if (isHttpError(error)) {
    return classifyHttpError(error)
  }
  return { cause: error, kind: 'network' }
}

/** Options for {@link validateRequest}. */
export interface ValidateRequestOptions<T> {
  readonly context: string
  readonly host: ValidateHost
  readonly schema: z.ZodType<T>
  readonly operation: () => Promise<unknown>
}

/**
 * Run an API operation and wrap the outcome in a {@link Result}.
 *
 * Replaces the former `@validate` method decorator. The decorator form
 * forced an `as unknown as Result<...>` cast at every call site because
 * TS 5 standard decorators cannot narrow a method's declared return
 * type from the decorator's transformed output. A plain helper has an
 * honest generic signature and needs no casts.
 *
 * Composition contract — runs `operation`, parses the resolved value
 * against `schema`, and returns:
 * - `{ ok: true, value }` on parse success.
 * - `{ ok: false, error }` on any thrown branch, classified into one of
 *   `network` / `unauthorized` / `rate-limited` / `validation` /
 *   `server` so callers can branch on the failure mode. `logger.error`
 *   on `host` still surfaces the underlying error for runtime
 *   debugging — the classification is the typed contract.
 * @param options - {@link ValidateRequestOptions} describing the call.
 * @param options.context - Label embedded in parse errors and logger
 * messages for traceability (e.g. `'BFF /report/trendsummary'`).
 * @param options.host - Caller context exposing an optional `logger`.
 * @param options.schema - Zod schema describing the expected resolved shape.
 * @param options.operation - The API call whose resolved value will be parsed.
 * @returns `Result<T, HomeError>` reflecting success or the typed failure.
 */
export const validateRequest = async <T>({
  context,
  host,
  operation,
  schema,
}: ValidateRequestOptions<T>): Promise<Result<T, HomeError>> => {
  try {
    return success(parseOrThrow(schema, await operation(), context))
  } catch (error) {
    host.logger?.error(`[${context}] request or validation failed:`, error)
    const parseIssue =
      error instanceof Error && error.name === 'ValidationError' ?
        error.message
      : undefined
    return failure(classifyError(error, parseIssue))
  }
}
