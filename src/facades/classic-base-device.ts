import {
  CLASSIC_FLAG_UNCHANGED,
  ClassicDeviceType,
  ClassicLabelType,
} from '../constants.ts'
import {
  classicUpdateDevice,
  convertToListDeviceData,
  fetchDevices,
  syncDevices,
} from '../decorators/index.ts'
import {
  type ClassicDeviceAny,
  ClassicDevice,
  isClassicDeviceOfType,
  STALE_COMMUNICATION_HOURS,
} from '../entities/index.ts'
import { NoChangesError } from '../errors/index.ts'
import { Intl, Temporal } from '../temporal.ts'
import {
  type ClassicDeviceID,
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
  formatLabels,
  fromListToSetAta,
  getChartLineOptions,
  getChartPieOptions,
  isSetDeviceDataAtaInList,
  isUpdateDeviceData,
  now,
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
 * Abstract base for device-specific facades. Handles device data access, report generation,
 * value updates with effective flags, and ATA key conversion between set/list formats.
 * @template T - Device type discriminator narrowing device data, update
 * payloads, and effective flags to the device-type-specific shapes.
 */
export abstract class BaseDeviceFacade<T extends ClassicDeviceType>
  extends ClassicBaseFacade<ClassicDeviceAny>
  implements ClassicDeviceFacade<T>
{
  declare public readonly id: ClassicDeviceID

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
   * Whether MELCloud can still deliver writes to the unit: it
   * communicated within roughly the last day. The `Offline` flag is not
   * usable (a ~2-4 min staleness boolean that flaps on healthy units)
   * and `LastTimeStamp` is building-local wall clock, so only day-scale
   * staleness is trustworthy; an unparsable or future-skewed value
   * reads available. The staleness anchor is deliberately UTC, not
   * `api.timezone`: UTC bounds a healthy unit's apparent staleness at
   * +14 h for ANY host/building timezone pair, while a configured-zone
   * anchor could reach 26 h cross-zone (e.g. UTC+13 host, UTC-11
   * building) and wrongly flag a live unit.
   * @returns `false` after a day without communication.
   */
  public get isAvailable(): boolean {
    // The registry lookup stays OUTSIDE the guard: a pruned id must
    // propagate as EntityNotFoundError like the Home facade does, or a
    // vanished device would read as reachable. Only the wall-clock parse
    // is guarded.
    const { LastTimeStamp: lastTimestamp } = this.data
    try {
      return (
        Temporal.Now.plainDateTimeISO('UTC')
          .since(Temporal.PlainDateTime.from(lastTimestamp))
          .total('hours') <= STALE_COMMUNICATION_HOURS
      )
    } catch {
      return true
    }
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

  // For ATA devices, ClassicAPI list responses use different property names than set
  // requests (e.g., "FanSpeed" in list vs "SetFanSpeed" in set). Convert keys
  // to set format, then keep only the fields tracked by flags.
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
  // body runs; the body just exposes the now-fresh `this.data`.
  @fetchDevices()
  public async fetch(): Promise<Readonly<ClassicListDeviceData<T>>> {
    const data = await resolved(this.data)
    return data
  }

  @syncDevices()
  public async getValues(): Promise<Result<ClassicGetDeviceData<T>>> {
    const { api, device } = this
    const result = await api.getValues<T>({
      params: { buildingId: device.buildingId, id: device.id },
    })
    if (result.ok) {
      device.update(convertToListDeviceData(this, result.value))
    }
    return result
  }

  @syncDevices()
  @classicUpdateDevice()
  public async updateValues(
    data: Partial<ClassicUpdateDeviceData<T>>,
  ): Promise<ClassicSetDeviceData<T>> {
    const { api, id, setData: currentSetData, type } = this
    // A present-`undefined` key counts as absent (JS callers can send
    // one); letting it through would raise a phantom `EffectiveFlags`
    // bit and bypass the `NoChangesError` guard.
    const newData = typedFromEntries<Partial<ClassicUpdateDeviceData<T>>>(
      Object.entries(data).filter(
        ([key, value]) =>
          value !== undefined &&
          isUpdateDeviceData(currentSetData, key) &&
          currentSetData[key] !== value,
      ),
    )

    const flags = this.#computeFlags(typedKeys(newData))
    if (flags === 0) {
      throw new NoChangesError(id)
    }
    return api.updateValues({
      postData: {
        ...this.prepareUpdateData(newData),
        DeviceID: id,
        EffectiveFlags: flags,
      },
      type,
    })
  }

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

  public async getHourlyTemperatures(
    hour?: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    if (this.internalTemperaturesLegend.length === 0) {
      return ok(emptyTemperatureChart(this.#buildReportPostData()))
    }
    return this.fetchHourlyDayChart(
      async (hourOfDay) => this.#fetchTemperaturesHour(hourOfDay),
      hour,
    )
  }

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

  public async getOperationModes(
    query?: ReportQuery,
  ): Promise<Result<ReportChartPieOptions>> {
    const postData = this.#buildReportPostData(query, true)
    const dateRange = { from: postData.FromDate, to: postData.ToDate }
    return mapResult(await this.api.getOperationModes({ postData }), (data) =>
      getChartPieOptions(data, dateRange),
    )
  }

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
    device?: false,
  ): Promise<Result<ClassicTilesData<null>>>
  public override async getTiles(
    device: true | ClassicDeviceAny,
  ): Promise<Result<ClassicTilesData<T>>>
  public override async getTiles(
    device: boolean | ClassicDeviceAny = false,
  ): Promise<Result<ClassicTilesData<T | null>>> {
    if (
      device === false ||
      (device instanceof ClassicDevice && device.id !== this.id)
    ) {
      return super.getTiles()
    }
    return super.getTiles(this.device)
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
    const { from = DEFAULT_YEAR, to = now(this.api.timezone) } = query
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
    return Number(
      keys.reduce(
        // eslint-disable-next-line no-bitwise -- `EffectiveFlags` is a bitfield; `|` accumulates flags
        (flag, key) => flag | BigInt(this.flags[key]),
        BigInt(CLASSIC_FLAG_UNCHANGED),
      ),
    )
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
