import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDeviceType } from '../constants.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type { HolidayModeState } from '../holiday-mode.ts'
import type { ProtectionState } from '../protection.ts'
import {
  type AvailabilityAware,
  type Identifiable,
  STALE_COMMUNICATION_HOURS,
} from '../entities/types.ts'
import { EntityNotFoundError, NoChangesError } from '../errors/index.ts'
import { Temporal } from '../temporal.ts'
import {
  type HomeAtwDeviceData,
  type HomeDeviceData,
  type HomeDeviceValues,
  type HomeEnergyData,
  type HomeErrorLogEntry,
  type HomeFrostProtection,
  type HomeHolidayMode,
  type HomeOverheatProtection,
  type HomeReportData,
  type Hour,
  type Result,
  mapResult,
} from '../types/index.ts'
import { omitUndefined, toZonedWallClock } from '../utils.ts'
import type { ReportChartLineOptions, ReportQuery } from './report-types.ts'
import {
  fetchHomeReportChunks,
  resolveHomeDayWindow,
  resolveHomeHourWindow,
  resolveHomeReportWindow,
  toHomeLineOptions,
  toHomeSignalOptions,
  toHomeWireWindow,
} from './home-report.ts'

/**
 * Chart unit of every Home temperature report.
 */
export const TEMPERATURE_UNIT = '°C'

/**
 * Per-type energy-telemetry query: the ATW interval measures split
 * consumed and produced (`measure` selects the direction, and only
 * exists there), while ATA has a single cumulative measure and no
 * direction to pick. `from` is inclusive, `to` exclusive (ISO
 * timestamps); `interval` speaks the wire's .NET enum — `Minute`,
 * `Hour`, `Day`, `Week` or `Month`.
 * @template TData - Wire-format device payload variant selecting the
 * query shape.
 * @category Facades
 */
export type HomeEnergyQuery<TData extends HomeDeviceData> =
  TData extends HomeAtwDeviceData
    ? {
        from: string
        interval: string
        measure: 'consumed' | 'produced'
        to: string
      }
    : { from: string; interval: string; to: string }

/**
 * Maps a Home `/context` protection descriptor onto the cross-dialect
 * read state; `null` (never configured) passes through.
 * @param protection - Wire descriptor, or `null`.
 * @returns The neutral protection state, or `null`.
 */
export const toHomeProtectionState = (
  protection: HomeFrostProtection | HomeOverheatProtection | null,
): ProtectionState | null =>
  protection === null
    ? null
    : {
        isEnabled: protection.enabled,
        max: protection.max,
        min: protection.min,
      }

// The Home wire speaks UTC wall clock everywhere (live-probed; see
// CLAUDE.md): both bounds come back projected onto the caller's clock.
const toHolidayModeState = (
  holidayMode: HomeHolidayMode | null,
  timeZone?: string,
): HolidayModeState | null =>
  holidayMode === null
    ? null
    : {
        endDate: toZonedWallClock(holidayMode.endDate, timeZone),
        isEnabled: holidayMode.enabled,
        startDate: toZonedWallClock(holidayMode.startDate, timeZone),
      }

/**
 * Shared scaffolding for every Home device facade. Holds the API
 * client + registry-resident model, exposes the common identity
 * getters (`id`, `name`, `rssi`) and the cross-type `getSignal`
 * passthrough, and provides the protected `setting()` lookup used by
 * both the ATA and ATW facade subclasses.
 *
 * `TData` narrows the wrapped device payload (e.g. `HomeAtaDeviceData`
 * for {@link HomeDeviceAtaFacade}) so subclasses see the device-type
 * specific shape on `model.data` without unsafe casts.
 *
 * The base carries everything the types share — identity, availability,
 * capabilities, power/standby, the telemetry passthroughs and the
 * update pipeline; only what genuinely diverges between ATA and ATW
 * (operation modes, setpoint vocabulary, report merging) lives in the
 * subclass, reached through hooks like `clampValues`.
 * @template TData - Wire-format device payload variant exposed on
 * `model.data`, narrowed to the device-type-specific shape by each subclass.
 * @category Facades
 */
export abstract class HomeBaseDeviceFacade<TData extends HomeDeviceData>
  implements AvailabilityAware, Identifiable<string>
{
  /**
   * Connection-type discriminator, captured at construction (a physical
   * device never changes type) so it stays readable on a pruned id —
   * the Home counterpart of the Classic facades' `type`.
   */
  public readonly type: HomeDeviceType

  /**
   * Static capability flags and ranges advertised by this device,
   * narrowed to the device-type shape by `TData`.
   * @returns The capability descriptor.
   */
  public get capabilities(): TData['capabilities'] {
    return this.model.data.capabilities
  }

  /**
   * Whether the underlying device still exists in the registry.
   * Non-throwing introspection mirroring the Classic facades' `exists`:
   * a consumer holding a cached facade can detect staleness without a
   * try/catch.
   * @returns `true` while the registry still resolves the id.
   */
  public get exists(): boolean {
    return this.api.registry.getById(this.#id) !== undefined
  }

  /**
   * Current frost-protection settings, or `null` when not configured.
   * @returns The cross-dialect protection state from `/context`.
   */
  public get frostProtection(): ProtectionState | null {
    return toHomeProtectionState(this.model.data.frostProtection)
  }

  /**
   * Current holiday-mode window, or `null` when not configured.
   * @returns The cross-dialect holiday-mode state from `/context`.
   */
  public get holidayMode(): HolidayModeState | null {
    return toHolidayModeState(this.model.data.holidayMode, this.api.timezone)
  }

  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The GUID string assigned by MELCloud Home.
   */
  public get id(): string {
    return this.#id
  }

  /**
   * Whether the unit is in standby (powered, but idle).
   * @returns `true` when on standby.
   */
  public get inStandbyMode(): boolean {
    return this.settingBool('InStandbyMode')
  }

  /**
   * Whether MELCloud can still deliver writes to the unit. `false`
   * means the wifi adapter lost its link to the cloud: writes are
   * accepted but never delivered, and readings go stale. The
   * `/context` `isConnected` flag only counts once it has read `false`
   * for a full day: its negative side is unproven, and the persistence
   * window makes a Classic-`Offline`-style tight-threshold boolean
   * harmless (such a flag never stays `false` through a report cycle).
   * @returns `false` after a day of continuous disconnection.
   */
  public get isAvailable(): boolean {
    const { disconnectedSince } = this.model
    return (
      disconnectedSince === null ||
      Temporal.Now.plainDateTimeISO('UTC')
        .since(disconnectedSince)
        .total('hours') <= STALE_COMMUNICATION_HOURS
    )
  }

  /**
   * Whether the current account owns this device rather than being a
   * guest of it. Reports the structural origin only: `false` does not
   * by itself prove a guest is barred from control (the BFF accepts
   * guest writes on shared units).
   * @returns `true` when owned, `false` when shared with this account.
   */
  public get isOwner(): boolean {
    return this.model.isOwner
  }

  /**
   * User-facing display name set in the MELCloud Home app.
   * @returns The device's display name.
   */
  public get name(): string {
    return this.model.name
  }

  /**
   * Whether the unit is powered on. Independent of standby: a unit in
   * standby is powered but idle.
   * @returns `true` when on, `false` when off.
   */
  public get power(): boolean {
    return this.settingBool('Power')
  }

  /**
   * Last-reported Wi-Fi signal strength of the device adapter, in dBm.
   * @returns The RSSI value.
   */
  public get rssi(): number {
    return this.model.data.rssi
  }

  protected readonly api: HomeAPIAdapter

  /**
   * IANA timezone anchoring chart windows and labels, from the API
   * configuration; the Home wire itself always speaks UTC wall-clock.
   * @returns The display timezone, UTC when unconfigured.
   */
  protected get chartTimezone(): string {
    return this.api.timezone ?? 'UTC'
  }

  /**
   * Registry-resident model resolved by id on every access, so a
   * long-lived facade never reads a pruned wrapper's frozen snapshot
   * (a logout/login cycle rebuilds the registry with new wrappers —
   * a pinned reference froze `isConnected` and kept a healed unit
   * unavailable forever).
   * @returns The current model for this facade's id.
   * @throws EntityNotFoundError when the registry no longer holds the id.
   */
  protected get model(): HomeDevice<TData> {
    const model = this.api.registry.getById(this.#id)
    if (model === undefined) {
      throw new EntityNotFoundError('Device', { entityId: this.#id })
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the id was minted from a TData-shaped model and a physical device never changes type
    return model as HomeDevice<TData>
  }

  readonly #id: string

  /**
   * Builds a Home device facade backed by the given API client and
   * registry-resident device model. Only the model's id is retained:
   * every later access re-resolves through the registry.
   * @param api - Home API client.
   * @param model - Backing device model, narrowed to a specific variant.
   */
  public constructor(api: HomeAPIAdapter, model: HomeDevice<TData>) {
    this.api = api
    this.#id = model.id
    this.type = model.type
  }

  /**
   * Fetches energy telemetry for this device over the given time
   * window — cumulative consumption on ATA units, one interval-measure
   * direction on ATW units (`measure` selects consumed or produced
   * there, and only there). See {@link HomeEnergyQuery} for the window
   * and interval semantics.
   * @param params - Query window and interval, plus the energy
   * direction on ATW.
   * @returns The telemetry bundle, or a typed failure.
   */
  public async getEnergy(
    params: HomeEnergyQuery<TData>,
  ): Promise<Result<HomeEnergyData>> {
    return this.api.getEnergy(this.id, params)
  }

  /**
   * Fetches the error-log entries for this device.
   * @returns The entries (possibly empty), or a typed failure.
   */
  public async getErrorLog(): Promise<Result<HomeErrorLogEntry[]>> {
    return this.api.getErrorLog(this.id)
  }

  /**
   * Fetches RSSI telemetry for this device over the given time window.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The telemetry bundle, or a typed failure.
   */
  public async getSignal(params: {
    from: string
    to: string
  }): Promise<Result<HomeEnergyData>> {
    return this.api.getSignal(this.id, params)
  }

  /**
   * Fetches the Wi-Fi signal chart — the whole of today on a
   * five-minute grid, or one specific hour on a minute grid. The Home
   * counterpart of the Classic `getSignalStrength` contract.
   * @param hour - Optional hour of today (0-23); omitted covers today.
   * @returns Structured line chart options (`dBm`), or a typed failure.
   */
  public async getSignalStrength(
    hour?: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    const { cutoff, window } =
      hour === undefined
        ? resolveHomeDayWindow(this.chartTimezone)
        : {
            cutoff: undefined,
            window: resolveHomeHourWindow(hour, this.chartTimezone),
          }
    return mapResult(
      await this.api.getSignal(this.id, toHomeWireWindow(window)),
      (data) =>
        toHomeSignalOptions({
          cutoff,
          data,
          gridUnit: hour === undefined ? 'fiveMinutes' : 'minute',
          locale: this.api.locale,
          name: this.name,
          window,
        }),
    )
  }

  /**
   * Powers the unit on or off. This is the unit-level master power (the
   * `Power` setting, shown as the system on/off toggle in the app),
   * defined at the base like the Classic side's `updatePower` — the
   * contracts differ: this one resolves `void` and throws the typed
   * transport error. Convenience wrapper over {@link updateValues}.
   * @param isOn - `true` to power on, `false` to power off.
   */
  public async updatePower(isOn = true): Promise<void> {
    await this.updateValues({ power: isOn })
  }

  /**
   * Pushes a partial update to the device; rejects when `values`
   * carries no defined value (an explicitly-`undefined` key counts as
   * absent), otherwise overlays the per-type `clampValues` hook's
   * clamped setpoints and forwards. Each subclass narrows the payload
   * to its device-type shape.
   * @param values - Partial update payload.
   * @throws NoChangesError when `values` carries no defined value.
   */
  public async updateValues(values: HomeDeviceValues): Promise<void> {
    const changes = omitUndefined(values)
    if (Object.keys(changes).length === 0) {
      throw new NoChangesError(this.id)
    }
    await this.api.updateValues(this.id, {
      ...changes,
      ...this.clampValues?.(changes),
    })
  }

  /**
   * Per-type setpoint clamp: maps the defined setpoint fields of an
   * update onto their clamped values, leaving every other field alone.
   * Left undeclared by a type with no bounds to enforce — the pipeline
   * then forwards the changes untouched (the optional-hook mirror of
   * the Classic side's `extractEnergyReport` null hook).
   * @param changes - Defined update fields.
   * @returns The clamped setpoint fields to overlay on the update.
   */
  protected clampValues?(changes: HomeDeviceValues): Partial<HomeDeviceValues>

  /**
   * Shared single-source chart pipeline: resolves the query window,
   * fetches the report in wire-sized chunks, and resamples the
   * irregular samples onto a regular grid as `°C` line-chart options.
   * @param fetchChunks - Wire read for one window chunk.
   * @param query - Optional ISO date range.
   * @returns Structured line chart options (`°C`), or a typed failure.
   */
  protected async fetchResampledChart(
    fetchChunks: (params: {
      from: string
      period: string
      to: string
    }) => Promise<Result<HomeReportData[]>>,
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    const window = resolveHomeReportWindow(query, this.chartTimezone)
    return mapResult(
      await fetchHomeReportChunks(fetchChunks, window),
      (reports) =>
        toHomeLineOptions({
          locale: this.api.locale,
          reports,
          unit: TEMPERATURE_UNIT,
          window,
        }),
    )
  }

  /**
   * Looks up a setting value by name from the device's settings array,
   * returning the empty string when the setting is absent. Subclasses
   * layer typed accessors on top.
   * @param name - Setting name (e.g. `'Power'`, `'OperationModeZone1'`).
   * @returns The setting value, or `''` when not present.
   */
  protected setting(name: string): string {
    return (
      this.model.data.settings.find((entry) => entry.name === name)?.value ?? ''
    )
  }

  /**
   * Reads a boolean device setting (the BFF serializes them as
   * `'True'`/`'False'` strings).
   * @param name - Setting name (e.g. `'Power'`).
   * @returns `true` when the wire value is the string `'True'`.
   */
  protected settingBool(name: string): boolean {
    return this.setting(name) === 'True'
  }

  /**
   * Reads a numeric device setting (the BFF serializes numbers as
   * strings). An absent setting reads `0` (`Number('')`).
   * @param name - Setting name (e.g. `'RoomTemperatureZone1'`).
   * @returns The wire string parsed as a number, `0` when absent.
   */
  protected settingNumber(name: string): number {
    return Number(this.setting(name))
  }
}
