import type { TypedHomeDeviceData } from '../src/entities/home-registry.ts'
import type {
  HomeAtaDeviceCapabilities,
  HomeAtaDeviceData,
  HomeAtwDeviceCapabilities,
  HomeAtwDeviceData,
} from '../src/types/index.ts'
import { HomeDeviceType } from '../src/constants.ts'
import { HomeDevice } from '../src/entities/home-device.ts'
import { mock } from './helpers.ts'

// Mid-range RSSI so derived signal-quality assertions land in a
// predictable band without special-casing weak/strong values.
const DEFAULT_RSSI_DBM = -50

// Realistic defaults so every operation mode resolves to a non-empty range.
const defaultCapabilities: HomeAtaDeviceCapabilities = {
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
): HomeAtaDeviceCapabilities => ({ ...defaultCapabilities, ...overrides })

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

export const homeDevice = (
  overrides: HomeDeviceDataOverrides = {},
  type: HomeDeviceType = HomeDeviceType.Ata,
): HomeDevice<HomeAtaDeviceData> =>
  new HomeDevice(homeDeviceData(overrides), type)

export const typedHomeDeviceData = (
  overrides: HomeDeviceDataOverrides = {},
  type: HomeDeviceType = HomeDeviceType.Ata,
): TypedHomeDeviceData => ({ device: homeDeviceData(overrides), type })

const defaultAtwCapabilities: HomeAtwDeviceCapabilities = {
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
    capabilities: { ...defaultAtwCapabilities, ...overrides.capabilities },
    givenDisplayName: overrides.name ?? 'Home ATW device',
    id: overrides.id ?? 'home-atw-1',
    rssi: overrides.rssi ?? DEFAULT_RSSI_DBM,
    settings: buildSettings(overrides.settings ?? {}),
  })

export const homeAtwDevice = (
  overrides: HomeAtwDeviceDataOverrides = {},
): HomeDevice<HomeAtwDeviceData> =>
  new HomeDevice(homeAtwDeviceData(overrides), HomeDeviceType.Atw)
