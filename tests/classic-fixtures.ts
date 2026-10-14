import { cast, mock } from '@olivierzal/api-core/testing'
import { type MockInstance, vi } from 'vitest'

import type {
  ClassicAPIAdapter,
  ClassicErrorLog,
  SyncCallback,
} from '../src/api/index.ts'
import type {
  HttpClient,
  HttpRequestConfig,
  HttpResponse,
} from '../src/http/index.ts'
import {
  ClassicDeviceType,
  ClassicLabelType,
  ClassicOperationMode,
  ClassicOperationModeZone,
} from '../src/constants.ts'
import {
  type ClassicDeviceAny,
  ClassicRegistry,
} from '../src/entities/index.ts'
import {
  type ClassicAreaData,
  type ClassicAreaDataAny,
  type ClassicAreaID,
  type ClassicBuildingData,
  type ClassicBuildingID,
  type ClassicBuildingWithStructure,
  type ClassicDeviceID,
  type ClassicFloorData,
  type ClassicFloorID,
  type ClassicFrostProtectionData,
  type ClassicHolidayModeData,
  type ClassicListDevice,
  type ClassicListDeviceAny,
  type ClassicListDeviceDataAta,
  type ClassicListDeviceDataAtw,
  type ClassicListDeviceDataErv,
  type ClassicReportData,
  type ClassicSetDeviceDataAta,
  type ClassicTilesData,
  type Result,
  ok,
} from '../src/types/index.ts'
import { resolved } from '../src/utils.ts'
import {
  ClassicAreaIdSchema,
  ClassicBuildingIdSchema,
  ClassicDeviceIdSchema,
  ClassicFloorIdSchema,
} from '../src/validation/index.ts'

// ---------------------------------------------------------------------------
// Branded ids — a fixture spells an id as a plain number and the schema
// parse mints the brand, the one place a brand is born in the SDK too.
// ---------------------------------------------------------------------------

export const classicAreaId = (id: number): ClassicAreaID =>
  ClassicAreaIdSchema.parse(id)

export const classicBuildingId = (id: number): ClassicBuildingID =>
  ClassicBuildingIdSchema.parse(id)

export const classicDeviceId = (id: number): ClassicDeviceID =>
  ClassicDeviceIdSchema.parse(id)

export const classicFloorId = (id: number): ClassicFloorID =>
  ClassicFloorIdSchema.parse(id)

// The overrides a factory takes: the wire shape with its id fields
// spelled as plain numbers (nullable where the wire is).
type PlainIds<T, TIdKey extends keyof T> = Omit<Partial<T>, TIdKey> & {
  readonly [P in TIdKey]?: null extends T[P] ? number | null : number
}

// ---------------------------------------------------------------------------
// Primitive model data factories
// ---------------------------------------------------------------------------

export const classicBuildingData = ({
  ID: id = 1,
  ...overrides
}: PlainIds<ClassicBuildingData, 'ID'> = {}): ClassicBuildingData =>
  // The wire shape carries 30+ fields (address, geo, owner, access,
  // FP/HM flags); fixtures only pin the few the SDK actually reads
  // and let `mock` leave the rest absent at runtime.
  mock<ClassicBuildingData>({
    FPDefined: true,
    FPEnabled: false,
    FPMaxTemperature: 16,
    FPMinTemperature: 4,
    HMDefined: false,
    HMEnabled: false,
    HMEndDate: null,
    HMStartDate: null,
    ID: classicBuildingId(id),
    Location: 10,
    Name: 'ClassicBuilding',
    TimeZone: 0,
    ...overrides,
  })

export const classicFloorData = ({
  BuildingId: buildingId = 1,
  ID: id = 10,
  ...overrides
}: PlainIds<ClassicFloorData, 'BuildingId' | 'ID'> = {}): ClassicFloorData => ({
  BuildingId: classicBuildingId(buildingId),
  ID: classicFloorId(id),
  Name: 'ClassicFloor',
  ...overrides,
})

// A floor-bound area; `classicBuildingAreaData` is the one that sits
// directly under its building.
export const classicAreaData = ({
  BuildingId: buildingId = 1,
  FloorId: floorId = 10,
  ID: id = 100,
  ...overrides
}: PlainIds<
  ClassicAreaData<ClassicFloorID>,
  'BuildingId' | 'FloorId' | 'ID'
> = {}): ClassicAreaData<ClassicFloorID> => ({
  BuildingId: classicBuildingId(buildingId),
  FloorId: classicFloorId(floorId),
  ID: classicAreaId(id),
  Name: 'ClassicArea',
  ...overrides,
})

export const classicBuildingAreaData = ({
  BuildingId: buildingId = 1,
  ID: id = 100,
  ...overrides
}: PlainIds<
  ClassicAreaData<null>,
  'BuildingId' | 'ID'
> = {}): ClassicAreaData<null> => ({
  BuildingId: classicBuildingId(buildingId),
  FloorId: null,
  ID: classicAreaId(id),
  Name: 'ClassicArea',
  ...overrides,
})

// ---------------------------------------------------------------------------
// ClassicDevice data factories (inner `ClassicDevice` payloads)
// ---------------------------------------------------------------------------

export const classicAtaDeviceData = (
  overrides: Partial<ClassicListDeviceDataAta> = {},
): ClassicListDeviceDataAta =>
  mock<ClassicListDeviceDataAta>({
    ActualFanSpeed: 3,
    EffectiveFlags: 0,
    FanSpeed: 3,
    HasAutomaticFanSpeed: true,
    MaxTempAutomatic: 31,
    MaxTempCoolDry: 31,
    MaxTempHeat: 31,
    MinTempAutomatic: 16,
    MinTempCoolDry: 16,
    MinTempHeat: 10,
    Offline: false,
    OperationMode: 1,
    OutdoorTemperature: 20,
    Power: true,
    RoomTemperature: 22,
    SetTemperature: 24,
    VaneHorizontalDirection: 0,
    VaneVerticalDirection: 0,
    WifiSignalStrength: -50,
    ...overrides,
  })

const classicAtwDefaults: Partial<ClassicListDeviceDataAtw> = {
  BoosterHeater1Status: false,
  BoosterHeater2PlusStatus: false,
  BoosterHeater2Status: false,
  CanCool: true,
  CondensingTemperature: 40,
  CurrentEnergyConsumed: 0,
  CurrentEnergyProduced: 0,
  DefrostMode: 0,
  EcoHotWater: false,
  EffectiveFlags: 0,
  FlowTemperature: 35,
  FlowTemperatureZone1: 35,
  FlowTemperatureZone2: 35,
  ForcedHotWaterMode: false,
  HasZone2: false,
  HeatPumpFrequency: 50,
  IdleZone1: false,
  IdleZone2: false,
  ImmersionHeaterStatus: false,
  LastLegionellaActivationTime: '',
  MaxTankTemperature: 60,
  MixingTankWaterTemperature: 0,
  Offline: false,
  OperationModeZone1: ClassicOperationModeZone.room,
  OperationModeZone2: ClassicOperationModeZone.room,
  Power: true,
  ProhibitCoolingZone1: false,
  ProhibitCoolingZone2: false,
  ProhibitHeatingZone1: false,
  ProhibitHeatingZone2: false,
  ProhibitHotWater: false,
  ReturnTemperature: 30,
  ReturnTemperatureZone1: 30,
  ReturnTemperatureZone2: 30,
  RoomTemperatureZone1: 21,
  RoomTemperatureZone2: 19,
  SetCoolFlowTemperatureZone1: 20,
  SetCoolFlowTemperatureZone2: 20,
  SetHeatFlowTemperatureZone1: 40,
  SetHeatFlowTemperatureZone2: 40,
  SetTankWaterTemperature: 50,
  SetTemperatureZone1: 22,
  SetTemperatureZone2: 20,
  TankWaterTemperature: 48,
  TargetHCTemperatureZone1: 22,
  TargetHCTemperatureZone2: 22,
  WifiSignalStrength: -50,
  Zone1InCoolMode: false,
  Zone1InHeatMode: true,
  Zone2InCoolMode: false,
  Zone2InHeatMode: false,
}

export const classicAtwDeviceData = (
  overrides: Partial<ClassicListDeviceDataAtw> = {},
): ClassicListDeviceDataAtw =>
  mock<ClassicListDeviceDataAtw>({ ...classicAtwDefaults, ...overrides })

export const classicErvDeviceData = (
  overrides: Partial<ClassicListDeviceDataErv> = {},
): ClassicListDeviceDataErv =>
  mock<ClassicListDeviceDataErv>({
    EffectiveFlags: 0,
    HasAutomaticFanSpeed: true,
    HasCO2Sensor: false,
    HasPM25Sensor: false,
    Offline: false,
    PM25Level: 0,
    Power: true,
    SetFanSpeed: 3,
    VentilationMode: 0,
    WifiSignalStrength: -50,
    ...overrides,
  })

// ---------------------------------------------------------------------------
// Full list-device wrappers (envelope around device data)
// ---------------------------------------------------------------------------

type ClassicListDeviceOverrides<T extends ClassicDeviceType> = PlainIds<
  ClassicListDevice<T>,
  'AreaID' | 'BuildingID' | 'DeviceID' | 'FloorID'
>

const classicDeviceIds = ({
  areaId,
  buildingId,
  deviceId,
  floorId,
}: {
  areaId: number | null
  buildingId: number
  deviceId: number
  floorId: number | null
}): Pick<
  ClassicListDeviceAny,
  'AreaID' | 'BuildingID' | 'DeviceID' | 'FloorID'
> => ({
  AreaID: ClassicAreaIdSchema.nullable().parse(areaId),
  BuildingID: classicBuildingId(buildingId),
  DeviceID: classicDeviceId(deviceId),
  FloorID: ClassicFloorIdSchema.nullable().parse(floorId),
})

// ListDevice wrappers carry 50+ wire-format fields (firmware,
// network, ownership, UI hints, permissions); fixtures pin only the
// identity + parent-zone fields the SDK reads, then `mock` returns
// the strict type with the rest absent at runtime.
export const classicAtaDevice = ({
  AreaID: areaId = 100,
  BuildingID: buildingId = 1,
  DeviceID: deviceId = 1000,
  FloorID: floorId = 10,
  ...overrides
}: ClassicListDeviceOverrides<
  typeof ClassicDeviceType.Ata
> = {}): ClassicListDeviceAny =>
  mock<ClassicListDevice<typeof ClassicDeviceType.Ata>>({
    ...classicDeviceIds({ areaId, buildingId, deviceId, floorId }),
    Device: classicAtaDeviceData(),
    DeviceName: 'ATA ClassicDevice',
    Type: ClassicDeviceType.Ata,
    ...overrides,
  })

export const classicAtwDevice = ({
  AreaID: areaId = 100,
  BuildingID: buildingId = 1,
  DeviceID: deviceId = 1001,
  FloorID: floorId = 10,
  ...overrides
}: ClassicListDeviceOverrides<
  typeof ClassicDeviceType.Atw
> = {}): ClassicListDeviceAny =>
  mock<ClassicListDevice<typeof ClassicDeviceType.Atw>>({
    ...classicDeviceIds({ areaId, buildingId, deviceId, floorId }),
    Device: classicAtwDeviceData(),
    DeviceName: 'ATW ClassicDevice',
    Type: ClassicDeviceType.Atw,
    ...overrides,
  })

export const classicErvDevice = ({
  AreaID: areaId = 100,
  BuildingID: buildingId = 1,
  DeviceID: deviceId = 1002,
  FloorID: floorId = null,
  ...overrides
}: ClassicListDeviceOverrides<
  typeof ClassicDeviceType.Erv
> = {}): ClassicListDeviceAny =>
  mock<ClassicListDevice<typeof ClassicDeviceType.Erv>>({
    ...classicDeviceIds({ areaId, buildingId, deviceId, floorId }),
    Device: classicErvDeviceData(),
    DeviceName: 'ERV ClassicDevice',
    Type: ClassicDeviceType.Erv,
    ...overrides,
  })

// ---------------------------------------------------------------------------
// API response fixtures
// ---------------------------------------------------------------------------

export const classicReportData = (
  overrides: Partial<ClassicReportData> = {},
): ClassicReportData => ({
  Data: [[1]],
  FromDate: '2024-01-01',
  Labels: ['a'],
  LabelType: ClassicLabelType.raw,
  Points: 1,
  Series: 1,
  ToDate: '2024-01-01',
  ...overrides,
})

export const classicHolidayModeResponse = (
  overrides: Partial<ClassicHolidayModeData> = {},
): ClassicHolidayModeData => ({
  EndDate: { Day: 1, Hour: 0, Minute: 0, Month: 1, Second: 0, Year: 2024 },
  HMDefined: false,
  HMEnabled: false,
  HMEndDate: null,
  HMStartDate: null,
  StartDate: { Day: 1, Hour: 0, Minute: 0, Month: 1, Second: 0, Year: 2024 },
  TimeZone: 0,
  ...overrides,
})

export const classicFrostProtectionResponse = (
  overrides: Partial<ClassicFrostProtectionData> = {},
): ClassicFrostProtectionData => ({
  FPDefined: false,
  FPEnabled: false,
  FPMaxTemperature: 16,
  FPMinTemperature: 4,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Permissive raw factories — accept arbitrary overrides via `cast`. Used by
// API-level tests that exercise unbranded ID inputs and minimal device
// payloads where the typed envelope above is too strict.
// ---------------------------------------------------------------------------

export const classicBuildingWithStructure = (
  overrides: Partial<ClassicBuildingWithStructure> = {},
): ClassicBuildingWithStructure =>
  mock<ClassicBuildingWithStructure>({
    ...classicBuildingData(),
    Structure: { Areas: [], Devices: [], Floors: [] },
    ...overrides,
  })

export const classicRawDevice = (
  overrides: Record<string, unknown> = {},
): ClassicListDeviceAny =>
  // Raw on purpose: this models the wire payload BEFORE branding and
  // validation, so its ids are plain numbers and `Device` is empty. A
  // typed factory rightly rejects it — `cast` is the deliberate
  // off-shape entry point.
  cast({
    AreaID: null,
    BuildingID: 1,
    Device: {},
    DeviceID: 1,
    DeviceName: 'ClassicDevice',
    FloorID: null,
    Type: 0,
    ...overrides,
  })

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// The whole-building form: no device selected.
const emptyTilesResponse = (): Result<ClassicTilesData> =>
  ok(mock<ClassicTilesData>({ SelectedDevice: null, Tiles: [] }))

export const createMockClassicApi = (
  overrides: Partial<ClassicAPIAdapter> = {},
): ClassicAPIAdapter =>
  mock<ClassicAPIAdapter>({
    fetch: vi.fn<ClassicAPIAdapter['fetch']>().mockResolvedValue([]),
    getEnergy: vi
      .fn<ClassicAPIAdapter['getEnergy']>()
      .mockResolvedValue(ok(cast({}))),
    getErrorEntries: vi
      .fn<ClassicAPIAdapter['getErrorEntries']>()
      .mockResolvedValue(ok([])),
    getErrorLog: vi
      .fn<ClassicAPIAdapter['getErrorLog']>()
      .mockResolvedValue(ok(mock<ClassicErrorLog>({ entries: [] }))),
    getFrostProtection: vi
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValue(
        ok(classicFrostProtectionResponse({ FPDefined: true })),
      ),
    getGroup: vi.fn<ClassicAPIAdapter['getGroup']>().mockResolvedValue(
      // `Partial<T>` is shallow, so a typed factory here would need one
      // nested factory per wire level to assert the single field this
      // skeleton exists for.
      ok(cast({ Data: { Group: { State: { Power: true } } } })),
    ),
    getHolidayMode: vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValue(ok(classicHolidayModeResponse({ HMDefined: true }))),
    getHourlyTemperatures: vi
      .fn<ClassicAPIAdapter['getHourlyTemperatures']>()
      .mockResolvedValue(ok(classicReportData())),
    getInternalTemperatures: vi
      .fn<ClassicAPIAdapter['getInternalTemperatures']>()
      .mockResolvedValue(ok(classicReportData())),
    getOperationModes: vi
      .fn<ClassicAPIAdapter['getOperationModes']>()
      .mockResolvedValue(ok([{ Key: 'Heating', Value: 100 }])),
    getSignal: vi
      .fn<ClassicAPIAdapter['getSignal']>()
      .mockResolvedValue(ok(classicReportData())),
    getTemperatures: vi
      .fn<ClassicAPIAdapter['getTemperatures']>()
      .mockResolvedValue(ok(classicReportData())),
    getTiles: vi
      .fn<ClassicAPIAdapter['getTiles']>()
      .mockResolvedValue(emptyTilesResponse()),
    getValues: vi
      .fn<ClassicAPIAdapter['getValues']>()
      .mockResolvedValue(ok(cast({ EffectiveFlags: 0 }))),
    notifySync: vi.fn<SyncCallback>().mockResolvedValue(),
    updateFrostProtection: vi
      .fn<ClassicAPIAdapter['updateFrostProtection']>()
      .mockResolvedValue({ AttributeErrors: null, Success: true }),
    updateGroupState: vi
      .fn<ClassicAPIAdapter['updateGroupState']>()
      .mockResolvedValue({ AttributeErrors: null, Success: true }),
    updateHolidayMode: vi
      .fn<ClassicAPIAdapter['updateHolidayMode']>()
      .mockResolvedValue({ AttributeErrors: null, Success: true }),
    updatePower: vi
      .fn<ClassicAPIAdapter['updatePower']>()
      .mockResolvedValue(true),
    updateValues: cast(
      vi
        .fn<ClassicAPIAdapter['updateValues']>()
        .mockResolvedValue(
          mock<ClassicSetDeviceDataAta>({
            DeviceType: ClassicDeviceType.Ata,
            EffectiveFlags: 0x1,
            LastCommunication: '',
            NextCommunication: '',
            NumberOfFanSpeeds: 5,
            Offline: false,
            OperationMode: ClassicOperationMode.heat,
            Power: true,
            RoomTemperature: 22,
            SetFanSpeed: 3,
            SetTemperature: 24,
            VaneHorizontal: 0,
            VaneVertical: 0,
          }),
        ),
    ),
    ...overrides,
  })

// ---------------------------------------------------------------------------
// Type guards & registry helpers
// ---------------------------------------------------------------------------

export function assertClassicDeviceType<T extends ClassicDeviceType>(
  device: ClassicDeviceAny | undefined,
  type: T,
): asserts device is Extract<ClassicDeviceAny, { type: T }>
export function assertClassicDeviceType(
  device: ClassicDeviceAny | undefined,
  type: ClassicDeviceType,
): void {
  if (device?.type !== type) {
    throw new Error(
      `Expected device of type ${String(type)}, got ${device === undefined ? 'undefined' : String(device.type)}`,
    )
  }
}

/**
 * Build a `ClassicRegistry` populated with the provided hierarchy in a
 * single call. Replaces the repeated 5-line
 * `new ClassicRegistry() + syncBuildings + syncFloors + syncAreas + syncDevices`
 * pattern found in multiple test files.
 * @param data - Flat arrays of buildings, floors, areas, and devices.
 * @param data.areas - ClassicArea rows to sync (none when omitted).
 * @param data.buildings - ClassicBuilding rows to sync (none when omitted).
 * @param data.devices - ClassicDevice rows to sync (none when omitted).
 * @param data.floors - ClassicFloor rows to sync (none when omitted).
 * @returns A fully synced `ClassicRegistry` instance.
 */
export const populatedClassicRegistry = ({
  areas = [],
  buildings = [],
  devices = [],
  floors = [],
}: {
  areas?: ClassicAreaDataAny[]
  buildings?: ClassicBuildingData[]
  devices?: ClassicListDeviceAny[]
  floors?: ClassicFloorData[]
}): ClassicRegistry => {
  const registry = new ClassicRegistry()
  registry.syncBuildings(buildings)
  registry.syncFloors(floors)
  registry.syncAreas(areas)
  registry.syncDevices(devices)
  return registry
}

// ---------------------------------------------------------------------------
// Wire staging — the two endpoints the Classic session lifecycle turns on:
// the sign-in round-trip and the bulk registry cycle.
// ---------------------------------------------------------------------------

export const CLASSIC_LOGIN_PATH = '/Login/ClientLogin3'

export const CLASSIC_LIST_PATH = '/User/ListDevices'

/**
 * The accepted `ClientLogin3` answer, in the transport's envelope.
 * @param contextKey - Session key the server hands out.
 * @param expiry - Session expiry, in the server's offset-less wall clock.
 * @returns The wrapped login response.
 */
export const classicLoginResponse = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
): HttpResponse<{ LoginData: { ContextKey: string; Expiry: string } }> => ({
  data: { LoginData: { ContextKey: contextKey, Expiry: expiry } },
  headers: {},
  status: 200,
})

/**
 * Route the mocked transport by URL: the sign-in POST to one responder,
 * every other call — the bulk registry cycle, any mutation — to the
 * other. One implementation rather than a queue, so a scenario that
 * signs in several times needs no re-staging. Responders are
 * synchronous: a refusal is expressed by throwing, which the wrapping
 * implementation turns into a rejected round-trip.
 * @param requestSpy - Spy standing in for `HttpClient.request`.
 * @param responders - What each half of the wire answers.
 * @param responders.login - Answer for `/Login/ClientLogin3`.
 * @param responders.rest - Answer for every other URL.
 */
export const stageClassicWire = (
  requestSpy: MockInstance<HttpClient['request']>,
  {
    login,
    rest,
  }: {
    login: () => HttpResponse
    rest: (config: HttpRequestConfig) => HttpResponse
  },
): void => {
  requestSpy.mockImplementation(async (config) =>
    resolved(config.url === CLASSIC_LOGIN_PATH ? login() : rest(config)),
  )
}
