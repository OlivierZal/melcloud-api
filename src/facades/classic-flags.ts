import type { ClassicDeviceType } from '../constants.ts'
import type { ClassicUpdateDeviceData } from '../types/index.ts'

// MELCloud EffectiveFlags bitfield values — each bit tells the Classic
// API which fields in an update payload should actually be applied.
//
// Centralised here (not on each facade) so:
//   - all magic hex constants live in a single table,
//   - comparing bit assignments across device types is possible at a glance,
//   - new device types or new fields are added by extending one map.
//
// Each map carries a literal-typed annotation so callers see the exact
// bit value at type level (e.g. `classicAtaFlags.Power: 0x1`, not
// `number`). A trailing `satisfies` clause binds the keys to
// `ClassicUpdateDeviceData<T>` so adding a field without a flag (or a
// flag without a field) fails to type-check.

/** `EffectiveFlags` bitfield values for ATA update payloads — one bit per updatable field. */
export const classicAtaFlags: {
  readonly OperationMode: 0x2
  readonly Power: 0x1
  readonly SetFanSpeed: 0x8
  readonly SetTemperature: 0x4
  readonly VaneHorizontal: 0x1_00
  readonly VaneVertical: 0x10
} = {
  OperationMode: 0x2,
  Power: 0x1,
  SetFanSpeed: 0x8,
  SetTemperature: 0x4,
  VaneHorizontal: 0x1_00,
  VaneVertical: 0x10,
} as const satisfies Readonly<
  Record<keyof ClassicUpdateDeviceData<typeof ClassicDeviceType.Ata>, number>
>

/** `EffectiveFlags` bitfield values for ATW update payloads — one bit per updatable field. */
export const classicAtwFlags: {
  readonly ForcedHotWaterMode: 0x1_00_00
  readonly OperationModeZone1: 0x8
  readonly OperationModeZone2: 0x10
  readonly Power: 0x1
  readonly SetCoolFlowTemperatureZone1: 0x1_00_00_00_00_00_00
  readonly SetCoolFlowTemperatureZone2: 0x1_00_00_00_00_00_00
  readonly SetHeatFlowTemperatureZone1: 0x1_00_00_00_00_00_00
  readonly SetHeatFlowTemperatureZone2: 0x1_00_00_00_00_00_00
  readonly SetTankWaterTemperature: 0x1_00_00_00_00_00_20
  readonly SetTemperatureZone1: 0x2_00_00_00_80
  readonly SetTemperatureZone2: 0x8_00_00_02_00
} = {
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
} as const satisfies Readonly<
  Record<keyof ClassicUpdateDeviceData<typeof ClassicDeviceType.Atw>, number>
>

/** `EffectiveFlags` bitfield values for ERV update payloads — one bit per updatable field. */
export const classicErvFlags: {
  readonly Power: 0x1
  readonly SetFanSpeed: 0x8
  readonly VentilationMode: 0x4
} = {
  Power: 0x1,
  SetFanSpeed: 0x8,
  VentilationMode: 0x4,
} as const satisfies Readonly<
  Record<keyof ClassicUpdateDeviceData<typeof ClassicDeviceType.Erv>, number>
>
