import diagnosticsChannel from 'node:diagnostics_channel'

/**
 * Named diagnostics_channel topics emitted by Node's built-in `undici`
 * (the transport behind `fetch` on Node ≥ 18). Exposed verbatim so
 * consumers can match on a stable string rather than a TypeScript
 * enum that would drift with undici versions.
 */
export const UNDICI_DIAGNOSTIC_CHANNELS: readonly string[] = [
  'undici:client:beforeConnect',
  'undici:client:connected',
  'undici:client:connectError',
  'undici:request:create',
  'undici:request:error',
  'undici:request:headers',
  'undici:request:trailers',
]

/** Signature of the consumer callback passed to {@link subscribeUndiciDiagnostics}. */
export type UndiciDiagnosticListener = (
  channel: string,
  payload: unknown,
) => void

/**
 * Subscribe a single listener to every undici diagnostics channel.
 * Returns a `Disposable` whose `[Symbol.dispose]()` detaches the
 * subscriptions so teardown stays symmetrical with the existing
 * Disposable pattern used by `BaseAPI`.
 *
 * Listener exceptions are swallowed (the function already runs inside
 * Node's internal dispatch loop — a throw would brick unrelated
 * requests) and surfaced via `onListenerError` when provided.
 * @param listener - Consumer callback invoked with `(channel, payload)`.
 * @param onListenerError - Optional error sink for listener exceptions.
 * @returns A `Disposable` that unsubscribes when disposed.
 */
export const subscribeUndiciDiagnostics = (
  listener: UndiciDiagnosticListener,
  onListenerError?: (error: unknown) => void,
): Disposable => {
  const safeInvoke = (channel: string, payload: unknown): void => {
    try {
      listener(channel, payload)
    } catch (error) {
      onListenerError?.(error)
    }
  }
  const subscriptions = UNDICI_DIAGNOSTIC_CHANNELS.map((channel) => {
    const wrapped = (payload: unknown): void => {
      safeInvoke(channel, payload)
    }
    diagnosticsChannel.subscribe(channel, wrapped)
    return [channel, wrapped] as const
  })
  return {
    [Symbol.dispose]: (): void => {
      for (const [channel, wrapped] of subscriptions) {
        diagnosticsChannel.unsubscribe(channel, wrapped)
      }
    },
  }
}
