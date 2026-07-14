import type { TypedHomeDeviceData } from '../src/entities/home-registry.ts'
import type {
  HomeAtaDeviceCapabilities,
  HomeAtaDeviceData,
  HomeAtwDeviceCapabilities,
  HomeAtwDeviceData,
  HomeBuildingRef,
} from '../src/types/index.ts'
import { HomeDeviceType } from '../src/constants.ts'
import { HomeDevice } from '../src/entities/home-device.ts'
import { mock } from './helpers.ts'

// Mid-range RSSI so derived signal-quality assertions land in a
// predictable band without special-casing weak/strong values.
const DEFAULT_RSSI_DBM = -50

// Realistic defaults so every operation mode resolves to a non-empty range.
export const defaultHomeAtaCapabilities: HomeAtaDeviceCapabilities = {
  hasAirDirection: true,
  hasAutomaticFanSpeed: true,
  hasAutoOperationMode: true,
  hasCoolOperationMode: true,
  hasDemandSideControl: true,
  hasDryOperationMode: true,
  hasEnergyConsumedMeter: true,
  hasExtendedTemperatureRange: true,
  hasHalfDegreeIncrements: true,
  hasHeatOperationMode: true,
  hasStandby: true,
  hasSwing: true,
  isLegacyDevice: false,
  isMultiSplitSystem: false,
  maxTempAutomatic: 31,
  maxTempCoolDry: 31,
  maxTempHeat: 31,
  minTempAutomatic: 16,
  minTempCoolDry: 16,
  minTempHeat: 10,
  numberOfFanSpeeds: 5,
  supportsWideVane: false,
}

const homeDeviceCapabilities = (
  overrides: Partial<HomeAtaDeviceCapabilities> = {},
): HomeAtaDeviceCapabilities => ({
  ...defaultHomeAtaCapabilities,
  ...overrides,
})

// Convert a `Record<string, string>` to the BFF's `{ name, value }[]`
// shape so call sites can express settings as plain string maps.
const buildSettings = (
  settings: Record<string, string>,
): HomeAtaDeviceData['settings'] =>
  Object.entries(settings).map(([name, value]) => ({ name, value }))

export interface HomeDeviceDataOverrides {
  readonly capabilities?: Partial<HomeAtaDeviceCapabilities>
  readonly id?: string
  readonly name?: string
  readonly rssi?: number
  readonly settings?: Record<string, string>
}

export const homeDeviceData = (
  overrides: HomeDeviceDataOverrides = {},
): HomeAtaDeviceData =>
  mock<HomeAtaDeviceData>({
    capabilities: homeDeviceCapabilities(overrides.capabilities),
    givenDisplayName: overrides.name ?? 'Home device',
    id: overrides.id ?? 'home-device-1',
    rssi: overrides.rssi ?? DEFAULT_RSSI_DBM,
    settings: buildSettings(overrides.settings ?? {}),
  })

export const homeBuildingRef = (
  overrides: Partial<HomeBuildingRef> = {},
): HomeBuildingRef => ({
  id: overrides.id ?? 'home-building-1',
  name: overrides.name ?? 'Home Building',
})

interface HomeDeviceFixtureOptions {
  building?: HomeBuildingRef
  isOwner?: boolean
}

// ATA-shaped payloads carry the ATA type tag by construction; ATW entries
// come from the dedicated creators below so fixtures stay representative.
export const homeDevice = (
  overrides: HomeDeviceDataOverrides = {},
  options: HomeDeviceFixtureOptions = {},
): HomeDevice<HomeAtaDeviceData> =>
  new HomeDevice({
    building: options.building ?? homeBuildingRef(),
    device: homeDeviceData(overrides),
    isOwner: options.isOwner ?? true,
    type: HomeDeviceType.Ata,
  })

export const typedHomeDeviceData = (
  overrides: HomeDeviceDataOverrides = {},
  options: HomeDeviceFixtureOptions = {},
): TypedHomeDeviceData => ({
  building: options.building ?? homeBuildingRef(),
  device: homeDeviceData(overrides),
  isOwner: options.isOwner ?? true,
  type: HomeDeviceType.Ata,
})

export const defaultHomeAtwCapabilities: HomeAtwDeviceCapabilities = {
  ftcModel: 3,
  hasBoiler: true,
  hasDemandSideControl: true,
  hasDualRoomTemperature: false,
  hasEstimatedEnergyConsumption: true,
  hasEstimatedEnergyProduction: true,
  hasHalfDegrees: true,
  hasHeatZone1: true,
  hasHeatZone2: false,
  hasHotWater: true,
  hasMeasuredEnergyConsumption: false,
  hasMeasuredEnergyProduction: false,
  hasThermostatZone1: true,
  hasThermostatZone2: false,
  hasWirelessRemote: true,
  hasZone2: false,
  immersionHeaterCapacity: 0,
  maxHeatOutput: 0,
  maxImportPower: 0,
  maxSetTankTemperature: 60,
  maxSetTemperature: 30,
  minSetTankTemperature: 40,
  minSetTemperature: 10,
  refridgerentAddress: 0,
  temperatureIncrement: 0.5,
  temperatureIncrementOverride: '2',
  temperatureUnit: '',
}

export interface HomeAtwDeviceDataOverrides {
  readonly capabilities?: Partial<HomeAtwDeviceCapabilities>
  readonly id?: string
  readonly name?: string
  readonly rssi?: number
  readonly settings?: Record<string, string>
}

export const homeAtwDeviceData = (
  overrides: HomeAtwDeviceDataOverrides = {},
): HomeAtwDeviceData =>
  mock<HomeAtwDeviceData>({
    capabilities: { ...defaultHomeAtwCapabilities, ...overrides.capabilities },
    givenDisplayName: overrides.name ?? 'Home ATW device',
    id: overrides.id ?? 'home-atw-1',
    rssi: overrides.rssi ?? DEFAULT_RSSI_DBM,
    settings: buildSettings(overrides.settings ?? {}),
  })

export const homeAtwDevice = (
  overrides: HomeAtwDeviceDataOverrides = {},
  isOwner = true,
  building: HomeBuildingRef = homeBuildingRef(),
): HomeDevice<HomeAtwDeviceData> =>
  new HomeDevice({
    building,
    device: homeAtwDeviceData(overrides),
    isOwner,
    type: HomeDeviceType.Atw,
  })

export const typedHomeAtwDeviceData = (
  overrides: HomeAtwDeviceDataOverrides = {},
  options: HomeDeviceFixtureOptions = {},
): TypedHomeDeviceData => ({
  building: options.building ?? homeBuildingRef(),
  device: homeAtwDeviceData(overrides),
  isOwner: options.isOwner ?? true,
  type: HomeDeviceType.Atw,
})
