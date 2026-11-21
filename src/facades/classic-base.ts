import type {
  ClassicAPIAdapter,
  ClassicErrorLog,
  ClassicErrorLogQuery,
} from '../api/index.ts'
import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicDeviceAny,
  ClassicModel,
  ClassicRegistry,
} from '../entities/index.ts'
import type { HolidayModeState, HolidayModeUpdate } from '../holiday-mode.ts'
import {
  classicUpdateDevices,
  fetchDevices,
  syncDevices,
} from '../decorators/index.ts'
import {
  assertUpdateAccepted,
  EntityNotFoundError,
  UpdateRejectedError,
} from '../errors/index.ts'
import {
  type ProtectionState,
  type ProtectionUpdate,
  clampFrostProtection,
} from '../protection.ts'
import { Temporal } from '../temporal.ts'
import {
  type ApiRequestError,
  type ClassicDateTimeComponents,
  type ClassicDeviceID,
  type ClassicFrostProtectionData,
  type ClassicFrostProtectionLocation,
  type ClassicHolidayModeData,
  type ClassicHolidayModeLocation,
  type ClassicHolidayModeTimeZone,
  type ClassicSettingsParams,
  type ClassicTilesData,
  type Hour,
  type Result,
  mapResult,
} from '../types/index.ts'
import {
  getChartLineOptions,
  hoursUpTo,
  mergeHourlyChartResults,
  padHourlyChartToMidnight,
  toUtcWallClock,
  toZonedWallClock,
  withMinuteClockLabels,
} from '../utils.ts'
import { HourSchema, parseOrThrow } from '../validation/index.ts'
import type { ClassicFacade } from './classic-types.ts'
import type { ReportChartLineOptions } from './report-types.ts'

// Wire-to-contract read mappers: `*Defined: false` marks a feature the
// account never configured, surfaced as `null` on the neutral state.
const toProtectionState = (
  data: ClassicFrostProtectionData,
): ProtectionState | null =>
  data.FPDefined
    ? {
        isEnabled: data.FPEnabled,
        max: data.FPMaxTemperature,
        min: data.FPMinTemperature,
      }
    : null

// The wire stores UTC wall clock (its `TimeZone` field is a location
// list, not a projection): both bounds come back projected onto the
// caller's clock, `null` staying the wire's unset marker.
const toHolidayModeState = (
  data: ClassicHolidayModeData,
  timeZone?: string,
): HolidayModeState | null =>
  data.HMDefined
    ? {
        endDate:
          data.HMEndDate === null
            ? null
            : toZonedWallClock(data.HMEndDate, timeZone),
        isEnabled: data.HMEnabled,
        startDate:
          data.HMStartDate === null
            ? null
            : toZonedWallClock(data.HMStartDate, timeZone),
      }
    : null

// Settings can be defined at zone or device level, and the wire's
// `FPDefined`/`HMDefined` are DECLARATIONS, not guarantees: a promised
// zone level can still refuse the read (measured on a shared building,
// 2026-08-26 — zone-level `GetSettings` answers 401 while the session
// is valid). A `true` or unknown flag therefore reads zone-first with
// a device-level fallback on failure — the original 2024 try/catch
// design, restored after a 2026-03 refactor had gated it on the flag
// being unknown. The `false` side carries NO mirror fallback, on two
// grounds: no device-level refusal has ever been observed, and a zone
// answer for a building the flag excludes reads as "never configured"
// (`ok(null)`) — masking a real device-level failure with a wrong
// answer is worse than surfacing it.
const getWithZoneFallback = async <TResult>(
  isAtZoneLevel: boolean | null,
  zoneGetter: () => Promise<Result<TResult>>,
  deviceGetter: () => Promise<Result<TResult>>,
): Promise<Result<TResult>> => {
  if (isAtZoneLevel === false) {
    return deviceGetter()
  }
  const zoneResult = await zoneGetter()
  return zoneResult.ok ? zoneResult : deviceGetter()
}

// Mutation prep paths (`#getFrostProtectionLocation`,
// `#getHolidayModeLocation`) cannot proceed without a resolved
// location, so a `!ok` result must surface as a throw. Preserves the
// original `cause` when one is available so the caller sees the
// underlying transport error class; otherwise synthesises a labeled
// `Error` from the kind.
const throwLocationError = (error: ApiRequestError): never => {
  if ('cause' in error && error.cause instanceof Error) {
    throw error.cause
  }
  throw new Error(`Could not resolve location: ${error.kind}`)
}

const getDateTimeComponents = (
  date: Temporal.PlainDateTime | null,
): ClassicDateTimeComponents =>
  date === null
    ? null
    : {
        Day: date.day,
        Hour: date.hour,
        Minute: date.minute,
        Month: date.month,
        Second: date.second,
        Year: date.year,
      }

/**
 * Abstract base for all facades. Provides common functionality for frost
 * protection, holiday mode, power control, signal strength, tiles, and error
 * log retrieval. Settings resolution falls back from zone level to device level
 * when needed.
 * @template T - Model class backing this facade, resolved from the registry
 * by id.
 */
export abstract class ClassicBaseFacade<
  T extends ClassicModel,
> implements ClassicFacade {
  protected abstract readonly frostProtectionLocation: keyof ClassicFrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof ClassicHolidayModeLocation

  protected abstract readonly model: { getById: (id: number) => T | undefined }

  protected abstract readonly tableName: ClassicSettingsParams['tableName']

  public abstract get devices(): ClassicDeviceAny[]

  public readonly id: T['id']

  /**
   * Whether the underlying entity still exists in the registry.
   * Non-throwing introspection: returns `false` instead of throwing
   * {@link EntityNotFoundError} when the registry no longer holds the id.
   * Useful for consumers that maintain a cached facade reference and
   * want to detect staleness without a `try/catch`.
   * @returns `true` when the entity is still resolvable, `false` otherwise.
   */
  public get exists(): boolean {
    return this.model.getById(this.id) !== undefined
  }

  /**
   * Display name of the underlying entity at the time of the last sync.
   * @returns The entity's name.
   */
  public get name(): string {
    return this.instance.name
  }

  protected readonly api: ClassicAPIAdapter

  protected isFrostProtectionAtZoneLevel: boolean | null = null

  protected isHolidayModeAtZoneLevel: boolean | null = null

  protected get instance(): T {
    const instance = this.model.getById(this.id)
    if (instance === undefined) {
      throw new EntityNotFoundError(this.tableName, { entityId: this.id })
    }
    return instance
  }

  // The adapter's own registry: a facade reads the one its client syncs,
  // as the Home facades do, so no caller can pair it with a foreign one.
  protected get registry(): ClassicRegistry {
    return this.api.registry
  }

  // One device stands for the zone when its settings live at device
  // level. A sample, not the zone's state: the units of one building
  // can hold different settings (live-probed 2026-11-21, CLAUDE.md),
  // though every building measured read the same either way.
  get #anyDeviceId(): ClassicDeviceID {
    const [id] = this.#deviceIds
    if (id === undefined) {
      throw new Error(
        `No device found for ${this.tableName} with id ${String(this.id)}`,
      )
    }
    return id
  }

  get #deviceIds(): ClassicDeviceID[] {
    return this.devices.map(({ id }) => id)
  }

  get #deviceNames(): string[] {
    return this.devices.map(({ name }) => name)
  }

  /**
   * Binds the facade to the client it reads and writes through, and
   * keeps the model's id rather than the model: each access resolves
   * the model again from the registry, so the facade follows it across
   * syncs and notices when it is gone.
   * @param api - Classic API client the facade calls through.
   * @param instance - Registry model the facade stands for.
   */
  public constructor(api: ClassicAPIAdapter, instance: T) {
    this.api = api
    this.id = instance.id
  }

  // Uses `@fetchDevices({ refresh, when: 'after' })` rather than
  // `@syncDevices()` because the update response is a success/failure envelope
  // with no device payload — notifying onSync without a genuine registry
  // refresh would be a stale signal. The trade-off: onSync now fires from
  // `api.fetch()` at the API level, carrying `{ type }` only — not the facade's
  // `{ ids, type }` shape with specific device ids. Consumers listening to
  // onSync should treat any call as "registry changed, re-inspect" rather than
  // keying on the payload. Same applies to updateHolidayMode below.
  /**
   * Updates the frost-protection settings of everything this facade
   * covers. The bounds are first clamped into the range the units
   * accept, the gap they require kept between them; the write then
   * addresses the level the settings live at: the facade's own, or
   * its devices. A level not known yet is read first, and that read's
   * failure is thrown. The registry is refreshed once MELCloud has
   * accepted the update.
   * @param update - Settings to apply.
   * @param update.isEnabled - Whether the protection is on.
   * @param update.max - Requested upper bound, in °C.
   * @param update.min - Requested lower bound, in °C.
   * @throws An {@link UpdateRejectedError} when MELCloud refuses the
   * settings.
   */
  @fetchDevices({
    when: 'after',
    refresh: async (self: ClassicBaseFacade<T>) => self.api.fetch(),
  })
  public async updateFrostProtection({
    isEnabled,
    max,
    min,
  }: ProtectionUpdate): Promise<void> {
    const { max: newMax, min: newMin } = clampFrostProtection(min, max)
    assertUpdateAccepted(
      await this.api.updateFrostProtection({
        postData: {
          Enabled: isEnabled,
          MaximumTemperature: newMax,
          MinimumTemperature: newMin,
          ...(await this.#getFrostProtectionLocation()),
        },
      }),
    )
  }

  /**
   * Turns holiday mode on over a window, or off, for everything this
   * facade covers. The window is given on the caller's wall clock
   * (`api.timezone`, the host's zone when unset) and projected onto
   * the UTC wall clock the wire stores — before any request, so a
   * malformed date throws without one; turning the mode off clears
   * both dates. The write addresses the level the settings live at,
   * read first when not yet known, and the registry is refreshed once
   * MELCloud has accepted the update.
   * @param update - Window to apply.
   * @param update.endDate - Window end; unused when turning the mode
   * off.
   * @param update.isEnabled - Whether holiday mode is on.
   * @param update.startDate - Window start; unused when turning the
   * mode off.
   * @throws An {@link UpdateRejectedError} when MELCloud refuses the
   * window.
   */
  @fetchDevices({
    when: 'after',
    refresh: async (self: ClassicBaseFacade<T>) => self.api.fetch(),
  })
  public async updateHolidayMode({
    endDate,
    isEnabled,
    startDate,
  }: HolidayModeUpdate): Promise<void> {
    // Project the window before the location fetch so malformed dates
    // throw ahead of any I/O; dates are cleared when disabling. The
    // caller speaks its own wall clock (`api.timezone`), the wire
    // stores UTC — the projection this path once had (7ba6364f) and
    // lost (b7286303), stranding every window by the caller's offset.
    const start = isEnabled
      ? toUtcWallClock(startDate, this.api.timezone)
      : null
    const end = isEnabled ? toUtcWallClock(endDate, this.api.timezone) : null
    assertUpdateAccepted(
      await this.api.updateHolidayMode({
        postData: {
          Enabled: isEnabled,
          EndDate: getDateTimeComponents(end),
          HMTimeZones: await this.#getHolidayModeLocation(),
          StartDate: getDateTimeComponents(start),
        },
      }),
    )
  }

  /**
   * Turns every device this facade covers on or off. Once MELCloud
   * has acknowledged the command, the registry models take the new
   * power state and the sync notification fires.
   * @param isOn - `true` to power on, `false` to power off.
   * @throws An {@link UpdateRejectedError} when MELCloud declines the
   * command: its bare `false` is folded into the rejection every
   * other mutation raises.
   */
  @syncDevices()
  @classicUpdateDevices({ kind: 'power' })
  public async updatePower(isOn = true): Promise<void> {
    // The power endpoint acks with a bare boolean instead of the
    // Success/AttributeErrors envelope; a `false` folds into the same
    // rejection contract as every other mutation.
    if (
      !(await this.api.updatePower({
        postData: { DeviceIds: this.#deviceIds, Power: isOn },
      }))
    ) {
      throw new UpdateRejectedError({
        Power: ['MELCloud declined the power command'],
      })
    }
  }

  /**
   * Reads one page of the error log of the devices this facade
   * covers.
   * @param query - Page window: its dates, period and offset.
   * @returns The parsed page, or a typed failure.
   */
  public async getErrorLog(
    query: ClassicErrorLogQuery,
  ): Promise<Result<ClassicErrorLog>> {
    return this.api.getErrorLog(query, this.#deviceIds)
  }

  /**
   * Reads the frost-protection settings. They are asked at the
   * facade's own level first, then through one of its devices when
   * that read fails; a facade whose level is known to hold none reads
   * through a device only. That device stands for the others, which
   * may hold settings of their own. The level that answers is
   * remembered, and is the one a write then addresses.
   * @returns The settings, `null` when never configured, or a typed
   * failure.
   * @throws An `Error` when the read has to go through a device and
   * the facade covers none.
   */
  public async getFrostProtection(): Promise<Result<ProtectionState | null>> {
    return mapResult(
      await getWithZoneFallback(
        this.isFrostProtectionAtZoneLevel,
        async () =>
          this.#getBaseFrostProtection({
            id: this.id,
            tableName: this.tableName,
          }),
        async () =>
          this.#getBaseFrostProtection(
            { id: this.#anyDeviceId, tableName: 'DeviceLocation' },
            false,
          ),
      ),
      toProtectionState,
    )
  }

  /**
   * Reads the holiday-mode window, level by level like
   * {@link getFrostProtection}. Both bounds come back projected from
   * the UTC wall clock the wire stores onto the caller's
   * (`api.timezone`, the host's zone when unset).
   * @returns The window, `null` when never configured, or a typed
   * failure.
   * @throws An `Error` when the read has to go through a device and
   * the facade covers none.
   */
  public async getHolidayMode(): Promise<Result<HolidayModeState | null>> {
    return mapResult(
      await getWithZoneFallback(
        this.isHolidayModeAtZoneLevel,
        async () =>
          this.#getBaseHolidayMode({ id: this.id, tableName: this.tableName }),
        async () =>
          this.#getBaseHolidayMode(
            { id: this.#anyDeviceId, tableName: 'DeviceLocation' },
            false,
          ),
      ),
      (data) => toHolidayModeState(data, this.api.timezone),
    )
  }

  /**
   * Charts the Wi-Fi signal strength of the devices this facade
   * covers, in dBm, one series per device: the given hour of today,
   * or every hour of today so far when none is given — the hours
   * still to come padded blank, so the axis spans the whole day.
   * @param hour - Hour of today to chart alone.
   * @returns The line chart options, or a typed failure.
   */
  public async getSignalStrength(
    hour?: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    return this.fetchHourlyDayChart(
      async (hourOfDay) => this.#fetchSignalHour(hourOfDay),
      hour,
    )
  }

  /**
   * Fetches dashboard tile data for the zone's devices; passing one of
   * them pins the response to its full `SelectedDevice` payload.
   * @param device - Optional device to pin as `SelectedDevice`.
   * @returns The tile data, or a typed failure.
   */
  public async getTiles(
    device: false | ClassicDeviceAny = false,
  ): Promise<Result<ClassicTilesData>> {
    const deviceIds = this.#deviceIds
    return this.api.getTiles({
      postData:
        device === false || !deviceIds.includes(device.id)
          ? { DeviceIDs: deviceIds }
          : {
              DeviceIDs: deviceIds,
              SelectedBuilding: device.buildingId,
              SelectedDevice: device.id,
            },
    })
  }

  /**
   * Forwards a sync notification to the client's `onSyncComplete`
   * observer, adding the ids of the devices this facade covers. The
   * `@syncDevices` decorator calls it once the method it wraps has
   * resolved.
   * @param params - What the sync was scoped to.
   * @param params.type - Device type the sync was restricted to, if
   * any.
   */
  public async notifySync({
    type,
  }: { type?: ClassicDeviceType | undefined } = {}): Promise<void> {
    await this.api.notifySync({ ids: this.#deviceIds, type })
  }

  /**
   * Current hour in the Classic-configured timezone (falls back to the
   * host's timezone when none was configured). Shared by the hour
   * defaults of {@link getSignalStrength} and (device facades')
   * `getHourlyTemperatures` so report defaults align with the Classic
   * deployment instead of the host runtime.
   * @returns The current hour as a valid {@link Hour}.
   */
  protected currentHour(): Hour {
    return parseOrThrow(
      HourSchema,
      Temporal.Now.plainTimeISO(this.api.timezone).hour,
      'currentHour',
    )
  }

  /**
   * Hour-by-hour fan-out shared by the hourly report defaults
   * ({@link getSignalStrength} and the device facades'
   * `getHourlyTemperatures`): a given hour fetches that single window;
   * no hour walks the whole of today — the wire only speaks one-hour
   * windows — and the not-yet-elapsed hours pad blank so the axis
   * spans the whole day.
   * @param fetchHour - Fetches one one-hour window.
   * @param hour - Optional single hour to fetch.
   * @returns Merged chart options for the requested window(s).
   */
  protected async fetchHourlyDayChart(
    fetchHour: (hour: Hour) => Promise<Result<ReportChartLineOptions>>,
    hour?: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    if (hour !== undefined) {
      return fetchHour(hour)
    }
    const currentHour = this.currentHour()
    const hourly = await Promise.all(
      hoursUpTo(currentHour).map(async (hourOfDay) => fetchHour(hourOfDay)),
    )
    return mapResult(mergeHourlyChartResults(hourly), (options) =>
      padHourlyChartToMidnight(options, {
        afterHour: currentHour,
        locale: this.api.locale,
      }),
    )
  }

  async #fetchSignalHour(hour: Hour): Promise<Result<ReportChartLineOptions>> {
    return mapResult(
      await this.api.getSignal({
        postData: { devices: this.#deviceIds, hour },
      }),
      (data) =>
        withMinuteClockLabels(
          getChartLineOptions(data, {
            legend: this.#deviceNames,
            locale: this.api.locale,
            unit: 'dBm',
          }),
          { hour, locale: this.api.locale },
        ),
    )
  }

  async #getBaseFrostProtection(
    params: ClassicSettingsParams,
    isDefined = true,
  ): Promise<Result<ClassicFrostProtectionData>> {
    const result = await this.api.getFrostProtection({ params })
    if (result.ok) {
      this.isFrostProtectionAtZoneLevel = isDefined
    }
    return result
  }

  async #getBaseHolidayMode(
    params: ClassicSettingsParams,
    isDefined = true,
  ): Promise<Result<ClassicHolidayModeData>> {
    const result = await this.api.getHolidayMode({ params })
    if (result.ok) {
      this.isHolidayModeAtZoneLevel = isDefined
    }
    return result
  }

  async #getFrostProtectionLocation(): Promise<ClassicFrostProtectionLocation> {
    if (this.isFrostProtectionAtZoneLevel === null) {
      // Mutations need a concrete location; surface fetch failure as throw.
      const result = await this.getFrostProtection()
      if (!result.ok) {
        throwLocationError(result.error)
      }
    }
    return this.isFrostProtectionAtZoneLevel === true
      ? { [this.frostProtectionLocation]: [this.id] }
      : { DeviceIds: this.#deviceIds }
  }

  async #getHolidayModeLocation(): Promise<ClassicHolidayModeTimeZone[]> {
    if (this.isHolidayModeAtZoneLevel === null) {
      const result = await this.getHolidayMode()
      if (!result.ok) {
        throwLocationError(result.error)
      }
    }
    return [
      this.isHolidayModeAtZoneLevel === true
        ? { [this.holidayModeLocation]: [this.id] }
        : { Devices: this.#deviceIds },
    ]
  }
}
