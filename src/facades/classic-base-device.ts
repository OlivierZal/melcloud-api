import { DateTime } from 'luxon'

import type {
  ClassicDeviceID,
  ClassicEnergyData,
  ClassicGetDeviceData,
  ClassicListDeviceData,
  ClassicReportPostData,
  ClassicSetDeviceData,
  ClassicTilesData,
  ClassicUpdateDeviceData,
} from '../types/index.ts'
import { CLASSIC_FLAG_UNCHANGED, ClassicDeviceType } from '../constants.ts'
import {
  classicUpdateDevice,
  fetchDevices,
  syncDevices,
} from '../decorators/index.ts'
import {
  type ClassicDeviceAny,
  ClassicDevice,
  isClassicDeviceOfType,
} from '../entities/index.ts'
import { NoChangesError } from '../errors/index.ts'
import {
  fromListToSetAta,
  getChartLineOptions,
  getChartPieOptions,
  isSetDeviceDataAtaInList,
  isUpdateDeviceData,
  now,
  typedFromEntries,
  typedKeys,
} from '../utils.ts'
import type { ClassicDeviceFacade } from './classic-interfaces.ts'
import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './interfaces.ts'
import { BaseFacade } from './classic-base.ts'

// Unix epoch as fallback for open-ended report queries
const DEFAULT_YEAR = '1970-01-01'

/**
 * Clamp a numeric value into the inclusive `[min, max]` range.
 *
 * Shared by the three device facades (Classic ATA, Classic ATW, Home
 * ATA) that enforce target-temperature limits before sending updates
 * to their respective upstream APIs. Kept here rather than in
 * `utils.ts` so the import graph stays within the facades folder.
 * @param value - The value to clamp.
 * @param range - Inclusive bounds.
 * @param range.max - Upper bound (inclusive).
 * @param range.min - Lower bound (inclusive).
 * @returns `value`, clamped to `[range.min, range.max]`.
 */
export const clampToRange = (
  value: number,
  range: { max: number; min: number },
): number => Math.min(Math.max(value, range.min), range.max)

const getReportPostDataDates = ({
  from = DEFAULT_YEAR,
  to = now(),
}: ReportQuery): Required<ReportQuery> => ({
  from,
  to,
})

const getDuration = ({ from, to }: Required<ReportQuery>): number =>
  Math.ceil(DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days)

/**
 * Abstract base for device-specific facades. Handles device data access, report generation,
 * value updates with effective flags, and ATA key conversion between set/list formats.
 */
export abstract class BaseDeviceFacade<T extends ClassicDeviceType>
  extends BaseFacade<ClassicDeviceAny>
  implements ClassicDeviceFacade<T>
{
  declare public readonly id: ClassicDeviceID

  public abstract readonly flags: Record<
    keyof ClassicUpdateDeviceData<T>,
    number
  >

  protected abstract readonly temperaturesLegend: (string | undefined)[]

  public abstract readonly type: T

  public get data(): Readonly<ClassicListDeviceData<T>> {
    return this.device.data
  }

  public override get devices(): ClassicDeviceAny[] {
    return [this.instance]
  }

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly internalTemperaturesLegend: (string | undefined)[] = []

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

  /*
   * For ATA devices, ClassicAPI list responses use different property names than set
   * requests (e.g., "FanSpeed" in list vs "SetFanSpeed" in set). Convert keys
   * to set format, then keep only the fields tracked by flags.
   */
  protected get setData(): Required<ClassicUpdateDeviceData<T>> {
    const dataEntries = Object.entries(this.data)
    const entries =
      this.type === ClassicDeviceType.Ata ?
        dataEntries
          .map(([key, value]): [string, unknown] => [
            isSetDeviceDataAtaInList(key) ? fromListToSetAta[key] : key,
            value,
          ])
          .filter(([key]) => key in this.flags)
      : dataEntries.filter(([key]) => key in this.flags)
    return typedFromEntries<Required<ClassicUpdateDeviceData<T>>>(entries)
  }

  @fetchDevices()
  public async fetch(): Promise<Readonly<ClassicListDeviceData<T>>> {
    const data = await Promise.resolve(this.data)
    return data
  }

  @syncDevices()
  @classicUpdateDevice()
  public async getValues(): Promise<ClassicGetDeviceData<T>> {
    const { data } = await this.api.getValues<T>({
      params: { buildingId: this.device.buildingId, id: this.id },
    })
    return data
  }

  @syncDevices()
  @classicUpdateDevice()
  public async updateValues(
    data: Partial<ClassicUpdateDeviceData<T>>,
  ): Promise<ClassicSetDeviceData<T>> {
    const { api, id, setData: currentSetData, type } = this
    const newData = typedFromEntries<Partial<ClassicUpdateDeviceData<T>>>(
      Object.entries(data).filter(
        ([key, value]) =>
          isUpdateDeviceData(currentSetData, key) &&
          currentSetData[key] !== value,
      ),
    )

    const flags = this.#computeFlags(
      typedKeys(newData) as (keyof ClassicUpdateDeviceData<T>)[],
    )
    if (!flags) {
      throw new NoChangesError(id)
    }
    const { data: finalData } = await api.updateValues({
      postData: {
        ...this.prepareUpdateData(newData),
        DeviceID: id,
        EffectiveFlags: flags,
      },
      type,
    })
    return finalData
  }

  public async getEnergy(query?: ReportQuery): Promise<ClassicEnergyData<T>> {
    const { data } = await this.api.getEnergy<T>({
      postData: this.#buildReportPostData(query),
    })
    return data
  }

  public async getHourlyTemperatures(
    hour = DateTime.now().hour,
  ): Promise<ReportChartLineOptions> {
    const { data } = await this.api.getHourlyTemperatures({
      postData: { device: this.id, hour },
    })
    return getChartLineOptions(data, this.internalTemperaturesLegend, '°C')
  }

  public async getInternalTemperatures(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<ReportChartLineOptions> {
    const { data } = await this.api.getInternalTemperatures({
      postData: this.#buildReportPostData(query, shouldUseExactRange),
    })
    return getChartLineOptions(data, this.internalTemperaturesLegend, '°C')
  }

  public async getOperationModes(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<ReportChartPieOptions> {
    const postData = this.#buildReportPostData(query, shouldUseExactRange)
    const dateRange = { from: postData.FromDate, to: postData.ToDate }
    const { data } = await this.api.getOperationModes({ postData })
    return getChartPieOptions(data, dateRange)
  }

  public async getTemperatures(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<ReportChartLineOptions> {
    const { data } = await this.api.getTemperatures({
      postData: {
        ...this.#buildReportPostData(query, shouldUseExactRange),
        Location: this.registry.buildings.getById(this.device.buildingId)
          ?.location,
      },
    })
    return getChartLineOptions(data, this.temperaturesLegend, '°C')
  }

  public override async getTiles(
    device?: false,
  ): Promise<ClassicTilesData<null>>
  public override async getTiles(
    device: true | ClassicDeviceAny,
  ): Promise<ClassicTilesData<T>>
  public override async getTiles(
    device: boolean | ClassicDeviceAny = false,
  ): Promise<ClassicTilesData<T | null>> {
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
    { from, to }: ReportQuery = {},
    shouldUseExactRange = false,
  ): ClassicReportPostData {
    const { from: newFrom, to: newTo } = getReportPostDataDates({ from, to })
    return {
      DeviceID: this.id,
      Duration:
        shouldUseExactRange ?
          getDuration({ from: newFrom, to: newTo })
        : undefined,
      FromDate: newFrom,
      ToDate: newTo,
    }
  }

  /*
   * Combine individual field flags via bitwise OR to tell the Classic API
   * which device settings were actually changed
   */
  #computeFlags(keys: (keyof ClassicUpdateDeviceData<T>)[]): number {
    return Number(
      keys.reduce(
        (flag, key) => flag | BigInt(this.flags[key]),
        BigInt(CLASSIC_FLAG_UNCHANGED),
      ),
    )
  }
}
