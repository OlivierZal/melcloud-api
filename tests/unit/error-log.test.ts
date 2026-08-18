import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveErrorLogWindow } from '../../src/error-log.ts'
import { Temporal } from '../../src/temporal.ts'

describe(resolveErrorLogWindow, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stacks pages backwards from `to` in one-day-separated windows', () => {
    // offset=2, period=5 → daysBack = 2 * (5 + 1) = 12:
    // toDate = 2024-06-01 - 12d, fromDate = toDate - 5d.
    expect(
      resolveErrorLogWindow({ offset: 2, period: 5, to: '2024-06-01' }),
    ).toStrictEqual({
      fromDate: '2024-05-15',
      nextFromDate: '2024-05-09',
      nextToDate: '2024-05-14',
      toDate: '2024-05-20',
    })
  })

  it('pins the window on `from` and ignores the offset', () => {
    expect(
      resolveErrorLogWindow({
        from: '2024-05-01',
        offset: 3,
        period: 29,
        to: '2024-05-30',
      }),
    ).toStrictEqual({
      fromDate: '2024-05-01',
      nextFromDate: '2024-04-01',
      nextToDate: '2024-04-30',
      toDate: '2024-05-30',
    })
  })

  it('defaults `to` to today in the given timezone and `period` to one day', () => {
    const spy = vi
      .spyOn(Temporal.Now, 'plainDateISO')
      .mockReturnValue(Temporal.PlainDate.from('2026-03-01'))

    expect(resolveErrorLogWindow({}, 'Pacific/Kiritimati')).toStrictEqual({
      fromDate: '2026-02-28',
      nextFromDate: '2026-02-26',
      nextToDate: '2026-02-27',
      toDate: '2026-03-01',
    })
    expect(spy).toHaveBeenCalledWith('Pacific/Kiritimati')
  })

  it('treats an empty-string bound like an absent one', () => {
    expect(
      resolveErrorLogWindow({ from: '', period: 29, to: '2026-03-31' }),
    ).toStrictEqual({
      fromDate: '2026-03-02',
      nextFromDate: '2026-01-31',
      nextToDate: '2026-03-01',
      toDate: '2026-03-31',
    })
  })

  it('throws with the historical Invalid DateTime prefix on a bad bound', () => {
    expect(() => resolveErrorLogWindow({ to: 'not-a-date' })).toThrow(
      'Invalid DateTime: not-a-date',
    )
    expect(() =>
      resolveErrorLogWindow({ from: 'nope', to: '2026-03-31' }),
    ).toThrow('Invalid DateTime: nope')
  })
})
