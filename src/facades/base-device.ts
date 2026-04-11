import { DateTime } from 'luxon'

import type {
  EnergyData,
  GetDeviceData,
  ListDeviceData,
  ReportPostData,
  SetDeviceData,
  TilesData,
  UpdateDeviceData,
} from '../types/index.ts'
import { DeviceType, FLAG_UNCHANGED } from '../constants.ts'
import { fetchDevices, syncDevices, updateDevice } from '../decorators/index.ts'
import { type DeviceAny, Device } from '../models/index.ts'
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
import type {
  DeviceFacade,
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './interfaces.ts'
import { BaseFacade } from './base.ts'

// Unix epoch as fallback for open-ended report queries
const DEFAULT_YEAR = '1970-01-01'

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
export abstract class BaseDeviceFacade<T extends DeviceType>
  extends BaseFacade<DeviceAny>
  implements DeviceFacade<T>
{
  public abstract readonly flags: Record<keyof UpdateDeviceData<T>, number>

  protected abstract readonly temperaturesLegend: (string | undefined)[]

  public abstract readonly type: T

  public get data(): ListDeviceData<T> {
    return this.device.data
  }

  public override get devices(): DeviceAny[] {
    return [this.instance]
  }

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly internalTemperaturesLegend: (string | undefined)[] = []

  protected readonly tableName = 'DeviceLocation'

  protected get device(): Device<T> {
    const { instance } = this
    if (instance.type !== this.type) {
      throw new Error(
        `Device type mismatch: expected ${String(this.type)}, got ${String(instance.type)}`,
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- runtime-verified by type guard above
    return instance as Device<T>
  }

  protected get model(): {
    getById: (id: number) => DeviceAny | undefined
  } {
    return this.registry.devices
  }

  /*
   * For ATA devices, ClassicAPI list responses use different property names than set
   * requests (e.g., "FanSpeed" in list vs "SetFanSpeed" in set). Convert keys
   * to set format, then keep only the fields tracked by flags.
   */
  protected get setData(): Required<UpdateDeviceData<T>> {
    const dataEntries = Object.entries(this.data)
    const entries =
      this.type === DeviceType.Ata ?
        dataEntries
          .map(([key, value]): [string, unknown] => [
            isSetDeviceDataAtaInList(key) ? fromListToSetAta[key] : key,
            value,
          ])
          .filter(([key]) => key in this.flags)
      : dataEntries.filter(([key]) => key in this.flags)
    return typedFromEntries<Required<UpdateDeviceData<T>>>(entries)
  }

  @fetchDevices
  public async fetch(): Promise<ListDeviceData<T>> {
    const data = await Promise.resolve(this.data)
    return data
  }

  @syncDevices()
  @updateDevice
  public async getValues(): Promise<GetDeviceData<T>> {
    const { data } = await this.api.getValues<T>({
      params: { buildingId: this.device.buildingId, id: this.id },
    })
    return data
  }

  @syncDevices()
  @updateDevice
  public async setValues(
    data: Partial<UpdateDeviceData<T>>,
  ): Promise<SetDeviceData<T>> {
    const { api, id, setData: currentSetData, type } = this
    const newData = typedFromEntries<Partial<UpdateDeviceData<T>>>(
      Object.entries(data).filter(
        ([key, value]) =>
          isUpdateDeviceData(currentSetData, key) &&
          currentSetData[key] !== value,
      ),
    )

    const flags = this.#computeFlags(
      typedKeys(newData) as (keyof UpdateDeviceData<T>)[],
    )
    if (!flags) {
      throw new Error(`No data to set for device ${String(id)}`)
    }
    const { data: finalData } = await api.setValues({
      postData: {
        ...this.prepareUpdateData(newData),
        DeviceID: id,
        EffectiveFlags: flags,
      },
      type,
    })
    return finalData
  }

  public async getEnergy(query?: ReportQuery): Promise<EnergyData<T>> {
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

  public override async getTiles(device?: false): Promise<TilesData<null>>
  public override async getTiles(
    device: true | DeviceAny,
  ): Promise<TilesData<T>>
  public override async getTiles(
    device: boolean | DeviceAny = false,
  ): Promise<TilesData<T | null>> {
    if (
      device === false ||
      (device instanceof Device && device.id !== this.id)
    ) {
      return super.getTiles()
    }
    return super.getTiles(this.device)
  }

  protected prepareUpdateData(
    data: Partial<UpdateDeviceData<T>>,
  ): Required<UpdateDeviceData<T>> {
    return { ...this.setData, ...data }
  }

  #buildReportPostData(
    { from, to }: ReportQuery = {},
    shouldUseExactRange = false,
  ): ReportPostData {
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
   * Combine individual field flags via bitwise OR to tell the ClassicAPI
   * which device settings were actually changed
   */
  #computeFlags(keys: (keyof UpdateDeviceData<T>)[]): number {
    return Number(
      keys.reduce(
        (flag, key) => flag | BigInt(this.flags[key]),
        BigInt(FLAG_UNCHANGED),
      ),
    )
  }
}
