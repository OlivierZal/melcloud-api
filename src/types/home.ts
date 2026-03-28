export interface HomeAtaValues {
  readonly inStandbyMode?: boolean | null
  readonly operationMode?: string | null
  readonly power?: boolean | null
  readonly setFanSpeed?: string | null
  readonly setTemperature?: number | null
  readonly temperatureIncrementOverride?: number | null
  readonly vaneHorizontalDirection?: string | null
  readonly vaneVerticalDirection?: string | null
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
  readonly country: string
  readonly email: string
  readonly firstname: string
  readonly guestBuildings: HomeBuilding[]
  readonly id: string
  readonly language: string
  readonly lastname: string
}

export interface HomeDevice {
  readonly capabilities: HomeDeviceCapabilities
  readonly connectedInterfaceIdentifier: string
  readonly displayIcon: string
  readonly frostProtection: HomeFrostProtection
  readonly givenDisplayName: string
  readonly id: string
  readonly isInError: boolean
  readonly rssi: number
  readonly schedule: unknown[]
  readonly scheduleEnabled: boolean
  readonly settings: HomeDeviceSetting[]
  readonly timeZone: string
  readonly unitSettings: unknown
}

export interface HomeDeviceCapabilities {
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

export interface HomeDeviceSetting {
  readonly name: string
  readonly value: string
}

export interface HomeEnergyData {
  readonly data: HomeEnergyPoint[]
}

export interface HomeEnergyPoint {
  readonly timestamp: string
  readonly value: number
}

export interface HomeErrorLogEntry {
  readonly date: string
  readonly errorCode: string
  readonly errorMessage: string
}

export interface HomeFrostProtection {
  readonly active: boolean
  readonly enabled: boolean
}

export interface HomeReportData {
  readonly data: HomeReportSeries[]
  readonly from: string
  readonly labels: string[]
  readonly to: string
}

export interface HomeReportSeries {
  readonly data: (number | null)[]
  readonly name: string
  readonly unit: string
}

export interface HomeSignalData {
  readonly data: HomeSignalPoint[]
}

export interface HomeSignalPoint {
  readonly timestamp: string
  readonly value: number
}

export interface HomeUser {
  readonly email: string
  readonly firstName: string
  readonly lastName: string
  readonly sub: string
}
