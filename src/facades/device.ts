import { DeviceModel, type DeviceModelAny } from '../models'
import {
  type DeviceType,
  type EnergyData,
  FLAG_UNCHANGED,
  type GetDeviceData,
  type ListDevice,
  type NonFlagsKeyOf,
  type SetDeviceData,
  type TilesData,
  type UpdateDeviceData,
  flags,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import type API from '../services'
import BaseFacade from './base'
import type { IDeviceFacade } from './interfaces'

export type DeviceFacadeAny =
  | DeviceFacade<'Ata'>
  | DeviceFacade<'Atw'>
  | DeviceFacade<'Erv'>

export default class DeviceFacade<T extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<T>
{
  public readonly flags: Record<NonFlagsKeyOf<UpdateDeviceData[T]>, number>

  public readonly type: T

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly modelClass = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  public constructor(api: API, model: DeviceModel<T>) {
    super(api, model as DeviceModelAny)
    this.type = this.model.type as T
    this.flags = flags[this.type]
  }

  public get data(): ListDevice[T]['Device'] {
    return this.model.data
  }

  public async fetch(): Promise<ListDevice[T]['Device']> {
    await this.api.fetch()
    return this.data
  }

  public async get(): Promise<GetDeviceData[T]> {
    const { data } = (await this.api.get({
      params: { buildingId: this.model.buildingId, id: this.id },
    })) as { data: GetDeviceData[T] }
    this.model.update(data as UpdateDeviceData[T])
    return data
  }

  public async getEnergyReport({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }): Promise<EnergyData[T]> {
    if (this.type === 'Erv') {
      throw new Error('Erv devices do not support energy reports')
    }
    return (
      await this.api.getEnergyReport({
        postData: {
          DeviceID: this.id,
          FromDate: from ?? YEAR_1970,
          ToDate: to ?? nowISO(),
        },
      })
    ).data as EnergyData[T]
  }

  public override async getTiles(
    select?: false | null,
  ): Promise<TilesData<null>>
  public override async getTiles(
    select: true | DeviceModel<T>,
  ): Promise<TilesData<T>>
  public override async getTiles(
    select: boolean | null | DeviceModel<T> = false,
  ): Promise<TilesData<T | null>> {
    if (select === true || select instanceof DeviceModel) {
      return super.getTiles(this.model as DeviceModel<T>)
    }
    return super.getTiles(null)
  }

  public async set(updateData: UpdateDeviceData[T]): Promise<SetDeviceData[T]> {
    const { EffectiveFlags: updateFlags, ...newData } = updateData
    if (updateFlags === FLAG_UNCHANGED || !Object.keys(newData).length) {
      throw new Error('No changes to update')
    }
    const { data } = await this.api.set({
      heatPumpType: this.type,
      postData: {
        ...newData,
        DeviceID: this.id,
        EffectiveFlags:
          typeof updateFlags === 'undefined' ?
            this.#getFlags(newData)
          : updateFlags,
      },
    })
    this.model.update(this.#getUpdatedData(data))
    return data
  }

  #getFlags(data: Omit<UpdateDeviceData[T], 'EffectiveFlags'>): number {
    return (Object.keys(data) as NonFlagsKeyOf<UpdateDeviceData[T]>[]).reduce(
      (acc, key) => Number(BigInt(this.flags[key]) | BigInt(acc)),
      FLAG_UNCHANGED,
    )
  }

  #getUpdatedData(
    data: SetDeviceData[T],
  ): Omit<UpdateDeviceData[T], 'EffectiveFlags'> {
    const { EffectiveFlags: updatedFlags, ...newData } = data
    return Object.fromEntries(
      Object.entries(newData).filter(
        ([key]) =>
          key in this.flags &&
          Number(
            BigInt(this.flags[key as NonFlagsKeyOf<UpdateDeviceData[T]>]) &
              BigInt(updatedFlags),
          ),
      ),
    ) as Omit<UpdateDeviceData[T], 'EffectiveFlags'>
  }
}
