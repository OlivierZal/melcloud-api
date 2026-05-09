import type {
  HomeFanSpeed,
  HomeHorizontal,
  HomeOperationMode,
  HomeVertical,
} from '../enum-mappings.ts'

/**
 * Static capability flags and per-mode temperature bounds advertised by a MELCloud Home ATA device.
 * @category Types
 */
export interface HomeAtaDeviceCapabilities {
  readonly hasAirDirection: boolean
  readonly hasAutomaticFanSpeed: boolean
  readonly hasAutoOperationMode: boolean
  readonly hasCoolOperationMode: boolean
  readonly hasDryOperationMode: boolean
  readonly hasHalfDegreeIncrements: boolean
  readonly hasHeatOperationMode: boolean
  readonly hasSwing: boolean
  readonly maxTempAutomatic: number
  readonly maxTempCoolDry: number
  readonly maxTempHeat: number
  readonly minTempAutomatic: number
  readonly minTempCoolDry: number
  readonly minTempHeat: number
  readonly numberOfFanSpeeds: number
}

/**
 * Wire-format MELCloud Home ATA device entry — id, display name, capabilities, current settings, and last-seen RSSI.
 * @category Types
 */
export interface HomeAtaDeviceData {
  readonly capabilities: HomeAtaDeviceCapabilities
  readonly givenDisplayName: string
  readonly id: string
  readonly rssi: number
  readonly settings: HomeDeviceSetting[]
}

/**
 * Mutable ATA device state accepted by the MELCloud Home device-update endpoint; every field is optional and `null` clears it.
 * @category Types
 */
export interface HomeAtaValues {
  readonly inStandbyMode?: boolean | null
  readonly operationMode?: HomeOperationMode | null
  readonly power?: boolean | null
  readonly setFanSpeed?: HomeFanSpeed | null
  readonly setTemperature?: number | null
  readonly temperatureIncrementOverride?: number | null
  readonly vaneHorizontalDirection?: HomeHorizontal | null
  readonly vaneVerticalDirection?: HomeVertical | null
}

/**
 * Static capability descriptor advertised by a MELCloud Home ATW device.
 * Index signature preserves forward compatibility for keys the SDK
 * does not yet read.
 * @category Types
 */
export interface HomeAtwDeviceCapabilities {
  readonly [key: string]: unknown
  readonly ftcModel: number
  readonly hasBoiler: boolean
  readonly hasDemandSideControl: boolean
  readonly hasDualRoomTemperature: boolean
  readonly hasEstimatedEnergyConsumption: boolean
  readonly hasEstimatedEnergyProduction: boolean
  readonly hasHalfDegrees: boolean
  readonly hasHeatZone1: boolean
  readonly hasHeatZone2: boolean
  readonly hasHotWater: boolean
  readonly hasMeasuredEnergyConsumption: boolean
  readonly hasMeasuredEnergyProduction: boolean
  readonly hasThermostatZone1: boolean
  readonly hasThermostatZone2: boolean
  readonly hasWirelessRemote: boolean
  readonly hasZone2: boolean
  readonly immersionHeaterCapacity: number
  readonly maxHeatOutput: number
  readonly maxImportPower: number
  readonly maxSetTankTemperature: number
  readonly maxSetTemperature: number
  readonly minSetTankTemperature: number
  readonly minSetTemperature: number
  readonly refridgerentAddress: number
  readonly temperatureIncrement: number
  readonly temperatureIncrementOverride: string
  readonly temperatureUnit: string
}

/**
 * Wire-format MELCloud Home ATW device entry — id, display name, capabilities, current settings, and last-seen RSSI.
 * @category Types
 */
export interface HomeAtwDeviceData {
  readonly capabilities: HomeAtwDeviceCapabilities
  readonly givenDisplayName: string
  readonly id: string
  readonly rssi: number
  readonly settings: HomeDeviceSetting[]
}

/**
 * Per-zone operation mode accepted by the MELCloud Home ATW device-update endpoint.
 * Mirrors the FTC zone modes (room thermostat / fixed flow / weather curve, in heat or cool).
 * @category Types
 */
export type HomeAtwOperationModeZone =
  | 'CoolFlowTemperature'
  | 'CoolRoomTemperature'
  | 'CoolThermostat'
  | 'Curve'
  | 'HeatFlowTemperature'
  | 'HeatRoomTemperature'
  | 'HeatThermostat'

/**
 * Mutable ATW device state accepted by the MELCloud Home device-update endpoint; every field is optional and `null` clears it.
 * @category Types
 */
export interface HomeAtwValues {
  readonly forcedHotWaterMode?: boolean | null
  readonly hotWaterActive?: boolean | null
  readonly operationModeZone1?: HomeAtwOperationModeZone | null
  readonly operationModeZone2?: HomeAtwOperationModeZone | null
  readonly power?: boolean | null
  readonly setCoolFlowTemperatureZone1?: number | null
  readonly setCoolFlowTemperatureZone2?: number | null
  readonly setHeatFlowTemperatureZone1?: number | null
  readonly setHeatFlowTemperatureZone2?: number | null
  readonly setTankWaterTemperature?: number | null
  readonly setTemperatureZone1?: number | null
  readonly setTemperatureZone2?: number | null
  readonly zone1Active?: boolean | null
  readonly zone2Active?: boolean | null
}

/**
 * Wire-format MELCloud Home building entry, splitting devices by their connection type (ATA vs ATW).
 * @category Types
 */
export interface HomeBuilding {
  readonly airToAirUnits: HomeAtaDeviceData[]
  readonly airToWaterUnits: HomeAtwDeviceData[]
  readonly id: string
  readonly name: string
  readonly timezone: string
}

/**
 * Single claim entry on a MELCloud Home identity token.
 * @category Types
 */
export interface HomeClaim {
  readonly type: string
  readonly value: string
  readonly valueType: string
}

/**
 * Wire-format response from the MELCloud Home `/context` endpoint — the authenticated user plus their owned and guest buildings.
 * @category Types
 */
export interface HomeContext {
  readonly buildings: HomeBuilding[]
  readonly country: string
  readonly email: string
  readonly firstname: string
  readonly guestBuildings: HomeBuilding[]
  readonly id: string
  readonly language: string
  readonly lastname: string
}

/**
 * Capability descriptor advertised by any MELCloud Home device — disjoint between ATA and ATW shapes.
 * @category Types
 */
export type HomeDeviceCapabilities =
  | HomeAtaDeviceCapabilities
  | HomeAtwDeviceCapabilities

/**
 * Wire-format MELCloud Home device entry; either an ATA or ATW unit.
 * @category Types
 */
export type HomeDeviceData = HomeAtaDeviceData | HomeAtwDeviceData

/**
 * Single name/value setting entry on a MELCloud Home device.
 * @category Types
 */
export interface HomeDeviceSetting {
  readonly name: string
  readonly value: string
}

/**
 * Wire-format energy response from MELCloud Home — one or more measure series per device.
 * @category Types
 */
export interface HomeEnergyData {
  readonly measureData: HomeEnergyMeasure[]
  readonly deviceId?: string
}

/**
 * A single energy measure series (e.g. heating, cooling) and its time-series values.
 * @category Types
 */
export interface HomeEnergyMeasure {
  readonly type: string
  readonly values: HomeEnergyPoint[]
  readonly deviceId?: string
}

/**
 * Single time-stamped energy sample.
 * @category Types
 */
export interface HomeEnergyPoint {
  readonly time: string
  readonly value: string
}

/**
 * Single error-log entry returned by the MELCloud Home error-history endpoint.
 * @category Types
 */
export interface HomeErrorLogEntry {
  readonly date: string
  readonly errorCode: string
  readonly errorMessage: string
}

/**
 * Wire-format temperature/signal report from MELCloud Home — one dataset per series, each holding `(x,y)` samples.
 * @category Types
 */
export interface HomeReportData {
  readonly datasets: HomeReportDataset[]
  readonly reportPeriod: string
}

/**
 * One named series of `(x,y)` samples in a {@link HomeReportData}.
 * @category Types
 */
export interface HomeReportDataset {
  readonly data: HomeReportPoint[]
  readonly id: string
  readonly label: string
}

/**
 * Single `(x,y)` sample inside a {@link HomeReportDataset}.
 * @category Types
 */
export interface HomeReportPoint {
  readonly x: string
  readonly y: number
}

/**
 * Building-level invite entry returned by `/monitor/user/systeminvites`.
 * Buildings appear in the list when their owner has shared one or more
 * systems with the authenticated user.
 * @category Types
 */
export interface HomeSystemInvite {
  readonly id: string
  readonly name: string
  readonly ownerEmail: string
  readonly systems: HomeSystemInviteSystem[]
}

/**
 * Single shared-system entry within a {@link HomeSystemInvite}.
 * @category Types
 */
export interface HomeSystemInviteSystem {
  readonly id: string
  readonly inviteAccepted: boolean
  readonly name: string
  readonly unitType: HomeSystemUnitType
}

/**
 * Connection-type discriminator returned by `/monitor/user/systeminvites`
 * (lowercase counterpart of {@link HomeDeviceType}).
 * @category Types
 */
export type HomeSystemUnitType = 'ata' | 'atw'

export interface HomeTokenResponse {
  readonly access_token: string
  readonly expires_in: number
  readonly scope: string
  readonly token_type: 'Bearer'
  readonly id_token?: string
  readonly refresh_token?: string
}

/**
 * Authenticated MELCloud Home user identity decoded from the bearer token's id-token claims.
 * @category Types
 */
export interface HomeUser {
  readonly email: string
  readonly firstName: string
  readonly lastName: string
  readonly sub: string
}
