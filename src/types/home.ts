import type {
  HomeFanSpeed,
  HomeHorizontal,
  HomeOperationMode,
  HomeVertical,
} from '../enum-mappings.ts'

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

export interface HomeBuilding {
  readonly airToAirUnits: HomeDevice[]
  readonly airToWaterUnits: HomeDevice[]
  readonly id: string
  readonly name: string
  readonly timezone: string
}

export interface HomeClaim {
  readonly type: string
  readonly value: string
  readonly valueType: string
}

export interface HomeContext {
  readonly buildings: HomeBuilding[]
  readonly guestBuildings: HomeBuilding[]
  readonly language: string
}

export interface HomeDevice {
  readonly capabilities: HomeDeviceCapabilities
  readonly givenDisplayName: string
  readonly id: string
  readonly rssi: number
  readonly settings: HomeDeviceSetting[]
}

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

export interface HomeDeviceSetting {
  readonly name: string
  readonly value: string
}

export interface HomeEnergyData {
  readonly deviceId: string
  readonly measureData: HomeEnergyMeasure[]
}

export interface HomeEnergyMeasure {
  readonly type: string
  readonly values: HomeEnergyPoint[]
}

export interface HomeEnergyPoint {
  readonly time: string
  readonly value: string
}

export interface HomeErrorLogEntry {
  readonly date: string
  readonly errorCode: string
  readonly errorMessage: string
}

export interface HomeReportData {
  readonly datasets: HomeReportDataset[]
  readonly reportPeriod: number
}

export interface HomeReportDataset {
  readonly data: HomeReportPoint[]
  readonly id: string
  readonly label: string
}

export interface HomeReportPoint {
  readonly x: string
  readonly y: number
}

export interface HomeUser {
  readonly email: string
  readonly firstName: string
  readonly lastName: string
  readonly sub: string
}
