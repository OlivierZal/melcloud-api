import { DeviceModel, type DeviceModelAny } from '../models'
import {
  type DeviceType,
  type EnergyData,
  FLAG_UNCHANGED,
  FanSpeed,
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
    return (
      await this.api.get({
        params: { buildingId: this.model.buildingId, id: this.id },
      })
    ).data as GetDeviceData[T]
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
    let newFlags =
      typeof effectiveFlags === 'undefined' ?
        Object.keys(updateData).reduce<number>(
          (acc, key) =>
            acc | this.flags[key as NonFlagsKeyOf<UpdateDeviceData[T]>],
          FLAG_UNCHANGED,
        )
      : effectiveFlags
    if (
      'SetFanSpeed' in updateData &&
      updateData.SetFanSpeed === FanSpeed.silent &&
      'SetFanSpeed' in this.flags &&
      typeof this.flags.SetFanSpeed !== 'undefined' &&
      this.flags.SetFanSpeed !== null
    ) {
      newFlags &= ~this.flags.SetFanSpeed
    }
    return (
      await this.api.set({
        heatPumpType: this.type,
        postData: {
          ...updateData,
          DeviceID: this.id,
          EffectiveFlags: newFlags,
        },
      })
    ).data
  }
}
