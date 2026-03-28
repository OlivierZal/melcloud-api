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
  readonly numberOfBuildingsAllowed: number
  readonly numberOfDevicesAllowed: number
  readonly numberOfGuestDevicesAllowed: number
  readonly numberOfGuestUsersAllowedPerUnit: number
  readonly scenes: unknown[]
}

export interface HomeDevice {
  readonly capabilities: HomeDeviceCapabilities
  readonly connectedInterfaceIdentifier: string
  readonly connectedInterfaceType: number
  readonly displayIcon: string
  readonly energyProducedOptIn: unknown
  readonly frostProtection: HomeProtectionSettings | null
  readonly givenDisplayName: string
  readonly holidayMode: unknown
  readonly id: string
  readonly isConnected: boolean
  readonly isEnergyUsageCompatible: unknown
  readonly isInError: boolean
  readonly overheatProtection: HomeProtectionSettings | null
  readonly rssi: number
  readonly schedule: unknown[]
  readonly scheduleEnabled: boolean
  readonly settings: HomeDeviceSetting[]
  readonly systemId: string | null
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

export interface HomeProtectionSettings {
  readonly active: boolean
  readonly enabled: boolean
  readonly max: number
  readonly min: number
}

export interface HomeReportData {
  readonly datasets: HomeReportDataset[]
  readonly reportPeriod: number
}

export interface HomeReportDataset {
  readonly backgroundColor: string
  readonly borderColor: string
  readonly borderWidth: number
  readonly data: HomeReportPoint[]
  readonly hidden: boolean
  readonly id: string
  readonly isNonInteractive: boolean
  readonly label: string
  readonly lineTension: number
  readonly pointRadius: number
  readonly spanGaps: boolean
  readonly stepped: boolean
  readonly yAxisId: string
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
