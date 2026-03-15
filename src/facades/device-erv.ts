import type { UpdateDeviceData } from '../types/index.ts'

import { DeviceType } from '../constants.ts'

import type { ReportChartPieOptions, ReportQuery } from './interfaces.ts'

import { BaseDeviceFacade } from './base-device.ts'

const filterVentilationModes = (label?: string): boolean =>
  label !== undefined &&
  (label === 'Power' ||
    (label.startsWith('Actual') && !label.endsWith('OperationMode')))

/** Facade for Energy Recovery Ventilation (ERV) devices with filtered ventilation mode reporting. */
export class DeviceErvFacade extends BaseDeviceFacade<typeof DeviceType.Erv> {
  public readonly flags = {
    Power: 0x1,
    SetFanSpeed: 0x8,
    VentilationMode: 0x4,
  } satisfies Record<keyof UpdateDeviceData<typeof DeviceType.Erv>, number>

  public readonly type = DeviceType.Erv

  protected readonly temperaturesLegend = [
    undefined,
    'RoomTemperature',
    undefined,
    'OutdoorTemperature',
  ]

  public override async operationModes(
    query?: ReportQuery,
    useExactRange = true,
  ): Promise<ReportChartPieOptions> {
    const { labels, series, ...options } = await super.operationModes(
      query,
      useExactRange,
    )
    // Filter labels and series together to keep indices in sync
    const filtered = labels
      .map((label, index) => ({ label, value: series[index] }))
      .filter((item): item is { label: string; value: number } =>
        filterVentilationModes(item.label),
      )
    return {
      ...options,
      labels: filtered.map(({ label }) => label),
      series: filtered.map(({ value }) => value),
    }
  }
}
