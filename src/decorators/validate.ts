import type { z } from 'zod'

import type { Logger } from '../api/index.ts'
import { AuthenticationError, RateLimitError } from '../errors/index.ts'
import { isHttpError } from '../http/index.ts'
import {
  type HomeError,
  type Result,
  err as failure,
  ok as success,
} from '../types/index.ts'
import { parseOrThrow } from '../validation/index.ts'

const HTTP_STATUS_UNAUTHORIZED = 401

/** Host contract for {@link validate}: optional logger for diagnostics. */
interface ValidateHost {
  readonly logger?: Logger
}

/**
 * Classify any error the request pipeline can surface into a
 * {@link HomeError} variant. Keeps the mapping next to the
 * `@validate` decorator so the full error → Result contract lives at
 * one site — callers never inspect raw `HttpError` / `Error` values
 * again.
 * @param error - The caught failure to classify.
 * @param parseIssue - Optional Zod issue description. Present only
 * when the failure came from `parseOrThrow` and identifies the drift.
 * @returns The {@link HomeError} variant matching the error's shape.
 */
// eslint-disable-next-line max-statements -- a branch per HomeError variant is clearer here than a dispatch map (5 variants, each with its own payload shape)
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
    if (error.response.status === HTTP_STATUS_UNAUTHORIZED) {
      return { cause: error, kind: 'unauthorized' }
    }
    return { cause: error, kind: 'server', status: error.response.status }
  }
  return { cause: error, kind: 'network' }
}

/**
 * Method decorator factory that runs the method body, then validates
 * its resolved value against a Zod schema and returns a
 * {@link Result}. Successful parses land as `{ ok: true, value }`;
 * any failure (method rejecting, parse rejecting, shape mismatch) is
 * classified into a {@link HomeError} variant and returned as
 * `{ ok: false, error }`.
 *
 * Replaces the prior `T | null` contract: consumers get a typeable
 * failure class (`network`, `unauthorized`, `rate-limited`,
 * `validation`, `server`) instead of a `null` that encoded five
 * mutually-exclusive modes. `logger.error` still surfaces the
 * underlying error for runtime debugging.
 *
 * Type contract: the decorated method body is expected to return the
 * schema-typed shape — the decorator wraps the value into
 * {@link Result}'s success half on parse success, and injects the
 * failure half on any thrown branch.
 * @param root0 - Options object.
 * @param root0.schema - Zod schema describing the expected shape.
 * @param root0.context - Label embedded in parse errors and logger
 * messages for traceability (e.g. `'BFF /report/trendsummary'`).
 * @returns A method decorator that classifies failures into
 * `Result<T, HomeError>`.
 */
export const validate =
  <T>({ context, schema }: { context: string; schema: z.ZodType<T> }) =>
  <TArgs extends readonly unknown[]>(
    target: (...args: TArgs) => Promise<unknown>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: TArgs) => Promise<Result<T, HomeError>>) =>
    async function newTarget(this: ValidateHost, ...args: TArgs) {
      try {
        const data = await target.call(this, ...args)
        return success(parseOrThrow(schema, data, context))
      } catch (error) {
        this.logger?.error(`[${context}] request or validation failed:`, error)
        const parseIssue =
          error instanceof Error && error.name === 'ValidationError' ?
            error.message
          : undefined
        return failure(classifyError(error, parseIssue))
      }
    }
