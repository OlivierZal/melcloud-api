import { BaseDeviceFacade } from './base-device.ts'

import type { DeviceType } from '../enums.ts'
import type { TemperatureDataAtw, UpdateDeviceDataAtw } from '../types/atw.ts'

import type {
  IDeviceFacade,
  ReportChartLineOptions,
  ReportQuery,
} from './interfaces.ts'

const DEFAULT_TEMPERATURE = 0

const coolFlowTemperatureRange = { max: 25, min: 5 } as const
const heatFlowTemperatureRange = { max: 60, min: 25 } as const
const roomTemperatureRange = { max: 30, min: 10 } as const

const mergeSeries = (
  series1: ReportChartLineOptions['series'],
  series2: ReportChartLineOptions['series'],
): ReportChartLineOptions['series'] => [
  ...series1,
  ...series2.filter(
    ({ name }) =>
      !series1.map(({ name: serieName }) => serieName).includes(name),
  ),
]

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
