import type { z } from 'zod'

import type { Logger } from '../api/index.ts'
import { parseOrThrow } from '../validation/index.ts'

/** Host contract for {@link validate}: optional logger for diagnostics. */
interface ValidateHost {
  readonly logger?: Logger
}

/**
 * Method decorator factory that runs the method body, then validates
 * its resolved value against a Zod schema. On successful parse the
 * parsed (narrowed) data is returned; on **any** failure (the method
 * rejecting, the parse rejecting, or the shape mismatching) the
 * decorator logs via `host.logger.error` and resolves to `null`.
 *
 * This centralizes the "best-effort fetch-and-parse" contract shared
 * by `HomeAPI.getEnergy`, `getSignal`, `getTemperatures`,
 * `getErrorLog`: the consumer sees `T | null` and the SDK never leaks
 * raw transport errors, but a logger-equipped host still gets a
 * diagnostic for every swallowed failure — no more silent blind
 * spots.
 *
 * Type contract: the decorated method body is expected to return the
 * schema-typed shape (i.e. the method signature is
 * `Promise<T | null>`, where `T = z.infer<typeof schema>`). The
 * `| null` half is injected by this decorator at runtime; the body
 * itself produces the `T` half.
 * @param root0 - Options object.
 * @param root0.schema - Zod schema describing the expected shape.
 * @param root0.context - Label embedded in validation errors and
 * logger messages for traceability (e.g. `'BFF /report/trendsummary'`).
 * @returns A method decorator that parses + nullifies-on-failure.
 */
export const validate =
  <T>({ context, schema }: { context: string; schema: z.ZodType<T> }) =>
  <TArgs extends readonly unknown[]>(
    target: (...args: TArgs) => Promise<unknown>,
    _context: ClassMethodDecoratorContext,
  ): ((...args: TArgs) => Promise<T | null>) =>
    async function newTarget(this: ValidateHost, ...args: TArgs) {
      try {
        const data = await target.call(this, ...args)
        return parseOrThrow(schema, data, context)
      } catch (error) {
        this.logger?.error(`[${context}] request or validation failed:`, error)
        return null
      }
    }
