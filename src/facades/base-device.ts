import { DateTime } from 'luxon'

import { FLAG_UNCHANGED } from '../constants.ts'
import { fetchDevices } from '../decorators/fetch-devices.ts'
import { syncDevices } from '../decorators/sync-devices.ts'
import { updateDevice } from '../decorators/update-devices.ts'
import { DeviceType } from '../enums.ts'
import { DeviceModel } from '../models/index.ts'
import {
  fromListToSetAta,
  getChartLineOptions,
  getChartPieOptions,
  isSetDeviceDataAtaInList,
  isUpdateDeviceData,
  now,
} from '../utils.ts'

import { BaseFacade } from './base.ts'

import type { IDeviceModel, IDeviceModelAny } from '../models/interfaces.ts'
import type { IAPI } from '../services/interfaces.ts'
import type {
  EnergyData,
  GetDeviceData,
  ListDeviceData,
  ReportPostData,
  SetDeviceData,
  TilesData,
  UpdateDeviceData,
} from '../types/common.js'

import type {
  IDeviceFacade,
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './interfaces.ts'

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

export abstract class BaseDeviceFacade<T extends DeviceType>
  extends BaseFacade<IDeviceModelAny>
  implements IDeviceFacade<T>
{
  public readonly type: T

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly internalTemperaturesLegend: (string | undefined)[] = []

  protected readonly model = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  public abstract readonly flags: Record<keyof UpdateDeviceData<T>, number>

  protected abstract readonly temperaturesLegend: (string | undefined)[]

  public constructor(api: IAPI, instance: IDeviceModel<T>) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    super(api, instance as IDeviceModelAny)
    ;({ type: this.type } = instance)
  }

  public override get devices(): IDeviceModelAny[] {
    return [this.instance]
  }

  public get data(): ListDeviceData<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return this.instance.data as ListDeviceData<T>
  }

  protected get setData(): Required<UpdateDeviceData<T>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return Object.fromEntries(
      (this.type === DeviceType.Ata ?
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (Object.entries(this.data).map(([key, value]) => [
          isSetDeviceDataAtaInList(key) ? fromListToSetAta[key] : key,
          value,
        ]) as [
          keyof UpdateDeviceData<T>,
          UpdateDeviceData<T>[keyof UpdateDeviceData<T>],
        ][])
      : Object.entries(this.data)
      ).filter(([key]) => key in this.flags),
    ) as Required<UpdateDeviceData<T>>
  }

  public override async tiles(select?: false): Promise<TilesData<null>>
  public override async tiles(
    select: true | IDeviceModel<T>,
  ): Promise<TilesData<T>>
  public override async tiles(
    select: boolean | IDeviceModel<T> = false,
  ): Promise<TilesData<T | null>> {
    return (
        select === false ||
          (select instanceof DeviceModel && select.id !== this.id)
      ) ?
        super.tiles()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      : super.tiles(this.instance as IDeviceModel<T>)
  }

  @fetchDevices
  public async fetch(): Promise<ListDeviceData<T>> {
    return Promise.resolve(this.data)
  }

  @syncDevices()
  @updateDevice
  public async setValues(
    data: Partial<UpdateDeviceData<T>>,
  ): Promise<SetDeviceData<T>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const newData = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) =>
          isUpdateDeviceData(this.setData, key) &&
          this.setData[key as keyof UpdateDeviceData<T>] !== value,
      ),
    ) as Partial<UpdateDeviceData<T>>
    const flags = this.#getFlags(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      Object.keys(newData) as (keyof UpdateDeviceData<T>)[],
    )
    if (!flags) {
      throw new Error('No data to set')
    }
    return (
      await this.api.setValues({
        postData: {
          ...this.handle(newData),
          DeviceID: this.id,
          EffectiveFlags: flags,
        },
        type: this.type,
      })
    ).data
  }

  @syncDevices()
  @updateDevice
  public async values(): Promise<GetDeviceData<T>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return (
      await this.api.values({
        params: { buildingId: this.instance.buildingId, id: this.id },
      })
    ).data as GetDeviceData<T>
  }

  public async energy(query?: ReportQuery): Promise<EnergyData<T>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return (
      await this.api.energy({
        postData: this.#getReportPostData(query),
      })
    ).data as EnergyData<T>
  }

  public async hourlyTemperatures(
    hour = DateTime.now().hour,
  ): Promise<ReportChartLineOptions> {
    return getChartLineOptions(
      (
        await this.api.hourlyTemperatures({
          postData: { device: this.id, hour },
        })
      ).data,
      this.internalTemperaturesLegend,
      '°C',
    )
  }

  public async internalTemperatures(
    query?: ReportQuery,
    useExactRange = true,
  ): Promise<ReportChartLineOptions> {
    return getChartLineOptions(
      (
        await this.api.internalTemperatures({
          postData: this.#getReportPostData(query, useExactRange),
        })
      ).data,
      this.internalTemperaturesLegend,
      '°C',
    )
  }

  public async operationModes(
    query?: ReportQuery,
    useExactRange = true,
  ): Promise<ReportChartPieOptions> {
    const postData = this.#getReportPostData(query, useExactRange)
    const { FromDate: from, ToDate: to } = postData
    return getChartPieOptions(
      (
        await this.api.operationModes({
          postData,
        })
      ).data,
      { from, to },
    )
  }

  public async temperatures(
    query?: ReportQuery,
    useExactRange = true,
  ): Promise<ReportChartLineOptions> {
    return getChartLineOptions(
      (
        await this.api.temperatures({
          postData: {
            ...this.#getReportPostData(query, useExactRange),
            Location: this.instance.building?.location,
          },
        })
      ).data,
      this.temperaturesLegend,
      '°C',
    )
  }

  protected handle(
    data: Partial<UpdateDeviceData<T>>,
  ): Required<UpdateDeviceData<T>> {
    return { ...this.setData, ...data }
  }

  #getFlags(keys: (keyof UpdateDeviceData<T>)[]): number {
    return keys.reduce(
      (acc, key) => Number(BigInt(this.flags[key]) | BigInt(acc)),
      FLAG_UNCHANGED,
    )
  }

  #getReportPostData(
    { from, to }: ReportQuery = {},
    useExactRange = false,
  ): ReportPostData {
    const { from: newFrom, to: newTo } = getReportPostDataDates({ from, to })
    return {
      DeviceID: this.id,
      Duration:
        useExactRange ? getDuration({ from: newFrom, to: newTo }) : undefined,
      FromDate: newFrom,
      ToDate: newTo,
    }
  }
}
