import type { UpdateDeviceData } from '../types/index.ts'
import { DeviceType } from '../constants.ts'
import type { ReportChartPieOptions, ReportQuery } from './interfaces.ts'
import { BaseDeviceFacade } from './base-device.ts'

const isRelevantVentilationMode = (label?: string): boolean =>
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

  protected readonly temperaturesLegend = [
    undefined,
    'RoomTemperature',
    undefined,
    'OutdoorTemperature',
  ]

  public readonly type = DeviceType.Erv

  public override async getOperationModes(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<ReportChartPieOptions> {
    const { labels, series, ...options } = await super.getOperationModes(
      query,
      shouldUseExactRange,
    )
    // Filter labels and series together to keep indices in sync
    const filtered = labels
      .map((label, index) => ({ label, value: series[index] }))
      .filter((item): item is { label: string; value: number } =>
        isRelevantVentilationMode(item.label),
      )

    return {
      ...options,
      labels: filtered.map(({ label }) => label),
      series: filtered.map(({ value }) => value),
    }
  }
}
