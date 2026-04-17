import diagnosticsChannel from 'node:diagnostics_channel'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type UndiciDiagnosticListener,
  subscribeUndiciDiagnostics,
  UNDICI_DIAGNOSTIC_CHANNELS,
} from '../../src/observability/undici-diagnostics.ts'

const noop: UndiciDiagnosticListener = () => {
  /* Placeholder listener for fixtures that just need a live subscription. */
}

const makeThrower =
  (error: unknown): UndiciDiagnosticListener =>
  () => {
    throw error
  }

describe(subscribeUndiciDiagnostics, () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Assigned in beforeEach
  let subscription: Disposable

  beforeEach(() => {
    /* Placeholder so afterEach always has something defined to dispose. */
    subscription = subscribeUndiciDiagnostics(noop)
  })

  afterEach(() => {
    subscription[Symbol.dispose]()
  })

  it('forwards every undici channel payload to the listener', () => {
    subscription[Symbol.dispose]()
    const listener = vi.fn<UndiciDiagnosticListener>()
    subscription = subscribeUndiciDiagnostics(listener)

    for (const [index, channel] of UNDICI_DIAGNOSTIC_CHANNELS.entries()) {
      diagnosticsChannel.channel(channel).publish({ tag: index })
    }

    expect(listener).toHaveBeenCalledTimes(UNDICI_DIAGNOSTIC_CHANNELS.length)

    for (const [index, channel] of UNDICI_DIAGNOSTIC_CHANNELS.entries()) {
      expect(listener).toHaveBeenNthCalledWith(index + 1, channel, {
        tag: index,
      })
    }
  })

  it('unsubscribes when the returned Disposable is disposed', () => {
    subscription[Symbol.dispose]()
    const listener = vi.fn<UndiciDiagnosticListener>()
    subscription = subscribeUndiciDiagnostics(listener)
    subscription[Symbol.dispose]()
    /* Re-create a no-op subscription so afterEach has something to dispose. */
    subscription = subscribeUndiciDiagnostics(noop)

    diagnosticsChannel
      .channel('undici:request:create')
      .publish({ ignored: true })

    expect(listener).not.toHaveBeenCalled()
  })

  it('routes listener exceptions to onListenerError', () => {
    subscription[Symbol.dispose]()
    const error = new Error('listener boom')
    const onError = vi.fn<(error: unknown) => void>()
    subscription = subscribeUndiciDiagnostics(makeThrower(error), onError)

    diagnosticsChannel.channel('undici:request:create').publish({})

    expect(onError).toHaveBeenCalledWith(error)
  })

  it('swallows listener exceptions when no onListenerError is provided', () => {
    subscription[Symbol.dispose]()
    subscription = subscribeUndiciDiagnostics(makeThrower(new Error('boom')))

    expect(() => {
      diagnosticsChannel.channel('undici:request:create').publish({})
    }).not.toThrow()
  })
})
