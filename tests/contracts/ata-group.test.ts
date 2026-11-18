import { cast, defined, mock } from '@olivierzal/api-core/testing'
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { ClassicRegistry } from '../../src/entities/index.ts'
import type { HomeBuildingFacade } from '../../src/facades/home-building.ts'
import {
  type ClassicDeviceType,
  type ClassicNonSilentFanSpeed,
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicOperationMode,
  ClassicVertical,
} from '../../src/constants.ts'
import {
  type TypedHomeDeviceData,
  HomeRegistry,
} from '../../src/entities/home-registry.ts'
import {
  horizontalFromClassic,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
} from '../../src/enum-mappings.ts'
import { combineAtaGroups } from '../../src/facades/ata-group-union.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import {
  type ClassicGroupState,
  type ClassicSetDevicePostData,
  type HomeAtaValues,
  ok,
} from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicAtaDeviceData,
  classicAtwDevice,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { okValue } from '../helpers.ts'
import {
  createMockHomeApi,
  homeBuildingRef,
  homeDevice,
  resetHomeDevices,
  typedHomeAtwDeviceData,
  typedHomeDeviceData,
} from '../home-fixtures.ts'

// The ATA group is ONE vocabulary on both dialects: `ClassicGroupState`
// is the shape every implementation answers and accepts —
// Classic-numbered whatever API served it, `null` the shared
// leave-unchanged/mixed sentinel. The mechanics differ and are not the
// contract: Classic zones ride the native group endpoints, the Home
// building aggregates and fans out over its members, each device facade
// emulates a group of one over its own state, and the combination folds
// and fans out over whole groups — a Classic zone and a Home building
// here, the two accounts of one house.

// The neutral snapshot every leg encodes into its own wire: all fields
// set (a group of one can never be mixed), values asymmetric so a field
// swap has to change the result.
interface GroupSnapshot {
  readonly fanSpeed: ClassicNonSilentFanSpeed
  readonly isOn: boolean
  readonly mode: ClassicOperationMode
  readonly setTemperature: number
  readonly vaneHorizontal: ClassicHorizontal
  readonly vaneVertical: ClassicVertical
}

const toGroupState = (snapshot: GroupSnapshot): ClassicGroupState => ({
  FanSpeed: snapshot.fanSpeed,
  OperationMode: snapshot.mode,
  Power: snapshot.isOn,
  SetTemperature: snapshot.setTemperature,
  VaneHorizontalDirection: snapshot.vaneHorizontal,
  VaneVerticalDirection: snapshot.vaneVertical,
})

const READ_CASES: readonly {
  readonly label: string
  readonly snapshot: GroupSnapshot
}[] = [
  {
    label: 'heating snapshot',
    snapshot: {
      fanSpeed: ClassicFanSpeed.moderate,
      isOn: true,
      mode: ClassicOperationMode.heat,
      setTemperature: 23.5,
      vaneHorizontal: ClassicHorizontal.auto,
      vaneVertical: ClassicVertical.auto,
    },
  },
  {
    label: 'cooling snapshot on a stopped unit',
    snapshot: {
      fanSpeed: ClassicFanSpeed.slow,
      isOn: false,
      mode: ClassicOperationMode.cool,
      setTemperature: 19,
      vaneHorizontal: ClassicHorizontal.swing,
      vaneVertical: ClassicVertical.swing,
    },
  },
]

// Encodes a snapshot as the Home `/context` settings dialect (booleans
// as 'True'/'False', the fan speed as the wire's stringified number).
const toHomeSettings = (snapshot: GroupSnapshot): Record<string, string> => ({
  OperationMode: operationModeFromClassic[snapshot.mode],
  Power: snapshot.isOn ? 'True' : 'False',
  SetFanSpeed: String(snapshot.fanSpeed),
  SetTemperature: String(snapshot.setTemperature),
  VaneHorizontalDirection: horizontalFromClassic[snapshot.vaneHorizontal],
  VaneVerticalDirection: verticalFromClassic[snapshot.vaneVertical],
})

const classicSnapshotRegistry = (snapshot: GroupSnapshot): ClassicRegistry =>
  populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [
      classicAtaDevice({
        Device: classicAtaDeviceData({
          FanSpeed: snapshot.fanSpeed,
          OperationMode: snapshot.mode,
          Power: snapshot.isOn,
          SetTemperature: snapshot.setTemperature,
          VaneHorizontalDirection: snapshot.vaneHorizontal,
          VaneVerticalDirection: snapshot.vaneVertical,
        }),
      }),
    ],
  })

// A Home building over its own private registry, so member setups never
// leak into the shared test registry.
const homeBuildingOf = (
  members: readonly TypedHomeDeviceData[],
  api: HomeAPIAdapter = createMockHomeApi({ registry: new HomeRegistry() }),
): HomeBuildingFacade => {
  api.registry.syncDevices([...members])
  const manager = new HomeFacadeManager(api)
  const facade = manager.getBuilding('home-building-1')
  if (facade === null) {
    throw new Error('building facade not resolved')
  }
  return facade
}

/**
 * Runs the group READ contract against one implementation: the leg
 * encodes the neutral snapshot into its own wire and reads it back
 * through the real facade.
 * @param name - Implementation label used in the test titles.
 * @param read - Encodes the snapshot and reads the group state back.
 */
const describeAtaGroupReadContract = (
  name: string,
  read: (snapshot: GroupSnapshot) => Promise<ClassicGroupState>,
): void => {
  describe(`ataGroup read — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(READ_CASES)(
      'answers a $label in the one group vocabulary',
      async ({ snapshot }) => {
        await expect(read(snapshot)).resolves.toStrictEqual(
          toGroupState(snapshot),
        )
      },
    )
  })
}

// A Classic building zone whose native group endpoint answers the
// snapshot.
const classicZoneAnswering = (
  snapshot: GroupSnapshot,
): ClassicBuildingFacade => {
  const registry = classicSnapshotRegistry(snapshot)
  const wireResponse = ok(
    cast({ Data: { Group: { State: toGroupState(snapshot) } } }),
  )
  const api = createMockClassicApi({
    getGroup: vi
      .fn<ClassicAPIAdapter['getGroup']>()
      .mockResolvedValue(wireResponse),
    registry,
  })
  return new ClassicBuildingFacade(api, defined(registry.buildings.getById(1)))
}

// A Home building whose two members both hold the snapshot.
const homeBuildingHolding = (snapshot: GroupSnapshot): HomeBuildingFacade =>
  homeBuildingOf([
    typedHomeDeviceData(
      { id: 'group-read-1', settings: toHomeSettings(snapshot) },
      { building: homeBuildingRef() },
    ),
    typedHomeDeviceData(
      { id: 'group-read-2', settings: toHomeSettings(snapshot) },
      { building: homeBuildingRef() },
    ),
  ])

describeAtaGroupReadContract('Classic zone', async (snapshot) =>
  okValue(await classicZoneAnswering(snapshot).getGroup()),
)

describeAtaGroupReadContract('Classic ATA device', async (snapshot) => {
  const registry = classicSnapshotRegistry(snapshot)
  const facade = new ClassicDeviceAtaFacade(
    createMockClassicApi({ registry }),
    defined(registry.devices.getById(1000)),
  )
  return okValue(await facade.getGroup())
})

describeAtaGroupReadContract('Home ATA device', async (snapshot) => {
  const facade = new HomeDeviceAtaFacade(
    createMockHomeApi(),
    homeDevice({
      id: 'contract-group-read',
      settings: toHomeSettings(snapshot),
    }),
  )
  return okValue(await facade.getGroup())
})

describeAtaGroupReadContract('Home building', async (snapshot) =>
  okValue(await homeBuildingHolding(snapshot).getGroup()),
)

describeAtaGroupReadContract('combined groups', async (snapshot) =>
  okValue(
    await combineAtaGroups([
      classicZoneAnswering(snapshot),
      homeBuildingHolding(snapshot),
    ]).getGroup(),
  ),
)

// The write side of the same vocabulary: a Classic-numbered delta in,
// its fields delivered to that implementation's own wire. What each leg
// hands back is the delivered delta decoded from its wire capture.
interface DeliveredWrite {
  readonly isOn: boolean
  readonly mode: ClassicOperationMode
  readonly setTemperature: number
}

const WRITE_DELTA: DeliveredWrite = {
  isOn: true,
  mode: ClassicOperationMode.cool,
  setTemperature: 22,
}

const toWriteState = (delta: DeliveredWrite): ClassicGroupState => ({
  OperationMode: delta.mode,
  Power: delta.isOn,
  SetTemperature: delta.setTemperature,
})

/**
 * Runs the group WRITE contract against one implementation.
 * @param name - Implementation label used in the test titles.
 * @param write - Applies the delta through the real facade and decodes
 * what reached that dialect's wire back into the neutral form.
 */
const describeAtaGroupWriteContract = (
  name: string,
  write: (state: ClassicGroupState) => Promise<DeliveredWrite>,
): void => {
  describe(`ataGroup write — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it('delivers the delta to its wire in its own dialect', async () => {
      await expect(write(toWriteState(WRITE_DELTA))).resolves.toStrictEqual(
        WRITE_DELTA,
      )
    })
  })
}

// A Classic building zone over the native group endpoint, with the
// endpoint spy that captures what reached the wire.
const classicZoneWriting = (): {
  readonly facade: ClassicBuildingFacade
  readonly updateGroupState: Mock<ClassicAPIAdapter['updateGroupState']>
} => {
  const registry = classicSnapshotRegistry(defined(READ_CASES[0]).snapshot)
  const updateGroupState = vi
    .fn<ClassicAPIAdapter['updateGroupState']>()
    .mockResolvedValue({ AttributeErrors: null, Success: true })
  return {
    facade: new ClassicBuildingFacade(
      createMockClassicApi({ registry, updateGroupState }),
      defined(registry.buildings.getById(1)),
    ),
    updateGroupState,
  }
}

const decodeClassicZoneWrite = (
  updateGroupState: Mock<ClassicAPIAdapter['updateGroupState']>,
): DeliveredWrite => {
  const { State: delivered } = defined(
    updateGroupState.mock.lastCall?.[0],
  ).postData
  return {
    isOn: defined(delivered.Power),
    mode: defined(delivered.OperationMode),
    setTemperature: defined(delivered.SetTemperature),
  }
}

describeAtaGroupWriteContract('Classic zone', async (state) => {
  const zone = classicZoneWriting()
  await zone.facade.updateGroupState(state)
  return decodeClassicZoneWrite(zone.updateGroupState)
})

describeAtaGroupWriteContract('Classic ATA device', async (state) => {
  const registry = classicSnapshotRegistry(defined(READ_CASES[0]).snapshot)
  const api = createMockClassicApi({ registry })
  const facade = new ClassicDeviceAtaFacade(
    api,
    defined(registry.devices.getById(1000)),
  )
  await facade.updateGroupState(state)
  const postData = mock<ClassicSetDevicePostData<typeof ClassicDeviceType.Ata>>(
    defined(vi.mocked(api.updateValues).mock.lastCall?.[0]).postData,
  )
  return {
    isOn: postData.Power,
    mode: postData.OperationMode,
    setTemperature: postData.SetTemperature,
  }
})

const decodeHomeWrite = (
  wireValues: Parameters<HomeAPIAdapter['updateValues']>[1],
): DeliveredWrite => {
  // The adapter's payload type is the ATA-or-ATW union; these legs only
  // ever write through ATA facades.
  const values = mock<HomeAtaValues>(wireValues)
  return {
    isOn: defined(values.power),
    mode: operationModeToClassic[defined(values.operationMode)],
    setTemperature: defined(values.setTemperature),
  }
}

const decodeHomeApiWrite = (api: HomeAPIAdapter): DeliveredWrite =>
  decodeHomeWrite(defined(vi.mocked(api.updateValues).mock.lastCall?.[1]))

describeAtaGroupWriteContract('Home ATA device', async (state) => {
  const api = createMockHomeApi()
  const facade = new HomeDeviceAtaFacade(
    api,
    homeDevice({
      id: 'contract-group-write',
      settings: toHomeSettings(defined(READ_CASES[0]).snapshot),
    }),
  )
  await facade.updateGroupState(state)
  return decodeHomeApiWrite(api)
})

// A Home building of one ATA member, over its own api double.
const homeBuildingWriting = (): {
  readonly api: HomeAPIAdapter
  readonly facade: HomeBuildingFacade
} => {
  const api = createMockHomeApi({ registry: new HomeRegistry() })
  return {
    api,
    facade: homeBuildingOf(
      [
        typedHomeDeviceData(
          {
            id: 'group-write-member',
            settings: toHomeSettings(defined(READ_CASES[0]).snapshot),
          },
          { building: homeBuildingRef() },
        ),
      ],
      api,
    ),
  }
}

describeAtaGroupWriteContract('Home building', async (state) => {
  const building = homeBuildingWriting()
  await building.facade.updateGroupState(state)
  return decodeHomeApiWrite(building.api)
})

// The combination delivers the delta to every group's wire, so the
// clause runs once per wire, each run over its own combined write.
const writeCombined = async (
  state: ClassicGroupState,
): Promise<{
  readonly classic: DeliveredWrite
  readonly home: DeliveredWrite
}> => {
  const zone = classicZoneWriting()
  const building = homeBuildingWriting()
  await combineAtaGroups([zone.facade, building.facade]).updateGroupState(state)
  return {
    classic: decodeClassicZoneWrite(zone.updateGroupState),
    home: decodeHomeApiWrite(building.api),
  }
}

describeAtaGroupWriteContract(
  'combined groups, on the Classic wire',
  async (state) => {
    const { classic } = await writeCombined(state)
    return classic
  },
)

describeAtaGroupWriteContract(
  'combined groups, on the Home wire',
  async (state) => {
    const { home } = await writeCombined(state)
    return home
  },
)

// Three implementations can answer "the members disagree", and all spell
// it the same way: `null`, the group vocabulary's mixed marker — the
// Classic zone passes the wire's own fold through, the Home building
// folds its members itself, the combination folds its groups. A group of
// one can never be mixed, so the device legs stay out by construction.
describe('ataGroup — a divergent field reads as the null mixed marker', () => {
  it('classic zone passes the wire fold through untouched', async () => {
    const registry = classicSnapshotRegistry(defined(READ_CASES[0]).snapshot)
    const wireResponse = ok(
      cast({
        Data: { Group: { State: { OperationMode: null, Power: true } } },
      }),
    )
    const facade = new ClassicBuildingFacade(
      createMockClassicApi({
        getGroup: vi
          .fn<ClassicAPIAdapter['getGroup']>()
          .mockResolvedValue(wireResponse),
        registry,
      }),
      defined(registry.buildings.getById(1)),
    )

    await expect(facade.getGroup()).resolves.toStrictEqual(
      ok({ OperationMode: null, Power: true }),
    )
  })

  it('home building folds divergent members to null, agreeing ones to the value', async () => {
    const shared = defined(READ_CASES[0]).snapshot
    const facade = homeBuildingOf([
      typedHomeDeviceData(
        { id: 'group-mixed-1', settings: toHomeSettings(shared) },
        { building: homeBuildingRef() },
      ),
      typedHomeDeviceData(
        {
          id: 'group-mixed-2',
          settings: toHomeSettings({
            ...shared,
            isOn: !shared.isOn,
            mode: ClassicOperationMode.dry,
          }),
        },
        { building: homeBuildingRef() },
      ),
    ])
    const state = okValue(await facade.getGroup())

    expect(state.OperationMode).toBeNull()
    expect(state.Power).toBeNull()
    expect(state.SetTemperature).toBe(shared.setTemperature)
  })

  it('combined groups fold a field their groups disagree on to null', async () => {
    const shared = defined(READ_CASES[0]).snapshot
    const combined = combineAtaGroups([
      classicZoneAnswering(shared),
      homeBuildingHolding({ ...shared, mode: ClassicOperationMode.dry }),
    ])
    const state = okValue(await combined.getGroup())

    expect(state.OperationMode).toBeNull()
    expect(state.Power).toBe(shared.isOn)
    expect(state.SetTemperature).toBe(shared.setTemperature)
  })
})

// The emulating implementations promise no-op tolerance: an all-null
// delta (every field the leave-unchanged sentinel) resolves without any
// wire call. The Classic zone stays out on purpose — its NATIVE group
// endpoint understands null on the wire, so it posts the delta verbatim
// (pinned below).
const ALL_NULL: ClassicGroupState = {
  FanSpeed: null,
  OperationMode: null,
  Power: null,
  SetTemperature: null,
  VaneHorizontalDirection: null,
  VaneVerticalDirection: null,
}

describe('ataGroup — an all-null delta never reaches an emulated wire', () => {
  beforeEach(resetHomeDevices)

  it('classic ATA device resolves without a wire call', async () => {
    const registry = classicSnapshotRegistry(defined(READ_CASES[0]).snapshot)
    const api = createMockClassicApi({ registry })
    const facade = new ClassicDeviceAtaFacade(
      api,
      defined(registry.devices.getById(1000)),
    )
    await facade.updateGroupState(ALL_NULL)

    expect(api.updateValues).not.toHaveBeenCalled()
  })

  it('home ATA device resolves without a wire call', async () => {
    const api = createMockHomeApi()
    const facade = new HomeDeviceAtaFacade(
      api,
      homeDevice({ id: 'contract-group-noop' }),
    )
    await facade.updateGroupState(ALL_NULL)

    expect(api.updateValues).not.toHaveBeenCalled()
  })

  it('home building resolves without a wire call', async () => {
    const api = createMockHomeApi({ registry: new HomeRegistry() })
    const facade = homeBuildingOf(
      [
        typedHomeDeviceData(
          { id: 'group-noop-member' },
          { building: homeBuildingRef() },
        ),
      ],
      api,
    )
    await facade.updateGroupState(ALL_NULL)

    expect(api.updateValues).not.toHaveBeenCalled()
  })
})

describe('ataGroup — the native zone write speaks null on the wire', () => {
  it('posts an all-null delta verbatim (null IS the wire form of leave-unchanged)', async () => {
    const registry = classicSnapshotRegistry(defined(READ_CASES[0]).snapshot)
    const updateGroupState = vi
      .fn<ClassicAPIAdapter['updateGroupState']>()
      .mockResolvedValue({ AttributeErrors: null, Success: true })
    const facade = new ClassicBuildingFacade(
      createMockClassicApi({ registry, updateGroupState }),
      defined(registry.buildings.getById(1)),
    )
    await facade.updateGroupState(ALL_NULL)

    expect(
      defined(updateGroupState.mock.lastCall?.[0]).postData.State,
    ).toStrictEqual(ALL_NULL)
  })
})

// The combination counts a group's no-change answer as success, the way
// a group counts its members': an empty delta — which the native zone
// write refuses with `NoChangesError` and the Home building skips —
// resolves without reaching either wire.
describe('ataGroup — an empty delta resolves on combined groups', () => {
  beforeEach(resetHomeDevices)

  it('reaches neither the Classic nor the Home wire', async () => {
    const zone = classicZoneWriting()
    const building = homeBuildingWriting()

    await expect(
      combineAtaGroups([zone.facade, building.facade]).updateGroupState({}),
    ).resolves.toBeUndefined()
    expect(zone.updateGroupState).not.toHaveBeenCalled()
    expect(building.api.updateValues).not.toHaveBeenCalled()
  })
})

// The member-modes read of the same contract: every implementation
// answering getGroup answers its members' operation modes in the one
// group vocabulary (Classic-numbered), `poweredOnly` keeping only the
// powered-on members — the read the consumers' mixed-mode scene
// resolvers key on.
interface GroupMember {
  readonly isOn: boolean
  readonly mode: ClassicOperationMode
}

const MEMBER_CASES: readonly {
  readonly all: readonly ClassicOperationMode[]
  readonly label: string
  readonly member: GroupMember
  readonly powered: readonly ClassicOperationMode[]
}[] = [
  {
    all: [ClassicOperationMode.heat],
    label: 'powered member',
    member: { isOn: true, mode: ClassicOperationMode.heat },
    powered: [ClassicOperationMode.heat],
  },
  {
    all: [ClassicOperationMode.cool],
    label: 'unpowered member',
    member: { isOn: false, mode: ClassicOperationMode.cool },
    powered: [],
  },
]

/**
 * Runs the member-modes contract against one implementation hosting a
 * single member (the shape every leg, group-of-one included, can host).
 * @param name - Implementation label used in the test titles.
 * @param read - Encodes the member into that dialect and reads the
 * modes through the real facade.
 */
const describeMemberModesContract = (
  name: string,
  read: (
    member: GroupMember,
    isPoweredOnly: boolean,
  ) => readonly ClassicOperationMode[],
): void => {
  describe(`ataGroup memberModes — ${name}`, () => {
    beforeEach(resetHomeDevices)

    it.each(MEMBER_CASES)(
      'projects a $label in the one group vocabulary',
      ({ all, member, powered }) => {
        expect(read(member, false)).toStrictEqual(all)
        expect(read(member, true)).toStrictEqual(powered)
      },
    )
  })
}

const memberSnapshot = (member: GroupMember): GroupSnapshot => ({
  ...defined(READ_CASES[0]).snapshot,
  isOn: member.isOn,
  mode: member.mode,
})

// A Classic building zone over the one member.
const memberZone = (member: GroupMember): ClassicBuildingFacade => {
  const registry = classicSnapshotRegistry(memberSnapshot(member))
  return new ClassicBuildingFacade(
    createMockClassicApi({ registry }),
    defined(registry.buildings.getById(1)),
  )
}

describeMemberModesContract('Classic zone', (member, isPoweredOnly) =>
  memberZone(member).getMemberOperationModes({ poweredOnly: isPoweredOnly }),
)

describeMemberModesContract('Classic ATA device', (member, isPoweredOnly) => {
  const registry = classicSnapshotRegistry(memberSnapshot(member))
  const facade = new ClassicDeviceAtaFacade(
    createMockClassicApi({ registry }),
    defined(registry.devices.getById(1000)),
  )
  return facade.getMemberOperationModes({ poweredOnly: isPoweredOnly })
})

describeMemberModesContract('Home ATA device', (member, isPoweredOnly) => {
  const facade = new HomeDeviceAtaFacade(
    createMockHomeApi(),
    homeDevice({
      id: 'contract-member-modes',
      settings: toHomeSettings(memberSnapshot(member)),
    }),
  )
  return facade.getMemberOperationModes({ poweredOnly: isPoweredOnly })
})

describeMemberModesContract('Home building', (member, isPoweredOnly) => {
  const facade = homeBuildingOf([
    typedHomeDeviceData(
      {
        id: 'member-modes-member',
        settings: toHomeSettings(memberSnapshot(member)),
      },
      { building: homeBuildingRef() },
    ),
  ])
  return facade.getMemberOperationModes({ poweredOnly: isPoweredOnly })
})

describeMemberModesContract('combined groups', (member, isPoweredOnly) =>
  combineAtaGroups([memberZone(member)]).getMemberOperationModes({
    poweredOnly: isPoweredOnly,
  }),
)

// The multi-member implementations share two more clauses a group of
// one cannot host: member order is preserved, and non-ATA members never
// contribute a mode.
const describeMultiMemberModesContract = (
  name: string,
  read: (isPoweredOnly: boolean) => readonly ClassicOperationMode[],
): void => {
  describe(`ataGroup memberModes — ${name} (multi-member)`, () => {
    it('projects every ATA member in member order, ATW members never', () => {
      expect(read(false)).toStrictEqual([
        ClassicOperationMode.heat,
        ClassicOperationMode.cool,
      ])
      expect(read(true)).toStrictEqual([ClassicOperationMode.heat])
    })
  })
}

describeMultiMemberModesContract('Classic zone', (isPoweredOnly) => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [
      classicAtaDevice({
        Device: classicAtaDeviceData({ OperationMode: 1, Power: true }),
      }),
      classicAtaDevice({
        Device: classicAtaDeviceData({ OperationMode: 3, Power: false }),
        DeviceID: 1003,
      }),
      classicAtwDevice(),
    ],
  })
  const facade = new ClassicBuildingFacade(
    createMockClassicApi({ registry }),
    defined(registry.buildings.getById(1)),
  )
  return facade.getMemberOperationModes({ poweredOnly: isPoweredOnly })
})

describeMultiMemberModesContract('Home building', (isPoweredOnly) => {
  const heating = memberSnapshot({
    isOn: true,
    mode: ClassicOperationMode.heat,
  })
  const cooling = memberSnapshot({
    isOn: false,
    mode: ClassicOperationMode.cool,
  })
  const facade = homeBuildingOf([
    typedHomeDeviceData(
      { id: 'multi-modes-1', settings: toHomeSettings(heating) },
      { building: homeBuildingRef() },
    ),
    typedHomeDeviceData(
      { id: 'multi-modes-2', settings: toHomeSettings(cooling) },
      { building: homeBuildingRef() },
    ),
    typedHomeAtwDeviceData(
      { id: 'multi-modes-atw' },
      { building: homeBuildingRef() },
    ),
  ])
  return facade.getMemberOperationModes({ poweredOnly: isPoweredOnly })
})

// The combination's members are its groups' members, group after group:
// a heating Classic member, then a stopped cooling Home member, each
// group also holding an ATW unit, which contributes no mode.
describeMultiMemberModesContract('combined groups', (isPoweredOnly) => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [
      classicAtaDevice({
        Device: classicAtaDeviceData({
          OperationMode: ClassicOperationMode.heat,
          Power: true,
        }),
      }),
      classicAtwDevice(),
    ],
  })
  const cooling = memberSnapshot({
    isOn: false,
    mode: ClassicOperationMode.cool,
  })
  return combineAtaGroups([
    new ClassicBuildingFacade(
      createMockClassicApi({ registry }),
      defined(registry.buildings.getById(1)),
    ),
    homeBuildingOf([
      typedHomeDeviceData(
        { id: 'combined-modes-ata', settings: toHomeSettings(cooling) },
        { building: homeBuildingRef() },
      ),
      typedHomeAtwDeviceData(
        { id: 'combined-modes-atw' },
        { building: homeBuildingRef() },
      ),
    ]),
  ]).getMemberOperationModes({ poweredOnly: isPoweredOnly })
})

// A member mode outside the known vocabulary is where the dialects
// genuinely diverge, each answer quarantined here: the Home bijection
// cannot say such a mode, so the member is DROPPED like a non-ATA
// member — never projected as a literal `undefined` hole in the
// array — while the Classic wire already speaks the vocabulary's own
// numeric namespace, so whatever number it says passes through
// verbatim (the same intended passthrough as the facade's other
// unknown-wire-value reads).
describe('ataGroup memberModes — out-of-vocabulary member modes', () => {
  beforeEach(resetHomeDevices)

  it('home building drops a member whose mode the bijection cannot say', () => {
    const facade = homeBuildingOf([
      typedHomeDeviceData(
        {
          id: 'oov-known',
          settings: toHomeSettings(
            memberSnapshot({ isOn: true, mode: ClassicOperationMode.heat }),
          ),
        },
        { building: homeBuildingRef() },
      ),
      typedHomeDeviceData(
        {
          id: 'oov-unknown',
          settings: { OperationMode: 'Mystery', Power: 'True' },
        },
        { building: homeBuildingRef() },
      ),
    ])

    expect(
      facade.getMemberOperationModes({ poweredOnly: false }),
    ).toStrictEqual([ClassicOperationMode.heat])
  })

  it('home device answers empty for its own absent mode', () => {
    const facade = new HomeDeviceAtaFacade(
      createMockHomeApi(),
      homeDevice({ id: 'oov-own', settings: { Power: 'True' } }),
    )

    expect(
      facade.getMemberOperationModes({ poweredOnly: false }),
    ).toStrictEqual([])
  })

  it('classic passes an off-vocabulary wire numeric through verbatim', () => {
    const registry = populatedClassicRegistry({
      buildings: [classicBuildingData()],
      devices: [
        classicAtaDevice({
          // The deliberate type breach: an out-of-vocabulary mode is
          // exactly what the compiled types refuse.
          Device: classicAtaDeviceData(cast({ OperationMode: 99 })),
        }),
      ],
    })
    const facade = new ClassicBuildingFacade(
      createMockClassicApi({ registry }),
      defined(registry.buildings.getById(1)),
    )

    expect(
      facade.getMemberOperationModes({ poweredOnly: false }),
    ).toStrictEqual([99])
  })
})
