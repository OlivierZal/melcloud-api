import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isWithinErrorLogWindow,
  resolveErrorLogWindow,
} from '../../src/error-log.ts'
import { Temporal } from '../../src/temporal.ts'

const toEpochMs = (instant: string): number =>
  Temporal.Instant.from(instant).epochMilliseconds

describe(resolveErrorLogWindow, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stacks pages backwards from `to` in one-day-separated windows', () => {
    // `offset=2`, `period=5` → daysBack = 2 * (5 + 1) = 12:
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

describe(isWithinErrorLogWindow, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const olderPage = { fromDate: '2026-03-02', to: '2026-03-31' }

  // Both bounds are days, inclusive.
  it.each([
    { at: '2026-03-02T00:00:00Z', isWithin: true },
    { at: '2026-03-31T23:59:59Z', isWithin: true },
    { at: '2026-03-01T23:59:59Z', isWithin: false },
    { at: '2026-04-01T00:00:00Z', isWithin: false },
  ])(
    'files the entry of $at into an older page: $isWithin',
    ({ at, isWithin }) => {
      expect(
        isWithinErrorLogWindow({ atEpochMs: toEpochMs(at) }, olderPage, 'UTC'),
      ).toBe(isWithin)
    },
  )

  // An entry dated after today, a clock ahead of the host's, is not lost.
  it.each([undefined, ''])('gives the newest page (to: %o) no end', (to) => {
    expect(
      isWithinErrorLogWindow(
        { atEpochMs: toEpochMs('2099-01-01T00:00:00Z') },
        { fromDate: '2026-03-02', to },
        'UTC',
      ),
    ).toBe(true)
  })

  it('holds an entry with no instant on the newest page alone', () => {
    expect(
      isWithinErrorLogWindow(
        { atEpochMs: null },
        { fromDate: '2026-03-02' },
        'UTC',
      ),
    ).toBe(true)
    expect(isWithinErrorLogWindow({ atEpochMs: null }, olderPage, 'UTC')).toBe(
      false,
    )
  })

  // Offset pages carry no `to` of their own: each passes its resolved
  // end, the newest alone none, and every entry lands on exactly one
  // page, an undated one on the newest.
  it('files each entry on exactly one offset page', () => {
    vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(
      Temporal.PlainDate.from('2026-11-20'),
    )
    const pages = [0, 1, 2].map((offset) => {
      const { fromDate, toDate } = resolveErrorLogWindow(
        { offset, period: 29 },
        'UTC',
      )
      return offset === 0 ? { fromDate } : { fromDate, to: toDate }
    })
    const entries = [
      '2099-01-01T00:00:00Z',
      '2026-11-15T12:00:00Z',
      '2026-10-01T12:00:00Z',
      '2026-08-30T12:00:00Z',
    ].map((at) => ({ atEpochMs: toEpochMs(at) }))

    expect(
      [...entries, { atEpochMs: null }].map((entry) =>
        pages.map((page) => isWithinErrorLogWindow(entry, page, 'UTC')),
      ),
    ).toStrictEqual([
      [true, false, false],
      [true, false, false],
      [false, true, false],
      [false, false, true],
      [true, false, false],
    ])
  })

  // 23:30 UTC on 1 March is 00:30 on 2 March in Paris.
  it('reads the entry day in the given timezone', () => {
    const entry = { atEpochMs: toEpochMs('2026-03-01T23:30:00Z') }
    const firstDay = { fromDate: '2026-03-02', to: '2026-03-02' }

    expect(isWithinErrorLogWindow(entry, firstDay, 'Europe/Paris')).toBe(true)
    expect(isWithinErrorLogWindow(entry, firstDay, 'UTC')).toBe(false)
  })

  it('reads the entry day in the host timezone when none is given', () => {
    const spy = vi
      .spyOn(Temporal.Now, 'timeZoneId')
      .mockReturnValue('Europe/Paris')

    expect(
      isWithinErrorLogWindow(
        { atEpochMs: toEpochMs('2026-03-01T23:30:00Z') },
        { fromDate: '2026-03-02', to: '2026-03-02' },
      ),
    ).toBe(true)
    expect(spy).toHaveBeenCalledWith()
  })

  it('throws with the historical Invalid DateTime prefix on a bad bound', () => {
    expect(() =>
      isWithinErrorLogWindow({ atEpochMs: null }, { fromDate: 'nope' }),
    ).toThrow('Invalid DateTime: nope')
    expect(() =>
      isWithinErrorLogWindow(
        { atEpochMs: null },
        { fromDate: '2026-03-02', to: 'not-a-date' },
      ),
    ).toThrow('Invalid DateTime: not-a-date')
  })
})
