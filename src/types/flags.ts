import type { UpdateDeviceDataAta } from './ata.js'
import type { UpdateDeviceDataAtw } from './atw.js'
import type { UpdateDeviceDataErv } from './erv.js'

export const FLAG_UNCHANGED = 0x0

export const flagsAta: Record<keyof UpdateDeviceDataAta, number> = {
  OperationMode: 0x2,
  Power: 0x1,
  SetFanSpeed: 0x8,
  SetTemperature: 0x4,
  VaneHorizontal: 0x100,
  VaneVertical: 0x10,
} as const

export const flagsAtw: Record<keyof UpdateDeviceDataAtw, number> = {
  ForcedHotWaterMode: 0x10000,
  OperationModeZone1: 0x8,
  OperationModeZone2: 0x10,
  Power: 0x1,
  SetCoolFlowTemperatureZone1: 0x1000000000000,
  SetCoolFlowTemperatureZone2: 0x1000000000000,
  SetHeatFlowTemperatureZone1: 0x1000000000000,
  SetHeatFlowTemperatureZone2: 0x1000000000000,
  SetTankWaterTemperature: 0x1000000000020,
  SetTemperatureZone1: 0x200000080,
  SetTemperatureZone2: 0x800000200,
} as const

export const flagsErv: Record<keyof UpdateDeviceDataErv, number> = {
  Power: 0x1,
  SetFanSpeed: 0x8,
  VentilationMode: 0x4,
} as const
