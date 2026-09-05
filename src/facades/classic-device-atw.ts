import {
  type HomeAtwOperationalState,
  ClassicDeviceType,
  ClassicOperationModeState,
  ClassicOperationModeStateHotWater,
  ClassicOperationModeStateZone,
  ClassicOperationModeZone,
  HomeAtwZoneMode,
} from '../constants.ts'
import {
  atwOperationalStateFromClassic,
  atwZoneModeFromClassic,
} from '../enum-mappings.ts'
import {
  type ClassicEnergyDataAtw,
  type ClassicHotWaterState,
  type ClassicListDeviceDataAtw,
  type ClassicOperationModeZoneDataAtw,
  type ClassicTemperatureDataAtw,
  type ClassicUpdateDeviceDataAtw,
  type ClassicZoneAtw,
  type ClassicZoneState,
  type Result,
  mapResult,
} from '../types/index.ts'
import { clampToRange, isUninitializedWireDate, toEpochMs } from '../utils.ts'
import type { ClassicEnergyReportExtract } from './classic-types.ts'
import type { ReportChartLineOptions, ReportQuery } from './report-types.ts'
import { BaseDeviceFacade, makeEnergyExtract } from './classic-base-device.ts'
import { classicAtwFlags } from './classic-flags.ts'

const MIN_TANK_TEMPERATURE = 40

// The wire is typed but never runtime-validated (the envelope schema
// leaves per-type payloads loose), so an out-of-vocabulary zone-mode
// number must degrade to the room basis like the Home dialect's
// unknown FTC strings — new vocabulary can never break a consumer's
// sync. The widened view is what makes the fallback expressible.
const zoneModeFromWireNumber: Partial<Record<number, HomeAtwZoneMode>> =
  atwZoneModeFromClassic

// Same widening for the top-level state: an out-of-vocabulary number
// reads `null`, mirroring the Home facade's verdict on an unknown FTC
// string.
const operationalStateFromWireNumber: Partial<
  Record<number, HomeAtwOperationalState>
> = atwOperationalStateFromClassic

// Operation modes follow a pattern: room (0) vs flow (1), with cool variants
// offset by 3. These gaps let us auto-adjust zone 2 when zone 1 changes.
const HEAT_COOL_GAP =
  ClassicOperationModeZone.room_cool - ClassicOperationModeZone.room
const ROOM_FLOW_GAP =
  ClassicOperationModeZone.flow - ClassicOperationModeZone.room
const roomOperationModeZones: ReadonlySet<ClassicOperationModeZone> = new Set([
  ClassicOperationModeZone.room,
  ClassicOperationModeZone.room_cool,
])
const operationModeZoneValues: ReadonlySet<number> = new Set(
  Object.values(ClassicOperationModeZone),
)

const isOperationModeZone = (
  value: number,
): value is ClassicOperationModeZone => operationModeZoneValues.has(value)

const toOperationModeZone = (value: number): ClassicOperationModeZone => {
  if (!isOperationModeZone(value)) {
    throw new Error(`Invalid ClassicOperationModeZone: ${String(value)}`)
  }
  return value
}

const coolFlowTemperatureRange = { max: 25, min: 5 }
const heatFlowTemperatureRange = { max: 60, min: 25 }
const roomTemperatureRange = { max: 30, min: 10 }

// `EnergyCost/Report` energy buckets charted by `getEnergyReport`:
// the consumed stack first, then the produced stack, in MELCloud
// display order. `CoP` is excluded — a ratio cannot share the kWh axis.
const energyReportBuckets = [
  'Heating',
  'Cooling',
  'HotWater',
  'ProducedHeating',
  'ProducedCooling',
  'ProducedHotWater',
] as const

const hotWaterStateMap: Partial<
  Record<ClassicOperationModeState, ClassicOperationModeStateHotWater>
> = {
  [ClassicOperationModeState.dhw]: ClassicOperationModeStateHotWater.dhw,
  [ClassicOperationModeState.legionellaPrevention]:
    ClassicOperationModeStateHotWater.legionellaPrevention,
}

const zoneStateMap: Partial<
  Record<ClassicOperationModeState, ClassicOperationModeStateZone>
> = {
  [ClassicOperationModeState.cooling]: ClassicOperationModeStateZone.cooling,
  [ClassicOperationModeState.defrost]: ClassicOperationModeStateZone.defrost,
  [ClassicOperationModeState.heating]: ClassicOperationModeStateZone.heating,
}

// The wire's last-legionella stamp is building-local wall clock like
// every Classic timestamp, so it anchors in the client's configured
// timezone; the year-1 sentinel marks "never ran" and an unparseable
// value has nothing to say — both read `null` (`toEpochMs` itself
// answers `null` for garbage, so no other marker can leak through).
const toLastLegionellaEpochMs = (
  value: string,
  timeZone?: string,
): number | null =>
  isUninitializedWireDate(value) ? null : toEpochMs(value, timeZone)

const getHotWaterOperationalState = (
  data: ClassicListDeviceDataAtw,
): ClassicOperationModeStateHotWater => {
  if (data.ForcedHotWaterMode) {
    return ClassicOperationModeStateHotWater.dhw
  }
  return data.ProhibitHotWater
    ? ClassicOperationModeStateHotWater.prohibited
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
  return data[`Idle${zone}`]
    ? ClassicOperationModeStateZone.idle
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

/**
 * Facade for Air-to-Water (ATW) devices with per-zone temperature clamping and merged temperature reports.
 * @category Facades
 */
export class ClassicDeviceAtwFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Atw
> {
  public readonly flags: typeof classicAtwFlags = classicAtwFlags

  public readonly type: typeof ClassicDeviceType.Atw = ClassicDeviceType.Atw

  /**
   * Hot-water tank state derived from the last-synced device payload
   * (eco/forced/prohibited flags, current and target tank temperatures,
   * computed operational state).
   * @returns The hot-water snapshot.
   */
  public get hotWater(): ClassicHotWaterState {
    const { data } = this
    return {
      isEcoHotWater: data.EcoHotWater,
      isForcedMode: data.ForcedHotWaterMode,
      isProhibited: data.ProhibitHotWater,
      lastLegionellaActivationEpochMs: toLastLegionellaEpochMs(
        data.LastLegionellaActivationTime,
        this.api.timezone,
      ),
      maxTankTemperature: data.MaxTankTemperature,
      operationalState: getHotWaterOperationalState(data),
      setTankWaterTemperature: data.SetTankWaterTemperature,
      tankWaterTemperature: data.TankWaterTemperature,
    }
  }

  /**
   * Top-level derived operational state — the same cross-dialect read
   * the Home ATW facade answers from its FTC strings, derived here
   * from the wire's numeric `OperationMode` through the total
   * bijection; an out-of-vocabulary number reads `null` like an
   * unknown FTC string, so new wire vocabulary can never break a
   * consumer's sync.
   * @returns The derived state, or `null` when the mode is unknown.
   */
  public get operationalState(): HomeAtwOperationalState | null {
    return operationalStateFromWireNumber[this.data.OperationMode] ?? null
  }

  /**
   * Operation, hot-water and temperature state for Zone 1.
   * @returns The Zone 1 state snapshot.
   */
  public get zone1(): ClassicZoneState {
    return this.#zoneState('Zone1')
  }

  /**
   * Operation, hot-water and temperature state for Zone 2, or `null`
   * on a single-zone unit — the capability shape both dialects share
   * (`HasZone2` here, the Home `hasZone2` capability there); a second
   * zone is a nullable read, never a distinct published type.
   * @returns The Zone 2 state snapshot, or `null`.
   */
  public get zone2(): ClassicZoneState | null {
    return this.data.HasZone2 ? this.#zoneState('Zone2') : null
  }

  protected override readonly extractEnergyReport: (
    data: ClassicEnergyDataAtw,
  ) => ClassicEnergyReportExtract = makeEnergyExtract(energyReportBuckets)

  // The legends are POSITIONAL wire contracts (series index N carries
  // the name at index N), so each variant pins its own order — and the
  // two variants deliberately diverge on the tank pair (Set-then-actual
  // on single-zone, actual-then-Set on dual-zone): inherited wire
  // order, observed since the first chart support, codified rather
  // than "fixed". `HasZone2` is a physical property, fixed for the
  // unit's lifetime, so the choice binds at construction.
  protected override readonly internalTemperaturesLegend: readonly string[] =
    this.data.HasZone2
      ? [
          'FlowTemperature',
          'FlowTemperatureBoiler',
          'FlowTemperatureZone1',
          'FlowTemperatureZone2',
          'ReturnTemperature',
          'ReturnTemperatureBoiler',
          'ReturnTemperatureZone1',
          'ReturnTemperatureZone2',
          'SetTankWaterTemperature',
          'TankWaterTemperature',
          'MixingTankWaterTemperature',
        ]
      : [
          'FlowTemperature',
          'FlowTemperatureBoiler',
          'ReturnTemperature',
          'ReturnTemperatureBoiler',
          'SetTankWaterTemperature',
          'TankWaterTemperature',
          'MixingTankWaterTemperature',
        ]

  protected readonly temperaturesLegend: readonly string[] = this.data.HasZone2
    ? [
        'SetTemperatureZone1',
        'RoomTemperatureZone1',
        'SetTemperatureZone2',
        'RoomTemperatureZone2',
        'OutdoorTemperature',
        'TankWaterTemperature',
        'SetTankWaterTemperature',
      ]
    : [
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

  /**
   * Fetches both the external (building) and internal (tank/boiler)
   * temperature reports and merges them into a single chart series.
   * @param query - Optional report time window.
   * @returns The merged chart options, or a typed failure.
   */
  // ATW reports both external (building) and internal (tank/boiler)
  // temperatures — merge them into a single chart
  public override async getTemperatures(
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    const temperatures = await super.getTemperatures(query)
    if (!temperatures.ok) {
      return temperatures
    }
    const internal = await this.getInternalTemperatures(query)
    return mapResult(internal, ({ series: internalTemperaturesSeries }) => ({
      ...temperatures.value,
      series: mergeSeries(
        temperatures.value.series,
        internalTemperaturesSeries,
      ),
    }))
  }

  protected override prepareUpdateData(
    data: Partial<ClassicUpdateDeviceDataAtw>,
  ): Required<ClassicUpdateDeviceDataAtw> {
    return super.prepareUpdateData({
      ...data,
      ...this.#clampTargetTemperatures(data),
      ...(this.data.HasZone2 && this.#coupleOperationModes(data)),
    })
  }

  #clampTargetTemperatures(
    data: Partial<ClassicUpdateDeviceDataAtw>,
  ): ClassicTemperatureDataAtw {
    return Object.fromEntries(
      this.#targetTemperatureRanges
        .filter(([key]) => Object.hasOwn(data, key))
        .map(([key, range]) => [
          key,
          clampToRange(data[key] ?? range.min, range),
        ]),
    )
  }

  #coupleOperationModes(
    data: Partial<ClassicUpdateDeviceDataAtw>,
  ): ClassicOperationModeZoneDataAtw | null {
    const zone1 = {
      key: 'OperationModeZone1',
      value: data.OperationModeZone1,
    } as const
    const zone2 = {
      key: 'OperationModeZone2',
      value: data.OperationModeZone2,
    } as const

    // Whichever zone was explicitly changed becomes the primary; the other
    // is automatically adjusted to maintain consistency
    const [primaryOperationMode, secondaryOperationMode] =
      zone1.value === undefined ? [zone2, zone1] : [zone1, zone2]

    if (primaryOperationMode.value === undefined) {
      return null
    }
    return {
      [primaryOperationMode.key]: primaryOperationMode.value,
      [secondaryOperationMode.key]: this.#getSecondaryOperationMode(
        secondaryOperationMode.key,
        primaryOperationMode.value,
        secondaryOperationMode.value,
      ),
    }
  }

  #getSecondaryOperationMode(
    secondaryKey: keyof ClassicOperationModeZoneDataAtw,
    primaryValue: ClassicOperationModeZone,
    value?: ClassicOperationModeZone,
  ): ClassicOperationModeZone {
    // Keep zone 2's cool/heat status in sync with zone 1, and prevent
    // both zones from using the same room-based mode (must be room vs flow)
    let secondaryValue: number = value ?? this.data[secondaryKey]
    if (this.data.CanCool) {
      if (primaryValue > ClassicOperationModeZone.curve) {
        secondaryValue =
          secondaryValue === ClassicOperationModeZone.curve
            ? ClassicOperationModeZone.room_cool
            : secondaryValue + HEAT_COOL_GAP
      } else if (secondaryValue > ClassicOperationModeZone.curve) {
        secondaryValue -= HEAT_COOL_GAP
      }
    }
    if (
      primaryValue === secondaryValue &&
      roomOperationModeZones.has(primaryValue)
    ) {
      secondaryValue += ROOM_FLOW_GAP
    }
    return toOperationModeZone(secondaryValue)
  }

  #zoneState(zone: ClassicZoneAtw): ClassicZoneState {
    const { data } = this
    return {
      isCoolingProhibited: data[`ProhibitCooling${zone}`],
      isHeatingProhibited: data[`ProhibitHeating${zone}`],
      isIdle: data[`Idle${zone}`],
      isInCoolMode: data[`${zone}InCoolMode`],
      isInHeatMode: data[`${zone}InHeatMode`],
      operationalState: getZoneOperationalState(data, zone),
      // The wire speaks numbers; the cross-dialect state speaks the
      // shared string vocabulary — the total bijection projects, and an
      // out-of-vocabulary number degrades to the room basis.
      operationMode:
        zoneModeFromWireNumber[data[`OperationMode${zone}`]] ??
        HomeAtwZoneMode.room,
      roomTemperature: data[`RoomTemperature${zone}`],
      setTemperature: data[`SetTemperature${zone}`],
    }
  }
}
