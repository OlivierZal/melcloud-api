import { test, vi } from 'vitest'

/**
 * Vitest fixture that installs fake timers for the duration of a test
 * and restores real timers on teardown. Replaces the
 * `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())`
 * pair that was duplicated across 13+ test files.
 *
 * Uses `{ auto: true }` so the fixture applies to every test without
 * needing to be destructured in the test signature — no code change
 * at each call site beyond swapping `test`/`it` for `fakeTimersTest`.
 *
 * Scoped per-test: a failure in one test does not leak fake timers
 * into the next.
 * @example
 * ```ts
 * import { fakeTimersTest as it } from '../fixtures/fake-timers.ts'
 *
 * it('waits 1s', async () => {
 *   const spy = vi.fn()
 *   setTimeout(spy, 1000)
 *   await vi.advanceTimersByTimeAsync(1000)
 *   expect(spy).toHaveBeenCalledOnce()
 * })
 * ```
 */
export const fakeTimersTest = test.extend<{ fakeTimers: null }>({
  fakeTimers: [
    // eslint-disable-next-line no-empty-pattern -- vitest fixture signature
    async ({}, use): Promise<void> => {
      vi.useFakeTimers()
      await use(null)
      vi.useRealTimers()
    },
    { auto: true },
  ],
})
