import { setImmediate } from 'node:timers/promises'

import { cast } from '@olivierzal/api-core/testing'
import { type Mock, describe, expect, it, vi } from 'vitest'

import type { HolidayModeUpdate } from '../../src/holiday-mode.ts'
import type { ProtectionUpdate } from '../../src/protection.ts'
import {
  type SettingsTarget,
  combineSettingsTargets,
} from '../../src/facades/settings-union.ts'
import { type Result, err, ok } from '../../src/types/index.ts'

const STILL_PENDING = 'still pending'

const FROST = { isEnabled: true, max: 14, min: 10 }
const FROST_UPDATE: ProtectionUpdate = { isEnabled: true, max: 12, min: 8 }
const HOLIDAY = {
  endDate: '2026-12-01T08:00:00',
  isEnabled: true,
  startDate: '2026-11-24T08:00:00',
}
const HOLIDAY_UPDATE: HolidayModeUpdate = {
  endDate: '2026-12-08T08:00',
  isEnabled: true,
  startDate: '2026-12-01T08:00',
}

// A target that answers both settings and takes both writes: the
// combination is judged by what it asks of its targets and what it
// makes of their answers, whatever dialect would serve them.
const idleTarget = (): SettingsTarget => ({
  getFrostProtection: vi
    .fn<SettingsTarget['getFrostProtection']>()
    .mockResolvedValue(ok(FROST)),
  getHolidayMode: vi
    .fn<SettingsTarget['getHolidayMode']>()
    .mockResolvedValue(ok(HOLIDAY)),
  updateFrostProtection: vi
    .fn<SettingsTarget['updateFrostProtection']>()
    .mockResolvedValue(),
  updateHolidayMode: vi
    .fn<SettingsTarget['updateHolidayMode']>()
    .mockResolvedValue(),
})

// One setting's seams, each typed where it is declared: reading it off
// a target, writing it, and a target scripted on either. `cast` is the
// one widening, a scripted answer standing for whatever a dialect reads.
interface SettingSeams {
  readonly read: (target: SettingsTarget) => Promise<Result<unknown>>
  readonly reading: (answer: Promise<Result<unknown>>) => SettingsTarget
  readonly write: (target: SettingsTarget) => Promise<void>
  readonly writing: (outcome: Promise<void>) => {
    readonly sent: Mock
    readonly target: SettingsTarget
  }
}

const frostSeams: SettingSeams = {
  read: async (target) => target.getFrostProtection(),
  reading: (answer) => ({
    ...idleTarget(),
    getFrostProtection: async () => cast(await answer),
  }),
  write: async (target) => target.updateFrostProtection(FROST_UPDATE),
  writing: (outcome) => {
    const sent = vi
      .fn<SettingsTarget['updateFrostProtection']>()
      .mockReturnValue(outcome)
    return { sent, target: { ...idleTarget(), updateFrostProtection: sent } }
  },
}

const holidaySeams: SettingSeams = {
  read: async (target) => target.getHolidayMode(),
  reading: (answer) => ({
    ...idleTarget(),
    getHolidayMode: async () => cast(await answer),
  }),
  write: async (target) => target.updateHolidayMode(HOLIDAY_UPDATE),
  writing: (outcome) => {
    const sent = vi
      .fn<SettingsTarget['updateHolidayMode']>()
      .mockReturnValue(outcome)
    return { sent, target: { ...idleTarget(), updateHolidayMode: sent } }
  },
}

// The two settings answer one policy, so each clause is said once and
// run on both: the reads fold field by field and fail closed, the
// writes reach every target and settle together. `divergent` differs
// from `state` on its `mixedField` alone.
const SETTINGS = [
  {
    allNull: { isEnabled: null, max: null, min: null },
    divergent: { ...FROST, max: 16 },
    failureMessage: 'Frost protection update failed on targets',
    mixedField: 'max',
    name: 'frost protection',
    neverConfigured: { isEnabled: false, max: null, min: null },
    seams: frostSeams,
    state: FROST,
    update: FROST_UPDATE,
  },
  {
    allNull: { endDate: null, isEnabled: null, startDate: null },
    divergent: { ...HOLIDAY, endDate: '2026-12-02T08:00:00' },
    failureMessage: 'Holiday mode update failed on targets',
    mixedField: 'endDate',
    name: 'holiday mode',
    neverConfigured: { endDate: null, isEnabled: false, startDate: null },
    seams: holidaySeams,
    state: HOLIDAY,
    update: HOLIDAY_UPDATE,
  },
]

describe.each(SETTINGS)(
  'combineSettingsTargets — $name',
  ({
    allNull,
    divergent,
    failureMessage,
    mixedField,
    neverConfigured,
    seams: { read, reading, write, writing },
    state,
    update,
  }) => {
    const answering = (answer: Result<unknown>): SettingsTarget =>
      reading(Promise.resolve(answer))

    it('folds the fields the targets agree on to their value, a divergent one to null', async () => {
      const combined = combineSettingsTargets([
        answering(ok(state)),
        answering(ok(divergent)),
      ])

      await expect(read(combined)).resolves.toStrictEqual(
        ok({ ...state, [mixedField]: null }),
      )
    })

    it('reads a target never configured as off, its bounds unset', async () => {
      const combined = combineSettingsTargets([
        answering(ok(null)),
        answering(ok(null)),
      ])

      await expect(read(combined)).resolves.toStrictEqual(ok(neverConfigured))
    })

    // A Home building answers a fold already. Its mixed flag must stay
    // mixed beside a target that is off: read as "off" it would fold to
    // a house that is off everywhere.
    it('keeps a field one target already reads as mixed at null', async () => {
      const combined = combineSettingsTargets([
        answering(ok({ ...state, isEnabled: null })),
        answering(ok({ ...state, isEnabled: false })),
      ])

      await expect(read(combined)).resolves.toStrictEqual(
        ok({ ...state, isEnabled: null }),
      )
    })

    it('answers the first failed read in target order as is, never a fold of the targets that answered', async () => {
      const classicFailure = err({ kind: 'network' })
      const gate: PromiseWithResolvers<Result<unknown>> =
        Promise.withResolvers()
      const pending = read(
        combineSettingsTargets([
          answering(ok(state)),
          reading(gate.promise),
          answering(err({ kind: 'unauthorized' })),
        ]),
      )
      // Every pending microtask runs first: the later target's failure
      // has settled before the earlier target's.
      await setImmediate()
      gate.resolve(classicFailure)

      await expect(pending).resolves.toBe(classicFailure)
    })

    it('answers the all-null state and a resolved write over no target', async () => {
      const combined = combineSettingsTargets([])

      await expect(read(combined)).resolves.toStrictEqual(ok(allNull))
      await expect(write(combined)).resolves.toBeUndefined()
    })

    it('sends the same update to every target, lets every write finish, then rethrows the one failure itself', async () => {
      const failure = new Error('Home refused the write')
      const gate: PromiseWithResolvers<void> = Promise.withResolvers()
      const failing = writing(Promise.reject(failure))
      const slow = writing(gate.promise)
      const pending = write(
        combineSettingsTargets([failing.target, slow.target]),
      )
      // Every pending microtask runs first: a failure that did not wait
      // for the other write would have settled the combined one by now.
      await setImmediate()

      await expect(
        Promise.race([pending, Promise.resolve(STILL_PENDING)]),
      ).resolves.toBe(STILL_PENDING)
      expect(failing.sent).toHaveBeenCalledExactlyOnceWith(update)
      expect(slow.sent).toHaveBeenCalledExactlyOnceWith(update)

      gate.resolve()

      await expect(pending).rejects.toBe(failure)
    })

    it('bundles several failures into one AggregateError, in target order', async () => {
      const failures = [
        new Error('Classic refused the write'),
        new Error('Home refused the write'),
      ]
      const combined = combineSettingsTargets(
        failures.map((failure) => writing(Promise.reject(failure)).target),
      )

      await expect(write(combined)).rejects.toStrictEqual(
        new AggregateError(failures, failureMessage),
      )
    })
  },
)
