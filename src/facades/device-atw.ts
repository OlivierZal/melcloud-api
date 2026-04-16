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
  ClassicDeviceType,
  OperationModeState,
  OperationModeStateHotWater,
  OperationModeStateZone,
} from '../constants.ts'
import type { ReportChartLineOptions, ReportQuery } from './interfaces.ts'
import { BaseDeviceFacade, clampToRange } from './base-device.ts'

const DEFAULT_TEMPERATURE = 0

const MIN_TANK_TEMPERATURE = 40

const coolFlowTemperatureRange = { max: 25, min: 5 }
const heatFlowTemperatureRange = { max: 60, min: 25 }
const roomTemperatureRange = { max: 30, min: 10 }

const hotWaterStateMap: Partial<
  Record<OperationModeState, OperationModeStateHotWater>
> = {
  [OperationModeState.dhw]: OperationModeStateHotWater.dhw,
  [OperationModeState.legionella]: OperationModeStateHotWater.legionella,
}

const zoneStateMap: Partial<
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
  return data.ProhibitHotWater ?
      OperationModeStateHotWater.prohibited
    : (hotWaterStateMap[data.OperationMode] ?? OperationModeStateHotWater.idle)
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
  return data[`Idle${zone}`] ?
      OperationModeStateZone.idle
    : (zoneStateMap[data.OperationMode] ?? OperationModeStateZone.idle)
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
export class DeviceAtwFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Atw
> {
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
  } as const satisfies Record<
    keyof UpdateDeviceData<typeof ClassicDeviceType.Atw>,
    number
  >

  public readonly type = ClassicDeviceType.Atw

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

  protected override readonly internalTemperaturesLegend = [
    'FlowTemperature',
    'FlowTemperatureBoiler',
    'ReturnTemperature',
    'ReturnTemperatureBoiler',
    'SetTankWaterTemperature',
    'TankWaterTemperature',
    'MixingTankWaterTemperature',
  ]

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
        { max: this.data.MaxTankTemperature, min: MIN_TANK_TEMPERATURE },
      ],
      ['SetTemperatureZone1', roomTemperatureRange],
      ['SetTemperatureZone2', roomTemperatureRange],
    ]
  }

  /*
   * ATW reports both external (building) and internal (tank/boiler)
   * temperatures — merge them into a single chart
   */
  public override async getTemperatures(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<ReportChartLineOptions> {
    const temperatures = await super.getTemperatures(query, shouldUseExactRange)
    const { series: internalTemperaturesSeries } =
      await this.getInternalTemperatures(query, shouldUseExactRange)
    return {
      ...temperatures,
      series: mergeSeries(temperatures.series, internalTemperaturesSeries),
    }
  }

  protected getZoneState(zone: ZoneAtw): ZoneState {
    const { data } = this
    return {
      isCoolingProhibited: data[`ProhibitCooling${zone}`],
      isHeatingProhibited: data[`ProhibitHeating${zone}`],
      isIdle: data[`Idle${zone}`],
      isInCoolMode: data[`${zone}InCoolMode`],
      isInHeatMode: data[`${zone}InHeatMode`],
      operationalState: getZoneOperationalState(data, zone),
      operationMode: data[`OperationMode${zone}`],
      roomTemperature: data[`RoomTemperature${zone}`],
      setTemperature: data[`SetTemperature${zone}`],
    }
  }

  protected override prepareUpdateData(
    data: Partial<UpdateDeviceDataAtw>,
  ): Required<UpdateDeviceDataAtw> {
    return super.prepareUpdateData({
      ...data,
      ...this.#clampTargetTemperatures(data),
    })
  }

  #clampTargetTemperatures(
    data: Partial<UpdateDeviceDataAtw>,
  ): TemperatureDataAtw {
    return Object.fromEntries(
      this.#targetTemperatureRanges
        .filter(([key]) => key in data)
        .map(([key, range]) => [
          key,
          clampToRange(data[key] ?? DEFAULT_TEMPERATURE, range),
        ]),
    )
  }
}
