import { BaseDeviceFacade } from './base-device.ts'

import type { DeviceType } from '../enums.ts'

import type {
  IDeviceFacade,
  ReportChartPieOptions,
  ReportQuery,
} from './interfaces.ts'

const filterVentilationModes = (label?: string): boolean =>
  label !== undefined &&
  (label === 'Power' ||
    (label.startsWith('Actual') && !label.endsWith('OperationMode')))

export class DeviceErvFacade
  extends BaseDeviceFacade<DeviceType.Erv>
  implements IDeviceFacade<DeviceType.Erv>
{
  public readonly flags = {
    Power: 0x1,
    SetFanSpeed: 0x8,
    VentilationMode: 0x4,
  } as const

  protected readonly temperaturesLegend = [
    undefined,
    'RoomTemperature',
    undefined,
    'OutdoorTemperature',
  ]

  public override async operationModes(
    query: ReportQuery = {},
    useExactRange = true,
  ): Promise<ReportChartPieOptions> {
    const options = await super.operationModes(query, useExactRange)
    const { labels, series } = options
    return {
      ...options,
      labels: labels.filter(filterVentilationModes),
      series: series.filter((_serie, index) =>
        filterVentilationModes(labels.at(index)),
      ),
    }
  }
}
