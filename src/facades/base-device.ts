import { DateTime } from 'luxon'

import type {
  DeviceModelAny,
  DeviceModel as DeviceModelContract,
} from '../models/interfaces.ts'
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
import { DeviceModel } from '../models/index.ts'
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
  from,
  to,
}: ReportQuery): Required<ReportQuery> => ({
  from: from ?? DEFAULT_YEAR,
  to: to ?? now(),
})

const getDuration = ({ from, to }: Required<ReportQuery>): number =>
  Math.ceil(DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days)

/**
 * Abstract base for device-specific facades. Handles device data access, report generation,
 * value updates with effective flags, and ATA key conversion between set/list formats.
 */
export abstract class BaseDeviceFacade<T extends DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements DeviceFacade<T>
{
  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly internalTemperaturesLegend: (string | undefined)[] = []

  protected readonly tableName = 'DeviceLocation'

  public abstract readonly flags: Record<keyof UpdateDeviceData<T>, number>

  public abstract readonly type: T

  protected abstract readonly temperaturesLegend: (string | undefined)[]

  public override get devices(): DeviceModelAny[] {
    return [this.instance]
  }

  public get data(): ListDeviceData<T> {
    return this.device.data
  }

  protected get device(): DeviceModelContract<T> {
    const { instance } = this
    if (!this.#isMatchingDevice(instance)) {
      throw new Error(
        `Device type mismatch: expected ${String(this.type)}, got ${String(instance.type)}`,
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- runtime-verified
    return instance as unknown as DeviceModelContract<T>
  }

  protected get model(): {
    getById: (id: number) => DeviceModelAny | undefined
  } {
    return this.registry.devices
  }

  #isMatchingDevice(device: DeviceModelAny): boolean {
    return device.type === this.type
  }

  /*
   * For ATA devices, API list responses use different property names than set
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

  public override async getTiles(device?: false): Promise<TilesData<null>>
  public override async getTiles(
    device: true | DeviceModelContract<T>,
  ): Promise<TilesData<T>>
  public override async getTiles(
    device: boolean | DeviceModelContract<T> = false,
  ): Promise<TilesData<T | null>> {
    return (
        device === false ||
          (device instanceof DeviceModel && device.id !== this.id)
      ) ?
        super.getTiles()
      : super.getTiles(this.device)
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

    const flags = this.#getFlags(
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
      postData: this.#getReportPostData(query),
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
      postData: this.#getReportPostData(query, shouldUseExactRange),
    })
    return getChartLineOptions(data, this.internalTemperaturesLegend, '°C')
  }

  public async getOperationModes(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<ReportChartPieOptions> {
    const postData = this.#getReportPostData(query, shouldUseExactRange)
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
        ...this.#getReportPostData(query, shouldUseExactRange),
        Location: this.registry.buildings.getById(this.device.buildingId)
          ?.location,
      },
    })
    return getChartLineOptions(data, this.temperaturesLegend, '°C')
  }

  protected prepareUpdateData(
    data: Partial<UpdateDeviceData<T>>,
  ): Required<UpdateDeviceData<T>> {
    return { ...this.setData, ...data }
  }

  /*
   * Combine individual field flags via bitwise OR to tell the API
   * which device settings were actually changed
   */
  #getFlags(keys: (keyof UpdateDeviceData<T>)[]): number {
    return Number(
      keys.reduce(
        (flag, key) => flag | BigInt(this.flags[key]),
        BigInt(FLAG_UNCHANGED),
      ),
    )
  }

  #getReportPostData(
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
}
