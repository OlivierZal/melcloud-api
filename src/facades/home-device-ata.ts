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
  rangeForHomeMode,
} from '../temperature-range.ts'
import {
  type ClassicGroupState,
  type HomeAtaDeviceCapabilities,
  type HomeAtaDeviceData,
  type HomeAtaValues,
  type Result,
  mapResult,
  ok,
} from '../types/index.ts'
import { clampToRange, resolved } from '../utils.ts'
import type { ReportChartLineOptions, ReportQuery } from './report-types.ts'
import { toClassicAtaGroupState, toHomeAtaValues } from './home-ata-group.ts'
import { HomeBaseDeviceFacade } from './home-base-device.ts'
import {
  resolveHomeReportWindow,
  toHomeEnergyBucketUnit,
  toHomeEnergyInterval,
  toHomeEnergyOptions,
  toHomeWireWindow,
} from './home-report.ts'

// The ATA cumulative energy measure reports watt-hours (100 Wh pulses,
// live-probed 2026-07-18: a daily bucket of `571.0` for ~0.57 kWh).
const KILOWATT_HOURS_PER_WATT_HOUR = 0.001

// Half-degree units advertise it; the rest step by a whole degree.
const HALF_DEGREE_STEP = 0.5
const WHOLE_DEGREE_STEP = 1

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
    return this.capabilities.hasHalfDegreeIncrements
      ? HALF_DEGREE_STEP
      : WHOLE_DEGREE_STEP
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
   * Fetches the energy report as line chart data on a daily grid — the
   * Home counterpart of the Classic `getEnergyReport` contract. The
   * single ATA measure is cumulative consumption in watt-hours, scaled
   * to `kWh`; days the wire omits (idle) chart as `0`.
   * @param query - Optional ISO date range.
   * @returns Structured line chart options (`kWh`), or a typed failure.
   */
  public async getEnergyReport(
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    const window = resolveHomeReportWindow(query, this.chartTimezone)
    const bucketUnit = toHomeEnergyBucketUnit(window)
    return mapResult(
      await this.api.getEnergy(this.id, {
        ...toHomeWireWindow(window),
        interval: toHomeEnergyInterval(bucketUnit),
      }),
      (data) =>
        toHomeEnergyOptions({
          bucketUnit,
          locale: this.api.locale,
          sources: [
            { data, name: 'Consumed', scale: KILOWATT_HOURS_PER_WATT_HOUR },
          ],
          window,
        }),
    )
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
   * path. Group writes are no-op tolerant: an all-null delta translates to
   * nothing and resolves without a wire call, and a device already matching
   * the delta (a `NoChangesError` from its update) counts as success.
   * @param state - Partial Classic group state to push to the device.
   * @returns The zone-shaped success outcome once the write completes.
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
   * @throws NoChangesError when `values` carries no defined value.
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
    const range = this.getTemperatureRange(operationMode ?? this.operationMode)
    return {
      setTemperature: range === null ? value : clampToRange(value, range),
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
