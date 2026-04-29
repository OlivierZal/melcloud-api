import type { z } from 'zod'

import type { Logger } from '../api/index.ts'
import { AuthenticationError, RateLimitError } from '../errors/index.ts'
import { type HttpError, HttpStatus, isHttpError } from '../http/index.ts'
import {
  type ApiRequestError,
  type Result,
  err as failure,
  ok as success,
} from '../types/index.ts'
import { parseOrThrow } from './schemas.ts'

/** Host contract for {@link validateRequest} / {@link runRequest}: optional logger for diagnostics. */
export interface ValidateHost {
  readonly logger?: Logger
}

const classifyHttpError = (error: HttpError): ApiRequestError =>
  error.response.status === HttpStatus.Unauthorized ?
    { cause: error, kind: 'unauthorized' }
  : { cause: error, kind: 'server', status: error.response.status }

const classifyError = (
  error: unknown,
  parseIssue?: string,
): ApiRequestError => {
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

const wrapInResult = async <T>(
  context: string,
  host: ValidateHost,
  operation: () => Promise<T>,
): Promise<Result<T, ApiRequestError>> => {
  try {
    return success(await operation())
  } catch (error) {
    host.logger?.error(`[${context}] request or validation failed:`, error)
    const parseIssue =
      error instanceof Error && error.name === 'ValidationError' ?
        error.message
      : undefined
    return failure(classifyError(error, parseIssue))
  }
}

/** Options for {@link runRequest}. */
export interface RunRequestOptions<T> {
  readonly context: string
  readonly host: ValidateHost
  readonly operation: () => Promise<T>
}

/**
 * Run an API operation and wrap the outcome in a {@link Result} —
 * without Zod validation. Use this for endpoints whose response shape
 * is enforced at compile time only (the Classic API surface) and where
 * the caller does not need a Zod-level shape check.
 *
 * Returns:
 * - `{ ok: true, value }` on success.
 * - `{ ok: false, error }` on any thrown branch, classified into
 *   `network` / `unauthorized` / `rate-limited` / `server` so callers
 *   can branch on the failure mode. `logger.error` on `host` still
 *   surfaces the underlying error for runtime debugging — the
 *   classification is the typed contract.
 *
 * Sibling of {@link validateRequest}, which adds Zod-level shape
 * checking and a `validation` failure variant.
 * @param options - {@link RunRequestOptions} describing the call.
 * @param options.context - Label embedded in logger messages for traceability.
 * @param options.host - Caller context exposing an optional `logger`.
 * @param options.operation - The API call to run.
 * @returns `Result<T, ApiRequestError>` reflecting success or the typed failure.
 */
export const runRequest = async <T>({
  context,
  host,
  operation,
}: RunRequestOptions<T>): Promise<Result<T, ApiRequestError>> =>
  wrapInResult(context, host, operation)

/** Options for {@link validateRequest}. */
export interface ValidateRequestOptions<T> {
  readonly context: string
  readonly host: ValidateHost
  readonly schema: z.ZodType<T>
  readonly operation: () => Promise<unknown>
}

/**
 * Run an API operation, parse the resolved value against `schema`, and
 * wrap the outcome in a {@link Result}.
 *
 * Replaces the former `@validate` method decorator. The decorator form
 * forced an `as unknown as Result<...>` cast at every call site because
 * TS 5 standard decorators cannot narrow a method's declared return
 * type from the decorator's transformed output. A plain helper has an
 * honest generic signature and needs no casts.
 *
 * Returns:
 * - `{ ok: true, value }` on parse success.
 * - `{ ok: false, error }` on any thrown branch, classified into one of
 *   `network` / `unauthorized` / `rate-limited` / `validation` /
 *   `server` so callers can branch on the failure mode.
 *
 * Use {@link runRequest} when no Zod schema is available (the
 * `validation` failure variant is then unreachable).
 * @param options - {@link ValidateRequestOptions} describing the call.
 * @param options.context - Label embedded in parse errors and logger
 * messages for traceability (e.g. `'BFF /report/trendsummary'`).
 * @param options.host - Caller context exposing an optional `logger`.
 * @param options.schema - Zod schema describing the expected resolved shape.
 * @param options.operation - The API call whose resolved value will be parsed.
 * @returns `Result<T, ApiRequestError>` reflecting success or the typed failure.
 */
export const validateRequest = async <T>({
  context,
  host,
  operation,
  schema,
}: ValidateRequestOptions<T>): Promise<Result<T, ApiRequestError>> =>
  wrapInResult(context, host, async () =>
    parseOrThrow(schema, await operation(), context),
  )
