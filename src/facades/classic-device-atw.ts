import {
  ClassicDeviceType,
  ClassicOperationModeState,
  ClassicOperationModeStateHotWater,
  ClassicOperationModeStateZone,
} from '../constants.ts'
import {
  type ClassicHotWaterState,
  type ClassicListDeviceDataAtw,
  type ClassicTemperatureDataAtw,
  type ClassicUpdateDeviceDataAtw,
  type ClassicZoneAtw,
  type ClassicZoneState,
  type Result,
  mapResult,
} from '../types/index.ts'
import { clampToRange } from '../utils.ts'
import type { ReportChartLineOptions, ReportQuery } from './report-types.ts'
import { BaseDeviceFacade } from './classic-base-device.ts'
import { classicAtwFlags } from './classic-flags.ts'

const DEFAULT_TEMPERATURE = 0

const MIN_TANK_TEMPERATURE = 40

const coolFlowTemperatureRange = { max: 25, min: 5 }
const heatFlowTemperatureRange = { max: 60, min: 25 }
const roomTemperatureRange = { max: 30, min: 10 }

const hotWaterStateMap: Partial<
  Record<ClassicOperationModeState, ClassicOperationModeStateHotWater>
> = {
  [ClassicOperationModeState.dhw]: ClassicOperationModeStateHotWater.dhw,
  [ClassicOperationModeState.legionella]:
    ClassicOperationModeStateHotWater.legionella,
}

const zoneStateMap: Partial<
  Record<ClassicOperationModeState, ClassicOperationModeStateZone>
> = {
  [ClassicOperationModeState.cooling]: ClassicOperationModeStateZone.cooling,
  [ClassicOperationModeState.defrost]: ClassicOperationModeStateZone.defrost,
  [ClassicOperationModeState.heating]: ClassicOperationModeStateZone.heating,
}

const getHotWaterOperationalState = (
  data: ClassicListDeviceDataAtw,
): ClassicOperationModeStateHotWater => {
  if (data.ForcedHotWaterMode) {
    return ClassicOperationModeStateHotWater.dhw
  }
  return data.ProhibitHotWater ?
      ClassicOperationModeStateHotWater.prohibited
    : (hotWaterStateMap[data.OperationMode] ??
        ClassicOperationModeStateHotWater.idle)
}

const getZoneOperationalState = (
  data: ClassicListDeviceDataAtw,
  zone: ClassicZoneAtw,
): ClassicOperationModeStateZone => {
  if (
    (data[`${zone}InCoolMode`] && data[`ProhibitCooling${zone}`]) ||
    (data[`${zone}InHeatMode`] && data[`ProhibitHeating${zone}`])
  ) {
    return ClassicOperationModeStateZone.prohibited
  }
  return data[`Idle${zone}`] ?
      ClassicOperationModeStateZone.idle
    : (zoneStateMap[data.OperationMode] ?? ClassicOperationModeStateZone.idle)
}

// Merge external and internal temperature reports, deduplicating series
// that appear in both (e.g., FlowTemperature from different endpoints)
const mergeSeries = (
  series1: ReportChartLineOptions['series'],
  series2: ReportChartLineOptions['series'],
): ReportChartLineOptions['series'] => {
  const series1Names = new Set(series1.map(({ name }) => name))
  return [...series1, ...series2.filter(({ name }) => !series1Names.has(name))]
}

/** Facade for Air-to-Water (ATW) devices with per-zone temperature clamping and merged temperature reports. */
export class ClassicDeviceAtwFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Atw
> {
  public readonly flags: typeof classicAtwFlags = classicAtwFlags

  public readonly type: typeof ClassicDeviceType.Atw = ClassicDeviceType.Atw

  public get hotWater(): ClassicHotWaterState {
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

  public get zone1(): ClassicZoneState {
    return this.getZoneState('Zone1')
  }

  protected override readonly internalTemperaturesLegend: readonly string[] = [
    'FlowTemperature',
    'FlowTemperatureBoiler',
    'ReturnTemperature',
    'ReturnTemperatureBoiler',
    'SetTankWaterTemperature',
    'TankWaterTemperature',
    'MixingTankWaterTemperature',
  ]

  protected readonly temperaturesLegend: readonly string[] = [
    'SetTemperatureZone1',
    'RoomTemperatureZone1',
    'OutdoorTemperature',
    'SetTankWaterTemperature',
    'TankWaterTemperature',
  ]

  get #targetTemperatureRanges(): [
    keyof ClassicTemperatureDataAtw,
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

  // ATW reports both external (building) and internal (tank/boiler)
  // temperatures — merge them into a single chart
  public override async getTemperatures(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<Result<ReportChartLineOptions>> {
    const temperatures = await super.getTemperatures(query, shouldUseExactRange)
    if (!temperatures.ok) {
      return temperatures
    }
    const internal = await this.getInternalTemperatures(
      query,
      shouldUseExactRange,
    )
    return mapResult(internal, ({ series: internalTemperaturesSeries }) => ({
      ...temperatures.value,
      series: mergeSeries(
        temperatures.value.series,
        internalTemperaturesSeries,
      ),
    }))
  }

  protected getZoneState(zone: ClassicZoneAtw): ClassicZoneState {
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
    data: Partial<ClassicUpdateDeviceDataAtw>,
  ): Required<ClassicUpdateDeviceDataAtw> {
    return super.prepareUpdateData({
      ...data,
      ...this.#clampTargetTemperatures(data),
    })
  }

  #clampTargetTemperatures(
    data: Partial<ClassicUpdateDeviceDataAtw>,
  ): ClassicTemperatureDataAtw {
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
