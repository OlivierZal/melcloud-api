import { expect } from 'vitest'

import type { Result } from '../src/types/index.ts'

// What is OURS alone. Everything the SDK suites used to copy by hand —
// `cast`, `defined`, `mock`, the logger/setting-store doubles, the
// transport spy, the fetch `Response` mock, the `HttpError` factories,
// the native-`Temporal` clock spies — comes from
// `@olivierzal/api-core/testing` since 1.3.0, proven in the core's own
// suite before a consumer inherits it. The three below name this SDK's
// specifics: the `Result` type and the vitest matcher/envelope shapes
// its suites assert on.

// Wrap `expect.objectContaining` so call sites get a `never`-typed
// matcher (assignable anywhere) instead of `any` — the latter trips
// `@typescript-eslint/no-unsafe-assignment` when nested inside another
// matcher's shape literal. Keeps the unsafe-return concession at one
// boundary instead of scattered across every test file.
export function matchObject(shape: object): never
export function matchObject(shape: object): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- vitest's `objectContaining` is typed `any`; this helper is the single boundary that scopes the concession
  return expect.objectContaining(shape)
}

/**
 * Test-only helper: assert that a `Result` is `ok` and return its value.
 * Lets tests assert on the success payload without manual narrowing
 * boilerplate at every call site (`result.ok && result.value.X`).
 * @param result - The {@link Result} to unwrap.
 * @returns The success value.
 * @throws An `Error` summarising the failure variant when `result.ok` is `false`.
 */
export const okValue = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(`Expected ok result, got ${JSON.stringify(result.error)}`)
  }
  return result.value
}

const HTTP_OK = 200

export const mockResponse = (
  data: unknown,
  headers: Record<string, string | string[]> = {},
  status: number = HTTP_OK,
): {
  data: unknown
  headers: Record<string, string | string[]>
  status: number
} => ({ data, headers, status })
