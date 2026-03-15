import type {
  HotWaterState,
  ListDeviceDataAtw,
  TemperatureDataAtw,
  UpdateDeviceData,
  UpdateDeviceDataAtw,
  ZoneAtw,
  ZoneState,
} from '../types/index.ts'

import {
  DeviceType,
  OperationModeState,
  OperationModeStateHotWater,
  OperationModeStateZone,
} from '../constants.ts'

import type { ReportChartLineOptions, ReportQuery } from './interfaces.ts'

import { BaseDeviceFacade } from './base-device.ts'

const DEFAULT_TEMPERATURE = 0

const COOL_FLOW_TEMPERATURE_RANGE = { max: 25, min: 5 } as const
const HEAT_FLOW_TEMPERATURE_RANGE = { max: 60, min: 25 } as const
const ROOM_TEMPERATURE_RANGE = { max: 30, min: 10 } as const

const HOT_WATER_STATE_MAP: Partial<
  Record<OperationModeState, OperationModeStateHotWater>
> = {
  [OperationModeState.dhw]: OperationModeStateHotWater.dhw,
  [OperationModeState.legionella]: OperationModeStateHotWater.legionella,
}

const ZONE_STATE_MAP: Partial<
  Record<OperationModeState, OperationModeStateZone>
> = {
  [OperationModeState.cooling]: OperationModeStateZone.cooling,
  [OperationModeState.defrost]: OperationModeStateZone.defrost,
  [OperationModeState.heating]: OperationModeStateZone.heating,
}

const getHotWaterOperationalState = (
  data: ListDeviceDataAtw,
): OperationModeStateHotWater => {
  if (data.ForcedHotWaterMode) {
    return OperationModeStateHotWater.dhw
  }
  if (data.ProhibitHotWater) {
    return OperationModeStateHotWater.prohibited
  }
  return HOT_WATER_STATE_MAP[data.OperationMode] ?? OperationModeStateHotWater.idle
}

const getZoneOperationalState = (
  data: ListDeviceDataAtw,
  zone: ZoneAtw,
): OperationModeStateZone => {
  if (
    (data[`${zone}InCoolMode`] && data[`ProhibitCooling${zone}`]) ||
    (data[`${zone}InHeatMode`] && data[`ProhibitHeating${zone}`])
  ) {
    return OperationModeStateZone.prohibited
  }
  const { OperationMode: operationMode } = data
  if (!data[`Idle${zone}`]) {
    return ZONE_STATE_MAP[operationMode] ?? OperationModeStateZone.idle
  }
  return OperationModeStateZone.idle
}

/*
 * Merge external and internal temperature reports, deduplicating series
 * that appear in both (e.g., FlowTemperature from different endpoints)
 */
const mergeSeries = (
  series1: ReportChartLineOptions['series'],
  series2: ReportChartLineOptions['series'],
): ReportChartLineOptions['series'] => {
  const series1Names = new Set(series1.map(({ name }) => name))
  return [...series1, ...series2.filter(({ name }) => !series1Names.has(name))]
}

/** Facade for Air-to-Water (ATW) devices with per-zone temperature clamping and merged temperature reports. */
export class DeviceAtwFacade extends BaseDeviceFacade<typeof DeviceType.Atw> {
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
  } satisfies Record<keyof UpdateDeviceData<typeof DeviceType.Atw>, number>

  public readonly type = DeviceType.Atw

  protected readonly temperaturesLegend = [
    'SetTemperatureZone1',
    'RoomTemperatureZone1',
    'OutdoorTemperature',
    'SetTankWaterTemperature',
    'TankWaterTemperature',
  ]

  public get hotWater(): HotWaterState {
    const { data } = this
    return {
      isEcoHotWater: data.EcoHotWater,
      isForcedMode: data.ForcedHotWaterMode,
      isProhibited: data.ProhibitHotWater,
      maxTankTemperature: data.MaxTankTemperature,
      operationalState: getHotWaterOperationalState(data),
      setTankWaterTemperature: data.SetTankWaterTemperature,
      tankWaterTemperature: data.TankWaterTemperature,
    }
  }

  public get zone1(): ZoneState {
    return this.getZoneState('Zone1')
  }

  get #targetTemperatureRanges(): [
    keyof TemperatureDataAtw,
    { max: number; min: number },
  ][] {
    return [
      ['SetCoolFlowTemperatureZone1', COOL_FLOW_TEMPERATURE_RANGE],
      ['SetCoolFlowTemperatureZone2', COOL_FLOW_TEMPERATURE_RANGE],
      ['SetHeatFlowTemperatureZone1', HEAT_FLOW_TEMPERATURE_RANGE],
      ['SetHeatFlowTemperatureZone2', HEAT_FLOW_TEMPERATURE_RANGE],
      [
        'SetTankWaterTemperature',
        { max: this.data.MaxTankTemperature, min: 40 },
      ],
      ['SetTemperatureZone1', ROOM_TEMPERATURE_RANGE],
      ['SetTemperatureZone2', ROOM_TEMPERATURE_RANGE],
    ]
  }

  /*
   * ATW reports both external (building) and internal (tank/boiler)
   * temperatures — merge them into a single chart
   */
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

  protected override prepareUpdateData(
    data: Partial<UpdateDeviceDataAtw>,
  ): Required<UpdateDeviceDataAtw> {
    return super.prepareUpdateData({ ...data, ...this.#handleTargetTemperatures(data) })
  }

  protected getZoneState(zone: ZoneAtw): ZoneState {
    const { data } = this
    return {
      isIdle: data[`Idle${zone}`],
      isInCoolMode: data[`${zone}InCoolMode`],
      isInHeatMode: data[`${zone}InHeatMode`],
      isProhibitCooling: data[`ProhibitCooling${zone}`],
      isProhibitHeating: data[`ProhibitHeating${zone}`],
      operationalState: getZoneOperationalState(data, zone),
      operationMode: data[`OperationMode${zone}`],
      roomTemperature: data[`RoomTemperature${zone}`],
      setTemperature: data[`SetTemperature${zone}`],
    }
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
