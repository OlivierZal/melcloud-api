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

const update = <T extends keyof typeof DeviceType>(
  model: DeviceModel<T>,
  data: GetDeviceData[T] | SetDeviceData[T],
): void => {
  model.update(data)
}

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
    update(this.model as DeviceModel<T>, data)
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

  public async set(postData: UpdateDeviceData[T]): Promise<SetDeviceData[T]> {
    const { EffectiveFlags: effectiveFlags, ...updateData } = postData
    if (effectiveFlags === FLAG_UNCHANGED || !Object.keys(updateData).length) {
      throw new Error('No changes to update')
    }
    const { data } = await this.api.set({
      heatPumpType: this.type,
      postData: {
        ...updateData,
        DeviceID: this.id,
        EffectiveFlags:
          typeof effectiveFlags === 'undefined' ?
            Object.keys(updateData).reduce(
              (acc, key) =>
                Number(
                  BigInt(
                    this.flags[key as NonFlagsKeyOf<UpdateDeviceData[T]>],
                  ) | BigInt(acc),
                ),
              FLAG_UNCHANGED,
            )
          : effectiveFlags,
      },
    })
    update(this.model as DeviceModel<T>, data)
    return data
  }
}
