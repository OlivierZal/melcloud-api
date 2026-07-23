import type {
  ClassicAPIAdapter,
  ClassicErrorLog,
  ClassicErrorLogQuery,
} from '../api/index.ts'
import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicDevice,
  ClassicDeviceAny,
  ClassicModel,
  ClassicRegistry,
} from '../entities/index.ts'
import type { HolidayModeUpdate } from '../holiday-mode.ts'
import {
  classicUpdateDevices,
  fetchDevices,
  syncDevices,
} from '../decorators/index.ts'
import { EntityNotFoundError } from '../errors/index.ts'
import { clampFrostProtection } from '../frost-protection.ts'
import { Temporal } from '../temporal.ts'
import {
  type ApiRequestError,
  type ClassicDateTimeComponents,
  type ClassicFailureData,
  type ClassicFrostProtectionData,
  type ClassicFrostProtectionLocation,
  type ClassicHolidayModeData,
  type ClassicHolidayModeLocation,
  type ClassicHolidayModeTimeZone,
  type ClassicSettingsParams,
  type ClassicSuccessData,
  type ClassicTilesData,
  type Hour,
  type Result,
  mapResult,
  toClassicDeviceId,
} from '../types/index.ts'
import {
  getChartLineOptions,
  hoursUpTo,
  mergeHourlyChartResults,
  padHourlyChartToMidnight,
  withMinuteClockLabels,
} from '../utils.ts'
import { HourSchema, parseOrThrow } from '../validation/index.ts'
import type {
  ClassicFacade,
  ClassicFrostProtectionQuery,
} from './classic-types.ts'
import type { ReportChartLineOptions } from './report-types.ts'

// Settings can be defined at zone or device level. Try zone first;
// if unsupported, fall back to device level and cache the result.
// Result-aware fallback: a `!ok` zone result triggers the device-level
// retry, mirroring the previous try/catch semantic without losing the
// typed-failure surface for the final outcome.
const getWithZoneFallback = async <TResult>(
  isAtZoneLevel: boolean | null,
  zoneGetter: () => Promise<Result<TResult>>,
  deviceGetter: () => Promise<Result<TResult>>,
): Promise<Result<TResult>> => {
  if (isAtZoneLevel === null) {
    const zoneResult = await zoneGetter()
    return zoneResult.ok ? zoneResult : deviceGetter()
  }
  return (isAtZoneLevel ? zoneGetter : deviceGetter)()
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
  date === null ? null : (
    {
      Day: date.day,
      Hour: date.hour,
      Minute: date.minute,
      Month: date.month,
      Second: date.second,
      Year: date.year,
    }
  )

/**
 * Abstract base for all facades. Provides common functionality for frost protection,
 * holiday mode, power control, signal strength, tiles, and error log retrieval.
 * Settings resolution falls back from zone level to device level when needed.
 * @template T - Model class backing this facade, resolved from the registry
 * by id.
 */
export abstract class ClassicBaseFacade<
  T extends ClassicModel,
> implements ClassicFacade {
  protected abstract readonly frostProtectionLocation: keyof ClassicFrostProtectionLocation

  protected abstract readonly holidayModeLocation: keyof ClassicHolidayModeLocation

  protected abstract readonly model: {
    getById: (id: number) => T | undefined
  }

  protected abstract readonly tableName: ClassicSettingsParams['tableName']

  public abstract get devices(): ClassicDeviceAny[]

  public readonly id: number

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

  protected readonly registry: ClassicRegistry

  protected get instance(): T {
    const instance = this.model.getById(this.id)
    if (instance === undefined) {
      throw new EntityNotFoundError(this.tableName, { entityId: this.id })
    }
    return instance
  }

  // Zone-level settings are shared across devices, so any device id samples the zone's state.
  get #anyDeviceId(): number {
    const [id] = this.#deviceIds
    if (id === undefined) {
      throw new Error(
        `No device found for ${this.tableName} with id ${String(this.id)}`,
      )
    }
    return id
  }

  get #deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  get #deviceNames(): string[] {
    return this.devices.map(({ name }) => name)
  }

  public constructor(
    api: ClassicAPIAdapter,
    registry: ClassicRegistry,
    instance: ClassicModel,
  ) {
    this.api = api
    this.registry = registry
    this.id = instance.id
  }

  // Uses `@fetchDevices({ when: 'after' })` rather than `@syncDevices()`
  // because the update response is a success/failure envelope with no
  // device payload — notifying onSync without a genuine registry
  // refresh would be a stale signal. The trade-off: onSync now fires
  // from `api.fetch()` at the API level, carrying `{ type }` only —
  // not the facade's `{ ids, type }` shape with specific device ids.
  // Consumers listening to onSync should treat any call as "registry
  // changed, re-inspect" rather than keying on the payload. Same
  // applies to updateHolidayMode below.
  @fetchDevices({ when: 'after' })
  public async updateFrostProtection({
    isEnabled = true,
    max,
    min,
  }: ClassicFrostProtectionQuery): Promise<
    ClassicFailureData | ClassicSuccessData
  > {
    const { max: newMax, min: newMin } = clampFrostProtection(min, max)
    return this.api.updateFrostProtection({
      postData: {
        Enabled: isEnabled,
        MaximumTemperature: newMax,
        MinimumTemperature: newMin,
        ...(await this.#getFrostProtectionLocation()),
      },
    })
  }

  @fetchDevices({ when: 'after' })
  public async updateHolidayMode({
    endDate,
    isEnabled,
    startDate,
  }: HolidayModeUpdate): Promise<ClassicFailureData | ClassicSuccessData> {
    // Parse the window before the location fetch so malformed dates throw
    // ahead of any I/O; dates are cleared when disabling.
    const start = isEnabled ? Temporal.PlainDateTime.from(startDate) : null
    const end = isEnabled ? Temporal.PlainDateTime.from(endDate) : null
    return this.api.updateHolidayMode({
      postData: {
        Enabled: isEnabled,
        EndDate: getDateTimeComponents(end),
        HMTimeZones: await this.#getHolidayModeLocation(),
        StartDate: getDateTimeComponents(start),
      },
    })
  }

  @syncDevices()
  @classicUpdateDevices({ kind: 'power' })
  public async updatePower(isOn = true): Promise<boolean> {
    return this.api.updatePower({
      postData: {
        DeviceIds: this.#deviceIds.map((id) => toClassicDeviceId(id)),
        Power: isOn,
      },
    })
  }

  public async getErrorLog(
    query: ClassicErrorLogQuery,
  ): Promise<Result<ClassicErrorLog>> {
    return this.api.getErrorLog(query, this.#deviceIds)
  }

  public async getFrostProtection(): Promise<
    Result<ClassicFrostProtectionData>
  > {
    return getWithZoneFallback(
      this.isFrostProtectionAtZoneLevel,
      async () => this.#getZoneFrostProtection(),
      async () => this.#getDevicesFrostProtection(),
    )
  }

  public async getHolidayMode(): Promise<Result<ClassicHolidayModeData>> {
    return getWithZoneFallback(
      this.isHolidayModeAtZoneLevel,
      async () => this.#getZoneHolidayMode(),
      async () => this.#getDevicesHolidayMode(),
    )
  }

  public async getSignalStrength(
    hour?: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    if (hour !== undefined) {
      return this.#fetchSignalHour(hour)
    }
    // No hour: the whole of today, hour by hour — the wire only speaks
    // one-hour windows; the not-yet-elapsed hours pad blank so the axis
    // spans the whole day.
    const currentHour = this.currentHour()
    const hourly = await Promise.all(
      hoursUpTo(currentHour).map(async (hourOfDay) =>
        this.#fetchSignalHour(hourOfDay),
      ),
    )
    return mapResult(mergeHourlyChartResults(hourly), (options) =>
      padHourlyChartToMidnight(options, {
        afterHour: currentHour,
        locale: this.api.locale,
      }),
    )
  }

  /**
   * Fetches dashboard tile data for the zone's devices; passing a specific
   * device pins the response to its full `SelectedDevice` payload.
   * @param device - Optional device to pin as `SelectedDevice`.
   * @returns The tile data, or a typed failure.
   */
  public async getTiles(device?: false): Promise<Result<ClassicTilesData<null>>>
  public async getTiles<TDeviceType extends ClassicDeviceType>(
    device: ClassicDevice<TDeviceType>,
  ): Promise<Result<ClassicTilesData<TDeviceType>>>
  public async getTiles<TDeviceType extends ClassicDeviceType>(
    device: false | ClassicDevice<TDeviceType> = false,
  ): Promise<Result<ClassicTilesData<TDeviceType | null>>> {
    const postData = {
      DeviceIDs: this.#deviceIds.map((id) => toClassicDeviceId(id)),
    }
    if (device === false || !this.#deviceIds.includes(device.id)) {
      return this.api.getTiles({ postData })
    }
    return mapResult(
      await this.api.getTiles({
        postData: {
          ...postData,
          SelectedBuilding: device.buildingId,
          SelectedDevice: device.id,
        },
      }),
      (data) => data as ClassicTilesData<TDeviceType>,
    )
  }

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

  async #getDevicesFrostProtection(): Promise<
    Result<ClassicFrostProtectionData>
  > {
    return this.#getBaseFrostProtection(
      { id: this.#anyDeviceId, tableName: 'DeviceLocation' },
      false,
    )
  }

  async #getDevicesHolidayMode(): Promise<Result<ClassicHolidayModeData>> {
    return this.#getBaseHolidayMode(
      { id: this.#anyDeviceId, tableName: 'DeviceLocation' },
      false,
    )
  }

  async #getFrostProtectionLocation(): Promise<ClassicFrostProtectionLocation> {
    if (this.isFrostProtectionAtZoneLevel === null) {
      // Mutations need a concrete location; surface fetch failure as throw.
      const result = await this.getFrostProtection()
      if (!result.ok) {
        throwLocationError(result.error)
      }
    }
    return this.isFrostProtectionAtZoneLevel === true ?
        { [this.frostProtectionLocation]: [this.id] }
      : { DeviceIds: this.#deviceIds }
  }

  async #getHolidayModeLocation(): Promise<ClassicHolidayModeTimeZone[]> {
    if (this.isHolidayModeAtZoneLevel === null) {
      const result = await this.getHolidayMode()
      if (!result.ok) {
        throwLocationError(result.error)
      }
    }
    return this.isHolidayModeAtZoneLevel === true ?
        [{ [this.holidayModeLocation]: [this.id] }]
      : [{ Devices: this.#deviceIds }]
  }

  async #getZoneFrostProtection(): Promise<Result<ClassicFrostProtectionData>> {
    return this.#getBaseFrostProtection({
      id: this.id,
      tableName: this.tableName,
    })
  }

  async #getZoneHolidayMode(): Promise<Result<ClassicHolidayModeData>> {
    return this.#getBaseHolidayMode({
      id: this.id,
      tableName: this.tableName,
    })
  }
}
