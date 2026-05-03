import type {
  HomeFanSpeed,
  HomeHorizontal,
  HomeOperationMode,
  HomeVertical,
} from '../enum-mappings.ts'

/** Mutable ATA device state accepted by the MELCloud Home device-update endpoint; every field is optional and `null` clears it. */
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

/** Wire-format MELCloud Home building entry, splitting devices by their connection type (ATA vs ATW). */
export interface HomeBuilding {
  readonly airToAirUnits: HomeDeviceData[]
  readonly airToWaterUnits: HomeDeviceData[]
  readonly id: string
  readonly name: string
  readonly timezone: string
}

/** Single claim entry on a MELCloud Home identity token. */
export interface HomeClaim {
  readonly type: string
  readonly value: string
  readonly valueType: string
}

/** Wire-format response from the MELCloud Home `/context` endpoint — the authenticated user plus their owned and guest buildings. */
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

/** Static capability flags and per-mode temperature bounds advertised by a MELCloud Home device. */
export interface HomeDeviceCapabilities {
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

/** Wire-format MELCloud Home device entry — id, display name, capabilities, current settings, and last-seen RSSI. */
export interface HomeDeviceData {
  readonly capabilities: HomeDeviceCapabilities
  readonly givenDisplayName: string
  readonly id: string
  readonly rssi: number
  readonly settings: HomeDeviceSetting[]
}

/** Single name/value setting entry on a MELCloud Home device. */
export interface HomeDeviceSetting {
  readonly name: string
  readonly value: string
}

/** Wire-format energy response from MELCloud Home — one or more measure series per device. */
export interface HomeEnergyData {
  readonly measureData: HomeEnergyMeasure[]
  readonly deviceId?: string
}

/** A single energy measure series (e.g. heating, cooling) and its time-series values. */
export interface HomeEnergyMeasure {
  readonly type: string
  readonly values: HomeEnergyPoint[]
  readonly deviceId?: string
}

/** Single time-stamped energy sample. */
export interface HomeEnergyPoint {
  readonly time: string
  readonly value: string
}

/** Single error-log entry returned by the MELCloud Home error-history endpoint. */
export interface HomeErrorLogEntry {
  readonly date: string
  readonly errorCode: string
  readonly errorMessage: string
}

/** Wire-format temperature/signal report from MELCloud Home — one dataset per series, each holding `(x,y)` samples. */
export interface HomeReportData {
  readonly datasets: HomeReportDataset[]
  readonly reportPeriod: string
}

/** One named series of `(x,y)` samples in a {@link HomeReportData}. */
export interface HomeReportDataset {
  readonly data: HomeReportPoint[]
  readonly id: string
  readonly label: string
}

/** Single `(x,y)` sample inside a {@link HomeReportDataset}. */
export interface HomeReportPoint {
  readonly x: string
  readonly y: number
}

export interface HomeTokenResponse {
  readonly access_token: string
  readonly expires_in: number
  readonly scope: string
  readonly token_type: 'Bearer'
  readonly id_token?: string
  readonly refresh_token?: string
}

/** Authenticated MELCloud Home user identity decoded from the bearer token's id-token claims. */
export interface HomeUser {
  readonly email: string
  readonly firstName: string
  readonly lastName: string
  readonly sub: string
}
