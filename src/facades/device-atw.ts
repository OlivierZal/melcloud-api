import { AtwFlag, type DeviceType } from '../enums.ts'
import type { TemperatureDataAtw, UpdateDeviceDataAtw } from '../types/index.ts'

import type {
  IDeviceFacade,
  ReportChartLineOptions,
  ReportQuery,
} from './interfaces.ts'

import { BaseDeviceFacade } from './base-device.ts'

const DEFAULT_TEMPERATURE = 0

const coolFlowTemperatureRange = { max: 25, min: 5 }
const heatFlowTemperatureRange = { max: 60, min: 25 }
const roomTemperatureRange = { max: 30, min: 10 }

const mergeSeries = (
  series1: ReportChartLineOptions['series'],
  series2: ReportChartLineOptions['series'],
): ReportChartLineOptions['series'] => {
  const series1Names = new Set(series1.map(({ name }) => name))
  return [...series1, ...series2.filter(({ name }) => !series1Names.has(name))]
}

export class DeviceAtwFacade
  extends BaseDeviceFacade<DeviceType.Atw>
  implements IDeviceFacade<DeviceType.Atw>
{
  protected override readonly internalTemperaturesLegend = [
    'FlowTemperature',
    'FlowTemperatureBoiler',
    'ReturnTemperature',
    'ReturnTemperatureBoiler',
    'SetTankWaterTemperature',
    'TankWaterTemperature',
    'MixingTankWaterTemperature',
  ]

  public readonly flags = {
    ForcedHotWaterMode: AtwFlag.ForcedHotWaterMode,
    OperationModeZone1: AtwFlag.OperationModeZone1,
    OperationModeZone2: AtwFlag.OperationModeZone2,
    Power: AtwFlag.Power,
    SetCoolFlowTemperatureZone1: AtwFlag.SetFlowTemperature,
    SetCoolFlowTemperatureZone2: AtwFlag.SetFlowTemperature,
    SetHeatFlowTemperatureZone1: AtwFlag.SetFlowTemperature,
    SetHeatFlowTemperatureZone2: AtwFlag.SetFlowTemperature,
    SetTankWaterTemperature: AtwFlag.SetTankWaterTemperature,
    SetTemperatureZone1: AtwFlag.SetTemperatureZone1,
    SetTemperatureZone2: AtwFlag.SetTemperatureZone2,
  }

  protected readonly temperaturesLegend = [
    'SetTemperatureZone1',
    'RoomTemperatureZone1',
    'OutdoorTemperature',
    'SetTankWaterTemperature',
    'TankWaterTemperature',
  ]

  get #targetTemperatureRanges(): [
    keyof TemperatureDataAtw,
    { max: number; min: number },
  ][] {
    return [
      ['SetCoolFlowTemperatureZone1', coolFlowTemperatureRange],
      ['SetCoolFlowTemperatureZone2', coolFlowTemperatureRange],
      ['SetHeatFlowTemperatureZone1', heatFlowTemperatureRange],
      ['SetHeatFlowTemperatureZone2', heatFlowTemperatureRange],
      [
        'SetTankWaterTemperature',
        { max: this.data.MaxTankTemperature, min: 40 },
      ],
      ['SetTemperatureZone1', roomTemperatureRange],
      ['SetTemperatureZone2', roomTemperatureRange],
    ]
  }

  public override async temperatures(
    query?: ReportQuery,
    useExactRange = true,
  ): Promise<ReportChartLineOptions> {
    const temperatures = await super.temperatures(query, useExactRange)
    const { series: internalTemperaturesSeries } =
      await this.internalTemperatures(query, useExactRange)
    return {
      ...temperatures,
      series: mergeSeries(temperatures.series, internalTemperaturesSeries),
    }
  }

  protected override handle(
    data: Partial<UpdateDeviceDataAtw>,
  ): Required<UpdateDeviceDataAtw> {
    return super.handle({ ...data, ...this.#handleTargetTemperatures(data) })
  }

  #handleTargetTemperatures(
    data: Partial<UpdateDeviceDataAtw>,
  ): TemperatureDataAtw {
    return Object.fromEntries(
      this.#targetTemperatureRanges
        .filter(([key]) => key in data)
        .map(([key, { max, min }]) => [
          key,
          Math.min(Math.max(data[key] ?? DEFAULT_TEMPERATURE, min), max),
        ]),
    )
  }
}
