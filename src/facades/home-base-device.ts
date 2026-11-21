import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type { ErrorLogEntry } from '../error-log.ts'
import type { HolidayModeState, HolidayModeUpdate } from '../holiday-mode.ts'
import type { ProtectionState, ProtectionUpdate } from '../protection.ts'
import { HomeDeviceType } from '../constants.ts'
import {
  type AvailabilityAware,
  type FaultAware,
  type Identifiable,
  hasOutlivedStaleWindow,
} from '../entities/types.ts'
import { EntityNotFoundError, NoChangesError } from '../errors/index.ts'
import {
  type HomeDeviceData,
  type HomeDeviceValues,
  type HomeEnergyData,
  type HomeFrostProtection,
  type HomeHolidayMode,
  type HomeOverheatProtection,
  type HomeProtectionUnits,
  type HomeReportData,
  type Hour,
  type Result,
  err,
  mapResult,
  ok,
} from '../types/index.ts'
import {
  omitUndefined,
  resolved,
  toEpochMs,
  toZonedWallClock,
} from '../utils.ts'
import type { ReportChartLineOptions, ReportQuery } from './report-types.ts'
import {
  pushHomeFrostProtection,
  pushHomeHolidayMode,
  pushHomeOverheatProtection,
} from './home-protection.ts'
import {
  fetchHomeReportChunks,
  resolveHomeFineWindow,
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

/**
 * Maps a Home `/context` holiday descriptor onto the cross-dialect read
 * state; `null` (never configured) passes through. The wire holds a
 * window on its unit's own wall clock (CLAUDE.md, the holiday-window
 * entry, has the measures), and both bounds come back projected onto
 * the caller's; one in the hour that clock repeats reads as its first
 * pass, the wire's zoneless bound telling neither.
 * @param holidayMode - Wire descriptor, or `null`.
 * @param zones - The two clocks.
 * @param zones.from - The unit's IANA timezone, off its `/context` entry.
 * @param zones.to - The caller's IANA timezone; host zone when omitted.
 * @returns The neutral holiday-mode state, or `null`.
 */
export const toHolidayModeState = (
  holidayMode: HomeHolidayMode | null,
  zones: { from: string; to?: string | undefined },
): HolidayModeState | null =>
  holidayMode === null
    ? null
    : {
        endDate: toZonedWallClock(holidayMode.endDate, zones),
        isEnabled: holidayMode.enabled,
        startDate: toZonedWallClock(holidayMode.startDate, zones),
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
  implements AvailabilityAware, FaultAware, Identifiable<string>
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
   * The unit's own fault as `/context` words it: the code its `ErrorCode`
   * setting carries (`E6`) while the unit reports one — Home gives the
   * code alone, where Classic's `ErrorMessages` adds a sentence — and
   * `null` while there is none, whatever that setting reads then
   * (live-read 2026-11-18 on a unit in `E6`: the settings array carried
   * `IsInError: True` and `ErrorCode: E6`).
   * @returns The trimmed fault code, or `null`.
   */
  public get errorMessage(): string | null {
    const code = this.isInError ? this.setting('ErrorCode').trim() : ''
    return code === '' ? null : code
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
      disconnectedSince === null || !hasOutlivedStaleWindow(disconnectedSince)
    )
  }

  /**
   * The RAW `/context` `isConnected` flag, as the wire read it on the
   * latest sync — exposed for comparison with what the official app
   * shows, never as availability. Its positive side is live-probed
   * (12/12 `true` on healthy units); its negative side is unproven, and
   * a flag that flapped would grey a tile on every flap, which is why
   * {@link isAvailable} — the contract consumers must act on — only
   * flips after a day of continuous `false`. Independent of the streak:
   * a unit one minute into a disconnection reads `isConnected: false`
   * and `isAvailable: true` at once.
   * @returns The wire flag, verbatim.
   */
  public get isConnected(): boolean {
    return this.model.data.isConnected
  }

  /**
   * Whether the unit itself reports a fault — the `/context` `isInError`
   * flag, which MELCloud relays from the unit.
   * @returns `true` while the unit reports a fault of its own.
   */
  public get isInError(): boolean {
    return this.model.data.isInError
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

  /**
   * Whether this device can hold an overheat protection — the feature
   * is ATA-only (the official app never offers it on ATW units).
   * @returns `true` on ATA devices.
   */
  public get supportsOverheat(): boolean {
    return this.type === HomeDeviceType.Ata
  }

  protected readonly api: HomeAPIAdapter

  /**
   * IANA timezone anchoring chart windows and labels, from the API
   * configuration; nothing on the wire is read with it, each endpoint
   * family having a clock of its own.
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
   * @throws An {@link EntityNotFoundError} when the registry no longer
   * holds the id.
   */
  protected get model(): HomeDevice<TData> {
    const model = this.api.registry.getById(this.#id)
    if (model === undefined) {
      throw new EntityNotFoundError('Device', { entityId: this.#id })
    }
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion --
       the id was minted from a TData-shaped model and a physical device never
       changes type */
    return model as HomeDevice<TData>
  }

  /**
   * This device as a wire unit bucket, keyed by its connection type.
   * @returns The single-id bucket the batch endpoints accept.
   */
  protected get ownUnits(): HomeProtectionUnits {
    return this.type === HomeDeviceType.Ata
      ? { ATA: [this.id] }
      : { ATW: [this.id] }
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
   * Per-type setpoint clamp: maps the defined setpoint fields of an
   * update onto their clamped values, leaving every other field alone.
   * @param changes - Defined update fields.
   * @returns The clamped setpoint fields to overlay on the update.
   */
  protected abstract clampValues(
    changes: HomeDeviceValues,
  ): Partial<HomeDeviceValues>

  /**
   * Fetches the error-log entries for this device, projected onto the
   * cross-dialect shape: `errorCode` maps to `code`, `errorReason` to
   * `message` when present, `clearedTimestamp` to `clearedAt` when
   * cleared — each wall-clock stamp paired with its UTC-anchored epoch
   * instant. The raw wire entries stay available on the API client.
   * @returns The neutral entries (possibly empty), or a typed failure.
   */
  public async getErrorLog(): Promise<Result<ErrorLogEntry[]>> {
    return mapResult(await this.api.getErrorLog(this.id), (entries) =>
      entries.map(
        ({
          clearedTimestamp,
          errorCode,
          errorReason,
          timestamp,
        }): ErrorLogEntry => ({
          at: timestamp,
          // The error log is read as UTC wall clock (CLAUDE.md, the
          // two-clocks entry, says what that rests on): both instants
          // anchor in UTC.
          atEpochMs: toEpochMs(timestamp, 'UTC'),
          code: errorCode,
          deviceId: this.id,
          ...(clearedTimestamp !== null && {
            clearedAt: clearedTimestamp,
            clearedAtEpochMs: toEpochMs(clearedTimestamp, 'UTC'),
          }),
          ...(errorReason !== null && { message: errorReason }),
        }),
      ),
    )
  }

  /**
   * Reads the current frost-protection settings — the cross-dialect
   * async contract shared with the Classic facades; the answer comes
   * from the synced `/context` model, no wire call.
   * @returns The protection state, or `null` when never configured.
   */
  public async getFrostProtection(): Promise<Result<ProtectionState | null>> {
    const { data } = await resolved(this.model)
    return ok(toHomeProtectionState(data.frostProtection))
  }

  /**
   * Reads the current holiday-mode window — the cross-dialect async
   * contract shared with the Classic facades; the answer comes from the
   * synced `/context` model, no wire call, both bounds projected from
   * the unit's clock onto the caller's.
   * @returns The holiday-mode state, or `null` when never configured.
   */
  public async getHolidayMode(): Promise<Result<HolidayModeState | null>> {
    const { data } = await resolved(this.model)
    return ok(
      toHolidayModeState(data.holidayMode, {
        from: data.timeZone,
        to: this.api.timezone,
      }),
    )
  }

  /**
   * Reads the current overheat-protection settings. The wire carries
   * the field on both types but only ATA units ever hold one (see
   * {@link supportsOverheat}): ATW units answer `null` like a
   * never-configured ATA unit — no type guard needed.
   * @returns The protection state, or `null` when never configured.
   */
  public async getOverheatProtection(): Promise<
    Result<ProtectionState | null>
  > {
    const { data } = await resolved(this.model)
    return ok(toHomeProtectionState(data.overheatProtection))
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
    const { cutoff, gridUnit, window } = resolveHomeFineWindow(
      hour,
      this.chartTimezone,
    )
    return mapResult(
      await this.api.getSignal(this.id, toHomeWireWindow(window)),
      (data) =>
        toHomeSignalOptions({
          cutoff,
          data,
          gridUnit,
          locale: this.api.locale,
          name: this.name,
          window,
        }),
    )
  }

  /**
   * Updates this device's frost protection — the cross-dialect write
   * contract shared with the Classic facades, bounds clamped into range.
   * @param update - The new frost-protection settings.
   */
  public async updateFrostProtection(update: ProtectionUpdate): Promise<void> {
    await pushHomeFrostProtection(this.api, this.ownUnits, update)
  }

  /**
   * Updates this device's holiday-mode window — the cross-dialect write
   * contract shared with the Classic facades; an enabled window goes
   * out on the unit's own clock, which the registry's model tells.
   * @param update - The new holiday-mode window.
   * @throws A {@link RangeError} when an enabled window is malformed or
   * ends before it can start on the unit's clock, an
   * {@link EntityNotFoundError} when it is enabled on a unit the
   * registry no longer holds; both before any request.
   */
  public async updateHolidayMode(update: HolidayModeUpdate): Promise<void> {
    await pushHomeHolidayMode(this.api, this.ownUnits, update)
  }

  /**
   * Updates this device's overheat protection. ATA-only on the wire:
   * on an ATW unit the write resolves without any wire call (the same
   * silent drop the batch write applies to ATW ids).
   * @param update - The new overheat-protection settings.
   */
  public async updateOverheatProtection(
    update: ProtectionUpdate,
  ): Promise<void> {
    await pushHomeOverheatProtection(this.api, this.ownUnits, update)
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
   * @throws A {@link NoChangesError} when `values` carries no defined value.
   */
  public async updateValues(values: HomeDeviceValues): Promise<void> {
    const changes = omitUndefined(values)
    if (Object.keys(changes).length === 0) {
      throw new NoChangesError(this.id)
    }
    await this.api.updateValues(this.id, {
      ...changes,
      ...this.clampValues(changes),
    })
  }

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
    return this.onUnitClock(async (zone) =>
      mapResult(await fetchHomeReportChunks(fetchChunks, window), (reports) =>
        toHomeLineOptions({
          locale: this.api.locale,
          reports,
          unit: TEMPERATURE_UNIT,
          window,
          zone,
        }),
      ),
    )
  }

  /**
   * Runs a read of a `/report/v1/*` endpoint: those speak the unit's
   * own clock, which only the registry's model tells. Such a read
   * answers `not-found` for an id the registry no longer holds, like
   * the reads the API client routes on the registry, where an accessor
   * throws.
   * @template T - Value the read answers.
   * @param read - The read, given the unit's IANA timezone.
   * @returns What the read answers, or the `not-found` failure.
   */
  protected async onUnitClock<T>(
    read: (zone: string) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    return this.exists
      ? read(this.model.data.timeZone)
      : err({ entityId: this.id, kind: 'not-found' })
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
