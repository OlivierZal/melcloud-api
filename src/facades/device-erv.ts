import type { DeviceType } from '../enums.ts'

import type {
  IDeviceFacade,
  ReportChartPieOptions,
  ReportQuery,
} from './interfaces.ts'

import { BaseDeviceFacade } from './base-device.ts'

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
  }

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
    return {
      ...options,
      labels: labels.filter((label) => filterVentilationModes(label)),
      series: series.filter((_serie, index) =>
        filterVentilationModes(labels.at(index)),
      ),
    }
  }
}
