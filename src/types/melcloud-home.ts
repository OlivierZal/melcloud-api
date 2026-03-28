export interface MELCloudHomeAtaValues {
  readonly inStandbyMode?: boolean | null
  readonly operationMode?: string | null
  readonly power?: boolean | null
  readonly setFanSpeed?: string | null
  readonly setTemperature?: number | null
  readonly temperatureIncrementOverride?: number | null
  readonly vaneHorizontalDirection?: string | null
  readonly vaneVerticalDirection?: string | null
}

export interface MELCloudHomeBuilding {
  readonly airToAirUnits: MELCloudHomeDevice[]
  readonly id: string
  readonly name: string
  readonly timezone: string
}

export interface MELCloudHomeClaim {
  readonly type: string
  readonly value: string
  readonly valueType: string
}

export interface MELCloudHomeContext {
  readonly buildings: MELCloudHomeBuilding[]
  readonly country: string
  readonly email: string
  readonly firstname: string
  readonly guestBuildings: MELCloudHomeBuilding[]
  readonly id: string
  readonly language: string
  readonly lastname: string
}

export interface MELCloudHomeDevice {
  readonly capabilities: MELCloudHomeDeviceCapabilities
  readonly connectedInterfaceIdentifier: string
  readonly displayIcon: string
  readonly frostProtection: MELCloudHomeFrostProtection
  readonly givenDisplayName: string
  readonly id: string
  readonly isInError: boolean
  readonly rssi: number
  readonly schedule: unknown[]
  readonly scheduleEnabled: boolean
  readonly settings: MELCloudHomeDeviceSetting[]
  readonly timeZone: string
  readonly unitSettings: unknown
}

export interface MELCloudHomeDeviceCapabilities {
  readonly hasAirDirection: boolean
  readonly hasAutomaticFanSpeed: boolean
  readonly hasAutoOperationMode: boolean
  readonly hasCoolOperationMode: boolean
  readonly hasDemandSideControl: boolean
  readonly hasDryOperationMode: boolean
  readonly hasEnergyConsumedMeter: boolean
  readonly hasExtendedTemperatureRange: boolean
  readonly hasHalfDegreeIncrements: boolean
  readonly hasHeatOperationMode: boolean
  readonly hasStandby: boolean
  readonly hasSwing: boolean
  readonly isLegacyDevice: boolean
  readonly isMultiSplitSystem: boolean
  readonly maxTempAutomatic: number
  readonly maxTempCoolDry: number
  readonly maxTempHeat: number
  readonly minTempAutomatic: number
  readonly minTempCoolDry: number
  readonly minTempHeat: number
  readonly numberOfFanSpeeds: number
  readonly supportsWideVane: boolean
}

export interface MELCloudHomeDeviceSetting {
  readonly name: string
  readonly value: string
}

export interface MELCloudHomeEnergyData {
  readonly data: MELCloudHomeEnergyPoint[]
}

export interface MELCloudHomeEnergyPoint {
  readonly timestamp: string
  readonly value: number
}

export interface MELCloudHomeErrorLogEntry {
  readonly date: string
  readonly errorCode: string
  readonly errorMessage: string
}

export interface MELCloudHomeFrostProtection {
  readonly active: boolean
  readonly enabled: boolean
}

export interface MELCloudHomeReportData {
  readonly data: MELCloudHomeReportSeries[]
  readonly from: string
  readonly labels: string[]
  readonly to: string
}

export interface MELCloudHomeReportSeries {
  readonly data: (number | null)[]
  readonly name: string
  readonly unit: string
}

export interface MELCloudHomeSignalData {
  readonly data: MELCloudHomeSignalPoint[]
}

export interface MELCloudHomeSignalPoint {
  readonly timestamp: string
  readonly value: number
}

export interface MELCloudHomeUser {
  readonly email: string
  readonly firstName: string
  readonly lastName: string
  readonly sub: string
}
