import { DateTime } from 'luxon'

import { CLASSIC_FLAG_UNCHANGED, ClassicDeviceType } from '../constants.ts'
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
} from '../entities/index.ts'
import { NoChangesError } from '../errors/index.ts'
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
  type Result,
  mapResult,
} from '../types/index.ts'
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
import type { ClassicDeviceFacade } from './classic-types.ts'
import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './report-types.ts'
import { ClassicBaseFacade } from './classic-base.ts'

// Unix epoch as fallback for open-ended report queries
const DEFAULT_YEAR = '1970-01-01'

const MS_PER_DAY = 86_400_000

// Use Luxon parsing so offset-less ISO inputs are interpreted in
// `LuxonSettings.defaultZone` (matching the Classic API's timezone contract),
// not the host runtime timezone.
const getDuration = ({ from, to }: Required<ReportQuery>): number =>
  Math.ceil(
    (DateTime.fromISO(to).toMillis() - DateTime.fromISO(from).toMillis()) /
      MS_PER_DAY,
  )

/**
 * Abstract base for device-specific facades. Handles device data access, report generation,
 * value updates with effective flags, and ATA key conversion between set/list formats.
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
    | string
    | undefined
  )[]

  public abstract readonly type: T

  public get data(): Readonly<ClassicListDeviceData<T>> {
    return this.device.data
  }

  public override get devices(): ClassicDeviceAny[] {
    return [this.instance]
  }

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly internalTemperaturesLegend: readonly (
    | string
    | undefined
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

  // The `@fetchDevices` decorator awaits a registry sync before this
  // body runs; the body just exposes the now-fresh `this.data`. The
  // `const data = await Promise.resolve(...)` shape is the only one
  // that simultaneously satisfies `promise-function-async`,
  // `require-await`, and `return-await`.
  @fetchDevices()
  public async fetch(): Promise<Readonly<ClassicListDeviceData<T>>> {
    const data = await Promise.resolve(this.data)
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
    const newData = typedFromEntries<Partial<ClassicUpdateDeviceData<T>>>(
      Object.entries(data).filter(
        ([key, value]) =>
          isUpdateDeviceData(currentSetData, key) &&
          currentSetData[key] !== value,
      ),
    )

    const flags = this.#computeFlags(typedKeys(newData))
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

  public async getEnergy(
    query?: ReportQuery,
  ): Promise<Result<ClassicEnergyData<T>>> {
    return this.api.getEnergy<T>({
      postData: this.#buildReportPostData(query),
    })
  }

  public async getHourlyTemperatures(
    hour: Hour = DateTime.now().hour,
  ): Promise<Result<ReportChartLineOptions>> {
    return mapResult(
      await this.api.getHourlyTemperatures({
        postData: { device: this.id, hour },
      }),
      (data) =>
        getChartLineOptions(data, this.internalTemperaturesLegend, '°C'),
    )
  }

  public async getInternalTemperatures(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<Result<ReportChartLineOptions>> {
    return mapResult(
      await this.api.getInternalTemperatures({
        postData: this.#buildReportPostData(query, shouldUseExactRange),
      }),
      (data) =>
        getChartLineOptions(data, this.internalTemperaturesLegend, '°C'),
    )
  }

  public async getOperationModes(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<Result<ReportChartPieOptions>> {
    const postData = this.#buildReportPostData(query, shouldUseExactRange)
    const dateRange = { from: postData.FromDate, to: postData.ToDate }
    return mapResult(await this.api.getOperationModes({ postData }), (data) =>
      getChartPieOptions(data, dateRange),
    )
  }

  public async getTemperatures(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<Result<ReportChartLineOptions>> {
    return mapResult(
      await this.api.getTemperatures({
        postData: {
          ...this.#buildReportPostData(query, shouldUseExactRange),
          Location: this.registry.buildings.getById(this.device.buildingId)
            ?.location,
        },
      }),
      (data) => getChartLineOptions(data, this.temperaturesLegend, '°C'),
    )
  }

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
    { from = DEFAULT_YEAR, to = now() }: ReportQuery = {},
    shouldUseExactRange = false,
  ): ClassicReportPostData {
    return {
      DeviceID: this.id,
      Duration: shouldUseExactRange ? getDuration({ from, to }) : undefined,
      FromDate: from,
      ToDate: to,
    }
  }

  // Combine individual field flags via bitwise OR to tell the Classic API
  // which device settings were actually changed
  #computeFlags(keys: (keyof ClassicUpdateDeviceData<T>)[]): number {
    return Number(
      keys.reduce(
        (flag, key) => flag | BigInt(this.flags[key]),
        BigInt(CLASSIC_FLAG_UNCHANGED),
      ),
    )
  }
}
