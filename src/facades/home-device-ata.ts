import {
  type ClassicOperationMode,
  type HomeDeviceType,
  ClassicFanSpeed,
} from '../constants.ts'
import {
  type HomeFanSpeed,
  type HomeHorizontal,
  type HomeOperationMode,
  type HomeVertical,
  fanSpeedFromClassic,
  isClassicFanSpeed,
  isHomeFanSpeed,
  operationModeFromClassic,
} from '../enum-mappings.ts'
import { tolerateNoChanges } from '../errors/index.ts'
import {
  type AtaTemperatureBounds,
  type TemperatureRange,
  ataTemperatureStep,
  rangeForHomeMode,
} from '../temperature-range.ts'
import {
  type ClassicGroupState,
  type HomeAtaDeviceCapabilities,
  type HomeAtaDeviceData,
  type HomeAtaValues,
  type HomeEnergyData,
  type Result,
  ok,
} from '../types/index.ts'
import { clampToRange, resolved, roundToStep } from '../utils.ts'
import type { ReportChartLineOptions, ReportQuery } from './report-types.ts'
import {
  homeGroupMemberModes,
  toClassicAtaGroupState,
  toHomeAtaValues,
} from './home-ata-group.ts'
import { HomeBaseDeviceFacade } from './home-base-device.ts'
import {
  type HomeEnergyQuery,
  type HomeEnergySeries,
  type HomeEnergySeriesQuery,
  getHomeAtaEnergyReport,
  getHomeAtaEnergySeries,
} from './home-energy.ts'
import { resolveHomeReportWindow } from './home-report.ts'

// The dialect extractor: Home spells the three advertised pairs in
// camelCase, and the shared module resolves modes onto them.
const toBounds = ({
  maxTempAutomatic,
  maxTempCoolDry,
  maxTempHeat,
  minTempAutomatic,
  minTempCoolDry,
  minTempHeat,
}: HomeAtaDeviceCapabilities): AtaTemperatureBounds => ({
  automatic: { max: maxTempAutomatic, min: minTempAutomatic },
  coolDry: { max: maxTempCoolDry, min: minTempCoolDry },
  heatFan: { max: maxTempHeat, min: minTempHeat },
})

/**
 * Facade for a MELCloud Home ATA device. Provides typed access to device
 * settings and per-mode temperature clamping before forwarding updates
 * to the BFF.
 * @category Facades
 */
export class HomeDeviceAtaFacade extends HomeBaseDeviceFacade<HomeAtaDeviceData> {
  declare public readonly type: typeof HomeDeviceType.Ata

  /**
   * Currently active operation mode (heat/cool/auto/dry/fan/off). The
   * type documents the known vocabulary; unknown or absent wire values
   * pass through unchecked (see `#enumSetting`), so exhaustive
   * switches should keep a default arm.
   * @returns The operation mode — a `HomeOperationMode` member for known
   * wire values, an unchecked wire string otherwise.
   */
  public get operationMode(): HomeOperationMode {
    return this.#enumSetting('OperationMode')
  }

  /**
   * Last-reported room temperature in degrees Celsius.
   * @returns Degrees Celsius as last reported by the device.
   */
  public get roomTemperature(): number {
    return this.settingNumber('RoomTemperature')
  }

  /**
   * Currently configured fan speed. Normalised from MELCloud Home's
   * inconsistent stringified-number representation back to the enum.
   * @returns A `HomeFanSpeed` enum value, `auto` when unset.
   */
  public get setFanSpeed(): HomeFanSpeed {
    // MELCloud Home API inconsistency: SetFanSpeed returns a stringified
    // number ("0") instead of the enum name ("Auto") like other settings.
    // Normalize via fanSpeedFromClassic, falling back to raw if already a name.
    const raw = this.setting('SetFanSpeed')
    const numeric = Number(raw)
    if (raw !== '' && isClassicFanSpeed(numeric)) {
      return fanSpeedFromClassic[numeric]
    }
    return isHomeFanSpeed(raw) ? raw : fanSpeedFromClassic[ClassicFanSpeed.auto]
  }

  /**
   * Target temperature setpoint in degrees Celsius.
   * @returns The setpoint temperature.
   */
  public get setTemperature(): number {
    return this.settingNumber('SetTemperature')
  }

  /**
   * Setpoint granularity in °C, from the unit's advertised
   * half-degree capability.
   * @returns `0.5` on half-degree units, `1` otherwise.
   */
  public get temperatureStep(): number {
    return ataTemperatureStep(this.capabilities.hasHalfDegreeIncrements)
  }

  /**
   * Currently configured horizontal vane direction. Same pass-through
   * contract as {@link operationMode}.
   * @returns The horizontal vane setting.
   */
  public get vaneHorizontalDirection(): HomeHorizontal {
    return this.#enumSetting('VaneHorizontalDirection')
  }

  /**
   * Currently configured vertical vane direction. Same pass-through
   * contract as {@link operationMode}.
   * @returns The vertical vane setting.
   */
  public get vaneVerticalDirection(): HomeVertical {
    return this.#enumSetting('VaneVerticalDirection')
  }

  /**
   * Fetches the raw energy telemetry of this device — the cumulative
   * consumption counter, in watt-hours, one request, wire-verbatim.
   * The escape hatch beside {@link getEnergySeries}, which owns the
   * dialect: the wire answers 24 hour buckets from `from` whatever `to`
   * says, so here a longer window is the caller's to chunk and a
   * shorter one the caller's to cut.
   * @param params - Query window and bucket grain.
   * @returns The telemetry bundle, or a typed failure.
   */
  public async getEnergy(
    params: HomeEnergyQuery,
  ): Promise<Result<HomeEnergyData>> {
    return this.api.getAtaEnergy(this.id, params)
  }

  /**
   * Fetches the energy report as line chart data — the Home counterpart
   * of the Classic `getEnergyReport` contract. The single ATA measure
   * is consumption, charted in `kWh`: hour buckets on a one-day span,
   * calendar days of the display timezone up to a week, the wire's UTC
   * days beyond; a bucket the wire omits (idle) charts as `0`.
   * @param query - Optional ISO date range.
   * @returns Structured line chart options (`kWh`), or a typed failure.
   */
  public async getEnergyReport(
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    return getHomeAtaEnergyReport(
      this.api,
      this.id,
      resolveHomeReportWindow(query, this.chartTimezone),
    )
  }

  /**
   * Fetches the hourly energy of this device as the normalized series:
   * each bucket's start as an epoch-ms instant, its consumption in
   * kilowatt-hours (the wire's watt-hours, scaled here), oldest first.
   * Hour buckets are the finest grain the wire serves, on the UTC
   * clock; the hour in progress is there and moves in the counter's
   * 100 Wh steps. A garbled sample degrades field-by-field to `null` —
   * never `NaN`, never a throw — and keeps its entry.
   * @param query - Read window.
   * @returns The normalized series, or a typed failure.
   */
  public async getEnergySeries(
    query: HomeEnergySeriesQuery,
  ): Promise<Result<HomeEnergySeries>> {
    return getHomeAtaEnergySeries(this.api, this.id, query)
  }

  /**
   * Read this device's current state projected as a Classic group state,
   * treating the device as a group of one: MELCloud Home has no group
   * endpoint, so the already-synced values are reused with no wire call.
   * @returns A success result wrapping the device's group state.
   */
  public async getGroup(): Promise<Result<ClassicGroupState>> {
    const source = await resolved(this)
    return ok(toClassicAtaGroupState(source))
  }

  /**
   * Member operation modes in the one group vocabulary, treating the
   * device as a group of one — the same read every zone facade answers,
   * projected through the operation-mode bijection with no wire call.
   * @param options - Member filter.
   * @param options.poweredOnly - `true` answers empty when the unit is
   * powered off.
   * @returns The device's own mode (Classic-numbered), alone or absent.
   */
  public getMemberOperationModes({
    poweredOnly: isPoweredOnly,
  }: {
    poweredOnly: boolean
  }): ClassicOperationMode[] {
    return homeGroupMemberModes([this], isPoweredOnly)
  }

  /**
   * Setpoint bounds enforced for an operation mode — the cross-dialect
   * read: a caller needs no knowledge of which API backs the device.
   * @param mode - Operation mode to resolve; defaults to the active one.
   * @returns The interval, or `null` for a mode outside the known
   * vocabulary (the setpoint then goes unclamped).
   */
  public getTemperatureRange(
    mode: ClassicOperationMode | HomeOperationMode = this.operationMode,
  ): TemperatureRange | null {
    return rangeForHomeMode(
      toBounds(this.capabilities),
      typeof mode === 'number' ? operationModeFromClassic[mode] : mode,
    )
  }

  /**
   * Fetches the temperature history as line chart data (trend-summary
   * report resampled on a regular grid) — the Home counterpart of the
   * Classic `getTemperatures` contract.
   * @param query - Optional ISO date range.
   * @returns Structured line chart options (`°C`), or a typed failure.
   */
  public async getTemperatures(
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    return this.fetchResampledChart(
      async (params) => this.api.getTemperatures(this.id, params),
      query,
    )
  }

  /**
   * Apply a Classic group state to this device: the delta is translated to
   * the Home vocabulary and pushed through the native per-device update
   * path. An all-null delta translates to nothing and resolves without a
   * wire call; any other delta is PUT, even one the device already holds —
   * Home's update refuses only a payload with no defined value, and that
   * `NoChangesError` counts as success.
   * @param state - Partial Classic group state to push to the device.
   */
  public async updateGroupState(state: ClassicGroupState): Promise<void> {
    const values = toHomeAtaValues(state)
    if (Object.keys(values).length > 0) {
      await tolerateNoChanges(async () => this.updateValues(values))
    }
  }

  /**
   * Pushes a partial ATA setpoint update — the base pipeline narrowed
   * to the ATA payload, with `setTemperature` clamped to the active
   * mode's bounds.
   * @param values - Partial setpoint payload.
   * @throws A {@link NoChangesError} when `values` carries no defined value.
   */
  public override async updateValues(values: HomeAtaValues): Promise<void> {
    await super.updateValues(values)
  }

  protected override clampValues({
    operationMode,
    setTemperature: value,
  }: HomeAtaValues): { setTemperature?: number } {
    if (value === undefined || value === null) {
      return {}
    }
    const rounded = roundToStep(value, this.temperatureStep)
    const range = this.getTemperatureRange(operationMode ?? this.operationMode)
    return {
      setTemperature: range === null ? rounded : clampToRange(rounded, range),
    }
  }

  // Typed reads of the enum-backed settings. The overloads deliberately
  // pass unknown wire values through (no validation, no degradation):
  // the setpoint clamp falls back to no-clamp on out-of-vocabulary
  // modes, and inventing a member here would silently clamp with the
  // wrong range.
  #enumSetting(name: 'OperationMode'): HomeOperationMode

  #enumSetting(name: 'VaneHorizontalDirection'): HomeHorizontal

  #enumSetting(name: 'VaneVerticalDirection'): HomeVertical

  #enumSetting(name: string): unknown {
    return this.setting(name)
  }
}
