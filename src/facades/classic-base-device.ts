import { ClassicDeviceType, ClassicLabelType } from '../constants.ts'
import {
  classicUpdateDevice,
  convertToListDeviceData,
  fetchDevices,
  syncDevices,
} from '../decorators/index.ts'
import {
  type ClassicDeviceAny,
  ClassicDevice,
  hasStoppedCommunicating,
  isClassicDeviceOfType,
} from '../entities/index.ts'
import { NoChangesError } from '../errors/index.ts'
import { Intl, Temporal } from '../temporal.ts'
import {
  type ClassicEnergyData,
  type ClassicGetDeviceData,
  type ClassicListDeviceData,
  type ClassicReportPostData,
  type ClassicSetDeviceData,
  type ClassicTilesData,
  type ClassicUpdateDeviceData,
  type Hour,
  type Resolved,
  type Result,
  mapResult,
  ok,
} from '../types/index.ts'
import {
  createKeyGuard,
  formatLabels,
  fromListToSetAta,
  getChartLineOptions,
  getChartPieOptions,
  isSetDeviceDataAtaInList,
  resolved,
  typedFromEntries,
  typedKeys,
  withMinuteClockLabels,
} from '../utils.ts'
import type {
  ClassicDeviceFacade,
  ClassicEnergyReportExtract,
} from './classic-types.ts'
import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './report-types.ts'
import { ClassicBaseFacade } from './classic-base.ts'
import { combineFlags } from './classic-flag-bits.ts'

// Unix epoch as fallback for open-ended report queries
const DEFAULT_YEAR = '1970-01-01'

const ENERGY_REPORT_UNIT = 'kWh'

/**
 * Builds a per-type `extractEnergyReport` hook from the bucket names the
 * device type charts, in MELCloud display order: labels and label type
 * come straight from the wire, one named series per bucket array.
 * @template TBucket - Charted bucket key union of the energy payload.
 * @param buckets - Bucket names in display order.
 * @returns The extractor closing over the buckets.
 */
export const makeEnergyExtract =
  <TBucket extends string>(buckets: readonly TBucket[]) =>
  (
    data: Readonly<Record<TBucket, readonly number[]>> & {
      readonly Labels: readonly number[]
      readonly LabelType: ClassicLabelType
    },
  ): ClassicEnergyReportExtract => ({
    labels: data.Labels,
    labelType: data.LabelType,
    series: buckets.map((name) => ({ data: data[name], name })),
  })

const emptyTemperatureChart = ({
  FromDate: from,
  ToDate: to,
}: ClassicReportPostData): ReportChartLineOptions => ({
  from,
  labels: [],
  series: [],
  to,
  unit: '°C',
})

// ISO 8601 weekday number for Sunday.
const ISO_SUNDAY = 7

// `EnergyCost/Report` labels need repairs before the shared formatter:
// one-day reports arrive as bare hour numbers (`LabelType.time`) that
// format as clock labels, and multi-day buckets carry vendor-dependent
// day labels (0-based .NET weekdays for ATA, raw days of month for
// ATW) — when the bucket count matches the window's calendar-day span,
// those rebuild as localized dates anchored on `from`, aligning the
// axis with the Home energy charts; otherwise day-of-week entries get
// the 1-based ISO repair. Final strings return `LabelType.raw` so the
// shared formatter passes them through — re-parsing a rebuilt date as
// a day-of-week number throws (the 42.0.1 crash on multi-day ATA
// reports).
const toEnergyReportLabels = (
  labels: readonly number[],
  {
    labelType,
    locale,
    window,
  }: {
    labelType: ClassicLabelType
    window: Resolved<ReportQuery>
    locale?: string | undefined
  },
): { labels: string[]; labelType: ClassicLabelType } => {
  if (labelType === ClassicLabelType.time) {
    const formatter = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })
    return {
      labels: labels.map((label) =>
        formatter.format(new Temporal.PlainTime(label)),
      ),
      labelType: ClassicLabelType.raw,
    }
  }
  if (labels.length === getDuration(window)) {
    const formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    })
    const start = Temporal.PlainDateTime.from(window.from).toPlainDate()
    return {
      labels: labels.map((_unused, index) =>
        formatter.format(start.add({ days: index })),
      ),
      labelType: ClassicLabelType.raw,
    }
  }
  return {
    labels: labels.map((label) =>
      String(
        label === 0 && labelType === ClassicLabelType.dayOfWeek
          ? ISO_SUNDAY
          : label,
      ),
    ),
    labelType,
  }
}

// Calendar-day delta between two ISO wall-clock strings. Computed on
// `PlainDateTime` so the result reflects the literal Y-M-D-h-m-s span
// the Classic server uses, independent of DST in any zone.
const getDuration = ({ from, to }: Resolved<ReportQuery>): number =>
  Temporal.PlainDateTime.from(to).since(Temporal.PlainDateTime.from(from), {
    roundingMode: 'ceil',
    smallestUnit: 'day',
  }).days

// Query dates carrying an offset (`Z`, `+02:00`) pin an absolute
// instant, lowered here to wall-clock in the display timezone — the
// only dialect the Classic wire and the Temporal Plain types accept.
// Zoneless strings pass through as the literal local datetimes callers
// already feed. Mirrors the Home facades' query tolerance so the same
// `new Date().toISOString()` output works against both APIs.
const toWallClock = (iso: string, timezone = 'UTC'): string => {
  try {
    return Temporal.Instant.from(iso)
      .toZonedDateTimeISO(timezone)
      .toPlainDateTime()
      .toString()
  } catch {
    return iso
  }
}

/**
 * Abstract base for device-specific facades. Handles device data access, report
 * generation, value updates with effective flags, and ATA key conversion
 * between set/list formats.
 * @template T - Device type discriminator narrowing device data, update
 * payloads, and effective flags to the device-type-specific shapes.
 */
export abstract class BaseDeviceFacade<T extends ClassicDeviceType>
  extends ClassicBaseFacade<ClassicDeviceAny>
  implements ClassicDeviceFacade<T>
{
  public abstract readonly flags: Record<
    keyof ClassicUpdateDeviceData<T>,
    number
  >

  protected abstract readonly temperaturesLegend: readonly (
    string | undefined
  )[]

  public abstract readonly type: T

  /**
   * Last-synced wire-format payload for this device.
   * @returns A read-only snapshot of the device data.
   */
  public get data(): Readonly<ClassicListDeviceData<T>> {
    return this.device.data
  }

  /**
   * Single-element list containing this device, mirroring the
   * collection-style accessor on building/floor/area facades.
   * @returns A list with the wrapped device.
   */
  public override get devices(): ClassicDeviceAny[] {
    return [this.instance]
  }

  /**
   * The unit's own fault as MELCloud words it, in the account's
   * language — `E6 : …` on an indoor/outdoor communication error — or
   * `null` while the unit reports none. Read from the listing's
   * `ErrorMessages`, which is `''` on a healthy unit.
   * @returns The trimmed fault text, or `null`.
   */
  public get errorMessage(): string | null {
    const message = this.data.ErrorMessages.trim()
    return message === '' ? null : message
  }

  /**
   * Whether MELCloud can still deliver writes to the unit: it
   * communicated within roughly the last day. The `Offline` flag is not
   * usable (a ~2-4 min staleness boolean that flaps on healthy units)
   * and `LastTimeStamp` is building-local wall clock, so only day-scale
   * staleness is trustworthy; {@link hasStoppedCommunicating} is the
   * predicate, the one the registry's communication edge reads too.
   * @returns `false` after a day without communication.
   */
  public get isAvailable(): boolean {
    // The registry lookup stays OUTSIDE the predicate's guard: a pruned
    // id must propagate as EntityNotFoundError like the Home facade
    // does, or a vanished device would read as reachable.
    return !hasStoppedCommunicating(this.data.LastTimeStamp)
  }

  /**
   * Whether the unit itself reports a fault — the listing's `HasError`,
   * which MELCloud relays from the unit and which a reachable unit
   * carries while still answering writes (live-read 2026-11-06 on a unit
   * in `E6`: every write echoed `200` with the fault attached).
   * @returns `true` while the unit reports a fault of its own.
   */
  public get isInError(): boolean {
    return this.data.HasError
  }

  /**
   * Whether the unit is powered on — the Classic counterpart of the
   * Home facade's getter.
   * @returns `true` when on, `false` when standby.
   */
  public get power(): boolean {
    return this.data.Power
  }

  /**
   * Last-reported Wi-Fi signal strength of the device adapter, in dBm —
   * the Classic counterpart of the Home facade's getter.
   * @returns The RSSI value.
   */
  public get rssi(): number {
    return this.data.WifiSignalStrength
  }

  // The per-type rule a change set goes through BEFORE its flags are
  // computed: deriving a companion field from the ones that changed. A
  // derived field must be flagged like the named ones or the unit
  // drops it, which is why this runs before `#computeFlags` while
  // `prepareUpdateData` only assembles the body afterwards. The one
  // type that has such a rule, air-to-water, also bounds its target
  // temperatures here, so AFTER the no-change filter: a request beyond
  // a bound the unit already sits on is sent again as that bound,
  // flagged. Absent on a device type that derives nothing.
  protected readonly deriveUpdateData?: (
    data: Partial<ClassicUpdateDeviceData<T>>,
  ) => Partial<ClassicUpdateDeviceData<T>>

  // `null` marks device types without an energy report (ERV):
  // `getEnergyReport` then resolves an empty chart without a wire call.
  protected readonly extractEnergyReport:
    ((data: ClassicEnergyData<T>) => ClassicEnergyReportExtract) | null = null

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  // `[]` marks device types without an internal-temperatures report:
  // the readers then resolve an empty chart without a wire call.
  protected readonly internalTemperaturesLegend: readonly (
    string | undefined
  )[] = []

  // The per-type reading of what the caller ASKED, applied before
  // anything is compared: a value the unit cannot hold as given (a
  // setpoint off its step or out of its bounds) becomes the value it
  // will hold. It runs before the no-change filter so that a request
  // for a value that comes back to the one the unit already holds is
  // refused like any other write that changes nothing, instead of
  // re-sending it. Absent on a device type that takes every value as
  // given.
  protected readonly normalizeUpdateData?: (
    data: Partial<ClassicUpdateDeviceData<T>>,
  ) => Partial<ClassicUpdateDeviceData<T>>

  protected readonly tableName = 'DeviceLocation'

  protected get device(): ClassicDevice<T> {
    const { instance } = this
    if (!isClassicDeviceOfType(instance, this.type)) {
      throw new Error(
        `ClassicDevice type mismatch: expected ${String(this.type)}, got ${String(instance.type)}`,
      )
    }
    return instance
  }

  protected get model(): {
    getById: (id: number) => ClassicDeviceAny | undefined
  } {
    return this.registry.devices
  }

  // For ATA devices, ClassicAPI list responses use different property names
  // than set requests (e.g., "FanSpeed" in list vs "SetFanSpeed" in set).
  // Convert keys to set format, then keep only the fields tracked by flags.
  protected get setData(): Required<ClassicUpdateDeviceData<T>> {
    const dataEntries = Object.entries(this.data)
    const entries = (
      this.type === ClassicDeviceType.Ata
        ? dataEntries.map(([key, value]): [string, unknown] => [
            isSetDeviceDataAtaInList(key) ? fromListToSetAta[key] : key,
            value,
          ])
        : dataEntries
    ).filter(([key]) => Object.hasOwn(this.flags, key))
    return typedFromEntries<Required<ClassicUpdateDeviceData<T>>>(entries)
  }

  // The `@fetchDevices` decorator awaits a registry sync before this
  // body runs; the body just exposes `this.data`.
  /**
   * Syncs the registry, then answers the device's data. The sync is
   * best-effort: one that fails is logged by the client, and the
   * answer is then the data of the last sync that passed.
   * @returns The device's list data, as the registry holds it after
   * the sync.
   */
  @fetchDevices({
    refresh: async (self: BaseDeviceFacade<T>) => self.api.fetch(),
  })
  public async fetch(): Promise<Readonly<ClassicListDeviceData<T>>> {
    const data = await resolved(this.data)
    return data
  }

  /**
   * Writes a change set to the device. Each value is first read as
   * the unit will hold it (an air-to-air setpoint goes on the half
   * degree and within its mode's bounds); the set is then reduced to
   * the fields that differ from the last synced state — a key that is
   * `undefined`, or unknown to the device type, counts as absent —
   * and a per-type rule may then add a companion field or bound a
   * value (the other zone and the target temperatures of an
   * air-to-water unit). Only the resulting fields are flagged for the
   * unit to apply; the body carries the rest of the synced state
   * around them. One request is sent: no read precedes the write and
   * none follows it. The registry model takes from the answer the
   * fields its flags mark, and the sync notification fires.
   * @param data - Fields to change.
   * @returns MELCloud's answer to the write.
   * @throws A {@link NoChangesError} when no field differs from the
   * synced state: nothing is sent.
   */
  @syncDevices()
  @classicUpdateDevice
  public async updateValues(
    data: Partial<ClassicUpdateDeviceData<T>>,
  ): Promise<ClassicSetDeviceData<T>> {
    const { api, id, setData: currentSetData, type } = this
    const isKnownKey = createKeyGuard(currentSetData)
    // A present-`undefined` key counts as absent (JS callers can send
    // one); letting it through would raise a phantom `EffectiveFlags`
    // bit and bypass the `NoChangesError` guard.
    const newData = typedFromEntries<Partial<ClassicUpdateDeviceData<T>>>(
      Object.entries(this.normalizeUpdateData?.(data) ?? data).filter(
        ([key, value]) =>
          value !== undefined &&
          isKnownKey(key) &&
          currentSetData[key] !== value,
      ),
    )

    // The flags are computed from the DERIVED change set, not the
    // caller's: a field a per-type rule adds (the ATW zone coupling)
    // must carry its own bit or the unit drops it, since only the
    // flagged fields are applied.
    const derivedData = this.deriveUpdateData?.(newData) ?? newData
    const flags = this.#computeFlags(typedKeys(derivedData))
    if (flags === 0) {
      throw new NoChangesError(id)
    }
    return api.updateValues({
      postData: {
        ...this.prepareUpdateData(derivedData),
        DeviceID: id,
        EffectiveFlags: flags,
      },
      type,
    })
  }

  /**
   * Reads the raw energy report of the device over a window.
   * @param query - Optional report time window.
   * @returns The energy payload, or a typed failure.
   * @throws A `TypeError` on a device type that has no energy report
   * (ERV), before any request.
   */
  public async getEnergy(
    query?: ReportQuery,
  ): Promise<Result<ClassicEnergyData<T>>> {
    // The same per-type hook that empties `getEnergyReport` refuses the
    // raw read: `ClassicEnergyData<Erv>` is `never`, so no caller could
    // use a success anyway — a wire request here could only come back
    // as an error dressed up as transport trouble.
    if (this.extractEnergyReport === null) {
      throw new TypeError('No energy report exists for this device type')
    }
    return this.api.getEnergy<T>({ postData: this.#buildReportPostData(query) })
  }

  /**
   * Charts the energy report of the device over a window, in kWh, one
   * series per bucket its device type charts. The wire's numeric
   * labels are rebuilt for display in the client's locale: clock
   * labels on a one-day report, dates when the report holds one
   * bucket per day of the window, the label type's own formatting
   * otherwise. A device type without an energy report answers an
   * empty chart, with no request.
   * @param query - Optional report time window.
   * @returns The line chart options, or a typed failure.
   */
  public async getEnergyReport(
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    const { extractEnergyReport } = this
    const postData = this.#buildReportPostData(query)
    const { FromDate: from, ToDate: to } = postData
    if (extractEnergyReport === null) {
      return ok({ from, labels: [], series: [], to, unit: ENERGY_REPORT_UNIT })
    }
    return mapResult(await this.api.getEnergy<T>({ postData }), (data) => {
      const { labels, labelType, series } = extractEnergyReport(data)
      const report = toEnergyReportLabels(labels, {
        labelType,
        locale: this.api.locale,
        window: { from, to },
      })
      // The extract already IS the chart's substance: bucket names as
      // the legend, bucket arrays as the series — no synthetic wire
      // payload in between.
      return {
        from,
        labels: formatLabels(report.labels, report.labelType, this.api.locale),
        series: series.map(({ data: values, name }) => ({
          data: [...values],
          name,
        })),
        to,
        unit: ENERGY_REPORT_UNIT,
      }
    })
  }

  /**
   * Charts the hourly temperature report of the device, in °C: the
   * given hour of today, or every hour of today so far when none is
   * given — the hours still to come padded blank. A device type
   * without internal temperatures answers an empty chart, with no
   * request.
   * @param hour - Hour of today to chart alone.
   * @returns The line chart options, or a typed failure.
   */
  public async getHourlyTemperatures(
    hour?: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    return this.internalTemperaturesLegend.length === 0
      ? ok(emptyTemperatureChart(this.#buildReportPostData()))
      : this.fetchHourlyDayChart(
          async (hourOfDay) => this.#fetchTemperaturesHour(hourOfDay),
          hour,
        )
  }

  /**
   * Charts the internal temperatures of the device over a window, in
   * °C. A device type without that report (ATW alone has it) answers
   * an empty chart, with no request.
   * @param query - Optional report time window.
   * @returns The line chart options, or a typed failure.
   */
  public async getInternalTemperatures(
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    const postData = this.#buildReportPostData(query, true)
    // An empty legend marks a type the report does not exist for (the
    // docs say ATW only): answer the empty chart locally rather than
    // paying a wire call whose every series would be masked away.
    if (this.internalTemperaturesLegend.length === 0) {
      return ok(emptyTemperatureChart(postData))
    }
    return mapResult(
      await this.api.getInternalTemperatures({ postData }),
      (data) =>
        getChartLineOptions(data, {
          legend: this.internalTemperaturesLegend,
          locale: this.api.locale,
          unit: '°C',
        }),
    )
  }

  /**
   * Charts the operation-mode breakdown of the device over a window,
   * as pie chart data: one segment per mode MELCloud reports.
   * @param query - Optional report time window.
   * @returns The pie chart options, or a typed failure.
   */
  public async getOperationModes(
    query?: ReportQuery,
  ): Promise<Result<ReportChartPieOptions>> {
    const postData = this.#buildReportPostData(query, true)
    const dateRange = { from: postData.FromDate, to: postData.ToDate }
    return mapResult(await this.api.getOperationModes({ postData }), (data) =>
      getChartPieOptions(data, dateRange),
    )
  }

  /**
   * Charts the temperature log of the device over a window, in °C,
   * under the legend of its device type. The read carries the
   * location of the device's building.
   * @param query - Optional report time window.
   * @returns The line chart options, or a typed failure.
   */
  public async getTemperatures(
    query?: ReportQuery,
  ): Promise<Result<ReportChartLineOptions>> {
    return mapResult(
      await this.api.getTemperatures({
        postData: {
          ...this.#buildReportPostData(query, true),
          Location: this.registry.buildings.getById(this.device.buildingId)
            ?.location,
        },
      }),
      (data) =>
        getChartLineOptions(data, {
          legend: this.temperaturesLegend,
          locale: this.api.locale,
          unit: '°C',
        }),
    )
  }

  /**
   * Fetches dashboard tile data for this device; passing `true` (or
   * this device itself) pins the response to its full `SelectedDevice` payload.
   * @param device - `true`/this device to pin selection, or `false` for none.
   * @returns The tile data, or a typed failure.
   */
  public override async getTiles(
    device: boolean | ClassicDeviceAny = false,
  ): Promise<Result<ClassicTilesData>> {
    return device === false ||
      (device instanceof ClassicDevice && device.id !== this.id)
      ? super.getTiles()
      : super.getTiles(this.device)
  }

  // No `@syncDevices()` here: the decorator fires once the method has
  // resolved, and a `Result` resolves on a failure too.
  /**
   * Reads the device's current values from MELCloud. On success the
   * answer is merged into the registry model, under its list-data
   * keys, and the sync notification fires. A failure is returned as
   * is: it leaves the model alone and announces nothing.
   * @returns The device data as MELCloud answered it, or a typed
   * failure.
   */
  public async getValues(): Promise<Result<ClassicGetDeviceData<T>>> {
    const { api, device } = this
    const result = await api.getValues<T>({
      params: { buildingId: device.buildingId, id: device.id },
    })
    if (result.ok) {
      device.update(convertToListDeviceData(this, result.value))
      await this.notifySync()
    }
    return result
  }

  protected prepareUpdateData(
    data: Partial<ClassicUpdateDeviceData<T>>,
  ): Required<ClassicUpdateDeviceData<T>> {
    return { ...this.setData, ...data }
  }

  #buildReportPostData(
    query: ReportQuery = {},
    shouldUseExactRange = false,
  ): ClassicReportPostData {
    const {
      from = DEFAULT_YEAR,
      to = Temporal.Now.plainDateTimeISO(this.api.timezone).toString({
        smallestUnit: 'millisecond',
      }),
    } = query
    const fromDate = toWallClock(from, this.api.timezone)
    const toDate = toWallClock(to, this.api.timezone)
    return {
      DeviceID: this.id,
      Duration: shouldUseExactRange
        ? getDuration({ from: fromDate, to: toDate })
        : undefined,
      FromDate: fromDate,
      ToDate: toDate,
    }
  }

  // Combine individual field flags via bitwise OR to tell the Classic API
  // which device settings were actually changed
  #computeFlags(keys: (keyof ClassicUpdateDeviceData<T>)[]): number {
    return combineFlags(keys.map((key) => this.flags[key]))
  }

  async #fetchTemperaturesHour(
    hour: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    return mapResult(
      await this.api.getHourlyTemperatures({
        postData: { device: this.id, hour },
      }),
      (data) =>
        withMinuteClockLabels(
          getChartLineOptions(data, {
            legend: this.internalTemperaturesLegend,
            locale: this.api.locale,
            unit: '°C',
          }),
          { hour, locale: this.api.locale },
        ),
    )
  }
}
