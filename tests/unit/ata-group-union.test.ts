import { setImmediate } from 'node:timers/promises'

import { type Mock, describe, expect, it, vi } from 'vitest'

import {
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicOperationMode,
  ClassicVertical,
} from '../../src/constants.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import {
  type AtaGroup,
  combineAtaGroups,
} from '../../src/facades/ata-group-union.ts'
import {
  type ClassicGroupState,
  type Result,
  err,
  ok,
} from '../../src/types/index.ts'

const HEATING: ClassicGroupState = {
  FanSpeed: ClassicFanSpeed.moderate,
  OperationMode: ClassicOperationMode.heat,
  Power: true,
  SetTemperature: 21,
  VaneHorizontalDirection: ClassicHorizontal.auto,
  VaneVerticalDirection: ClassicVertical.auto,
}

const DELTA: ClassicGroupState = { SetTemperature: 22 }

const STILL_PENDING = 'still pending'

// A group whose read, member modes and write each test scripts: the
// combination is judged by what it asks of its groups and what it makes
// of their answers, whatever dialect would serve them.
interface GroupDouble {
  readonly getGroup: Mock<AtaGroup['getGroup']>
  readonly getMemberOperationModes: Mock<AtaGroup['getMemberOperationModes']>
  readonly updateGroupState: Mock<AtaGroup['updateGroupState']>
}

const groupDouble = (state: ClassicGroupState = HEATING): GroupDouble => ({
  getGroup: vi.fn<AtaGroup['getGroup']>().mockResolvedValue(ok(state)),
  getMemberOperationModes: vi
    .fn<AtaGroup['getMemberOperationModes']>()
    .mockReturnValue([]),
  updateGroupState: vi.fn<AtaGroup['updateGroupState']>().mockResolvedValue(),
})

describe(combineAtaGroups, () => {
  it('folds the fields the groups agree on to their value, a divergent one to null', async () => {
    const combined = combineAtaGroups([
      groupDouble(),
      groupDouble({ ...HEATING, OperationMode: ClassicOperationMode.cool }),
    ])

    await expect(combined.getGroup()).resolves.toStrictEqual(
      ok({ ...HEATING, OperationMode: null }),
    )
  })

  it('keeps a field one group already reads as mixed at null', async () => {
    const combined = combineAtaGroups([
      groupDouble({ ...HEATING, Power: null }),
      groupDouble(),
    ])

    await expect(combined.getGroup()).resolves.toStrictEqual(
      ok({ ...HEATING, Power: null }),
    )
  })

  it('answers the first failed read in group order as is, never a fold of the groups that answered', async () => {
    const classicFailure = err({ kind: 'network' })
    const homeFailure = err({ kind: 'unauthorized' })
    const classicGate: PromiseWithResolvers<Result<ClassicGroupState>> =
      Promise.withResolvers()
    const failingClassic = groupDouble()
    const failingHome = groupDouble()
    failingClassic.getGroup.mockReturnValue(classicGate.promise)
    failingHome.getGroup.mockResolvedValue(homeFailure)
    const read = combineAtaGroups([
      groupDouble(),
      failingClassic,
      failingHome,
    ]).getGroup()
    // Every pending microtask runs first: the later group's failure has
    // settled before the earlier group's.
    await setImmediate()
    classicGate.resolve(classicFailure)

    await expect(read).resolves.toBe(classicFailure)
  })

  it('reads every group at once', async () => {
    const gate: PromiseWithResolvers<Result<ClassicGroupState>> =
      Promise.withResolvers()
    const first = groupDouble()
    const second = groupDouble()
    first.getGroup.mockReturnValue(gate.promise)
    const read = combineAtaGroups([first, second]).getGroup()

    expect(second.getGroup).toHaveBeenCalledExactlyOnceWith()

    gate.resolve(ok(HEATING))

    await expect(read).resolves.toStrictEqual(ok(HEATING))
  })

  it('concatenates the member modes in group order, the filter passed to every group', () => {
    const first = groupDouble()
    const second = groupDouble()
    first.getMemberOperationModes.mockReturnValue([ClassicOperationMode.heat])
    second.getMemberOperationModes.mockReturnValue([
      ClassicOperationMode.cool,
      ClassicOperationMode.dry,
    ])

    expect(
      combineAtaGroups([first, second]).getMemberOperationModes({
        poweredOnly: true,
      }),
    ).toStrictEqual([
      ClassicOperationMode.heat,
      ClassicOperationMode.cool,
      ClassicOperationMode.dry,
    ])
    expect(first.getMemberOperationModes).toHaveBeenCalledWith({
      poweredOnly: true,
    })
    expect(second.getMemberOperationModes).toHaveBeenCalledWith({
      poweredOnly: true,
    })
  })

  it('sends the same delta to every group at once', async () => {
    const gate: PromiseWithResolvers<void> = Promise.withResolvers()
    const first = groupDouble()
    const second = groupDouble()
    first.updateGroupState.mockReturnValue(gate.promise)
    const write = combineAtaGroups([first, second]).updateGroupState(DELTA)

    expect(first.updateGroupState).toHaveBeenCalledWith(DELTA)
    expect(second.updateGroupState).toHaveBeenCalledWith(DELTA)

    gate.resolve()

    await expect(write).resolves.toBeUndefined()
  })

  it('lets every other write finish, then rethrows the one failure itself', async () => {
    const failure = new Error('Home refused the write')
    const gate: PromiseWithResolvers<void> = Promise.withResolvers()
    const failing = groupDouble()
    const pending = groupDouble()
    failing.updateGroupState.mockRejectedValue(failure)
    pending.updateGroupState.mockReturnValue(gate.promise)
    const write = combineAtaGroups([failing, pending]).updateGroupState(DELTA)
    // Every pending microtask runs first: a failure that did not wait for
    // the other write would have settled the combined one by now, and
    // would win the race against the already resolved marker.
    await setImmediate()

    await expect(
      Promise.race([write, Promise.resolve(STILL_PENDING)]),
    ).resolves.toBe(STILL_PENDING)

    gate.resolve()

    await expect(write).rejects.toBe(failure)
  })

  it('bundles several failures into one AggregateError, in group order', async () => {
    const classicFailure = new Error('Classic refused the write')
    const homeFailure = new Error('Home refused the write')
    const classicGate: PromiseWithResolvers<void> = Promise.withResolvers()
    const failingClassic = groupDouble()
    const failingHome = groupDouble()
    failingClassic.updateGroupState.mockReturnValue(classicGate.promise)
    failingHome.updateGroupState.mockRejectedValue(homeFailure)
    const write = combineAtaGroups([
      failingClassic,
      failingHome,
    ]).updateGroupState(DELTA)
    // Every pending microtask runs first: the later group's failure has
    // settled before the earlier group's.
    await setImmediate()
    classicGate.reject(classicFailure)

    await expect(write).rejects.toStrictEqual(
      new AggregateError(
        [classicFailure, homeFailure],
        'Group update failed on groups',
      ),
    )
  })

  it("counts a group's NoChangesError as success, as one group counts its members'", async () => {
    const unchanged = groupDouble()
    const other = groupDouble()
    unchanged.updateGroupState.mockRejectedValue(new NoChangesError(1))

    await expect(
      combineAtaGroups([unchanged, other]).updateGroupState({}),
    ).resolves.toBeUndefined()
    expect(other.updateGroupState).toHaveBeenCalledWith({})
  })

  it('answers the all-null state, no member mode and a resolved write over no group', async () => {
    const combined = combineAtaGroups([])

    await expect(combined.getGroup()).resolves.toStrictEqual(
      ok({
        FanSpeed: null,
        OperationMode: null,
        Power: null,
        SetTemperature: null,
        VaneHorizontalDirection: null,
        VaneVerticalDirection: null,
      }),
    )
    expect(
      combined.getMemberOperationModes({ poweredOnly: false }),
    ).toStrictEqual([])
    await expect(combined.updateGroupState(DELTA)).resolves.toBeUndefined()
  })
})
