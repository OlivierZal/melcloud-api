import type { ClassicDeviceType } from '../constants.ts'
import type { ClassicUpdateDeviceData } from '../types/index.ts'

/*
 * MELCloud EffectiveFlags bitfield values — each bit tells the Classic
 * API which fields in an update payload should actually be applied.
 *
 * Centralised here (not on each facade) so:
 *   - all magic hex constants live in a single table,
 *   - comparing bit assignments across device types is possible at a glance,
 *   - new device types or new fields are added by extending one map.
 *
 * The `satisfies` clause on each entry keeps us honest with the shape of
 * `ClassicUpdateDeviceData<T>`: adding a field without a flag (or a flag
 * without a field) now fails to type-check.
 */

export const classicAtaFlags = {
  OperationMode: 0x2,
  Power: 0x1,
  SetFanSpeed: 0x8,
  SetTemperature: 0x4,
  VaneHorizontal: 0x1_00,
  VaneVertical: 0x10,
} as const satisfies Record<
  keyof ClassicUpdateDeviceData<typeof ClassicDeviceType.Ata>,
  number
>

export const classicAtwFlags = {
  ForcedHotWaterMode: 0x1_00_00,
  OperationModeZone1: 0x8,
  OperationModeZone2: 0x10,
  Power: 0x1,
  SetCoolFlowTemperatureZone1: 0x1_00_00_00_00_00_00,
  SetCoolFlowTemperatureZone2: 0x1_00_00_00_00_00_00,
  SetHeatFlowTemperatureZone1: 0x1_00_00_00_00_00_00,
  SetHeatFlowTemperatureZone2: 0x1_00_00_00_00_00_00,
  SetTankWaterTemperature: 0x1_00_00_00_00_00_20,
  SetTemperatureZone1: 0x2_00_00_00_80,
  SetTemperatureZone2: 0x8_00_00_02_00,
} as const satisfies Record<
  keyof ClassicUpdateDeviceData<typeof ClassicDeviceType.Atw>,
  number
>

export const classicErvFlags = {
  Power: 0x1,
  SetFanSpeed: 0x8,
  VentilationMode: 0x4,
} as const satisfies Record<
  keyof ClassicUpdateDeviceData<typeof ClassicDeviceType.Erv>,
  number
>
