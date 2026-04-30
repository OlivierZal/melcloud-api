import type { TypedHomeDeviceData } from '../src/entities/home-registry.ts'
import type {
  HomeDeviceCapabilities,
  HomeDeviceData,
} from '../src/types/index.ts'
import { HomeDeviceType } from '../src/constants.ts'
import { HomeDevice } from '../src/entities/home-device.ts'
import { mock } from './helpers.ts'

// Mid-range RSSI so derived signal-quality assertions land in a
// predictable band without special-casing weak/strong values.
const DEFAULT_RSSI_DBM = -50

// Realistic defaults so every operation mode resolves to a non-empty range.
const defaultCapabilities: HomeDeviceCapabilities = {
  hasAirDirection: true,
  hasAutomaticFanSpeed: true,
  hasAutoOperationMode: true,
  hasCoolOperationMode: true,
  hasDryOperationMode: true,
  hasHalfDegreeIncrements: true,
  hasHeatOperationMode: true,
  hasSwing: true,
  maxTempAutomatic: 31,
  maxTempCoolDry: 31,
  maxTempHeat: 31,
  minTempAutomatic: 16,
  minTempCoolDry: 16,
  minTempHeat: 10,
  numberOfFanSpeeds: 5,
}

const homeDeviceCapabilities = (
  overrides: Partial<HomeDeviceCapabilities> = {},
): HomeDeviceCapabilities => ({ ...defaultCapabilities, ...overrides })

// Convert a `Record<string, string>` to the BFF's `{ name, value }[]`
// shape so call sites can express settings as plain string maps.
const buildSettings = (
  settings: Record<string, string>,
): HomeDeviceData['settings'] =>
  Object.entries(settings).map(([name, value]) => ({ name, value }))

export interface HomeDeviceDataOverrides {
  readonly capabilities?: Partial<HomeDeviceCapabilities>
  readonly id?: string
  readonly name?: string
  readonly rssi?: number
  readonly settings?: Record<string, string>
}

export const homeDeviceData = (
  overrides: HomeDeviceDataOverrides = {},
): HomeDeviceData =>
  mock<HomeDeviceData>({
    capabilities: homeDeviceCapabilities(overrides.capabilities),
    givenDisplayName: overrides.name ?? 'Home device',
    id: overrides.id ?? 'home-device-1',
    rssi: overrides.rssi ?? DEFAULT_RSSI_DBM,
    settings: buildSettings(overrides.settings ?? {}),
  })

export const homeDevice = (
  overrides: HomeDeviceDataOverrides = {},
  type: HomeDeviceType = HomeDeviceType.Ata,
): HomeDevice => new HomeDevice(homeDeviceData(overrides), type)

export const typedHomeDeviceData = (
  overrides: HomeDeviceDataOverrides = {},
  type: HomeDeviceType = HomeDeviceType.Ata,
): TypedHomeDeviceData => ({ device: homeDeviceData(overrides), type })
