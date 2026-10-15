import { expect } from 'vitest'

import type { Result } from '../src/types/index.ts'

// What is OURS alone. Everything the SDK suites used to copy by hand —
// `cast`, `defined`, `mock`, the logger/setting-store doubles, the
// transport spy, the fetch `Response` mock, the `HttpError` factories,
// the native-`Temporal` clock spies, the `HttpResponse` envelope — comes
// from `@olivierzal/api-core/testing` since 1.3.0 (1.13.0 for the
// envelope), proven in the core's own suite before a consumer inherits
// it. The two below name this SDK's specifics: the `Result` type and
// the vitest matcher shape its suites assert on.

// Wrap `expect.objectContaining` so call sites get a `never`-typed
// matcher (assignable anywhere) instead of `any` — the latter trips
// `@typescript-eslint/no-unsafe-assignment` when nested inside another
// matcher's shape literal. Keeps the unsafe-return concession at one
// boundary instead of scattered across every test file.
export function matchObject(shape: object): never
export function matchObject(shape: object): unknown {
  // Vitest types `objectContaining` as `any`; funnelled through `unknown`
  // here, the one boundary, so no call site meets the `any`.
  const matcher: unknown = expect.objectContaining(shape)
  return matcher
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
