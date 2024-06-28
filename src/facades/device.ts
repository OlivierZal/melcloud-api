import { DeviceModel, type DeviceModelAny } from '../models'
import {
  type DeviceType,
  type EnergyData,
  FLAG_UNCHANGED,
  type GetDeviceData,
  type ListDevice,
  type NonFlagsKeyOf,
  type SetDeviceData,
  type SetKeys,
  type TilesData,
  type UpdateDeviceData,
  flags,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import type API from '../services'
import BaseFacade from './base'
import type { IDeviceFacade } from './interfaces'

const reverse = <T extends keyof typeof DeviceType>(
  mapping: Record<keyof SetKeys[T], NonFlagsKeyOf<UpdateDeviceData[T]>>,
): Record<NonFlagsKeyOf<UpdateDeviceData[T]>, keyof SetKeys[T]> =>
  Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => [value, key]),
  ) as Record<NonFlagsKeyOf<UpdateDeviceData[T]>, keyof SetKeys[T]>

export default abstract class<T extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<T>
{
  public readonly flags: Record<keyof SetKeys[T], number>

  public readonly type: T

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly modelClass = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  readonly #dataMapping: Record<
    NonFlagsKeyOf<UpdateDeviceData[T]>,
    keyof SetKeys[T]
  >

  protected abstract setKeys: Record<
    keyof SetKeys[T],
    NonFlagsKeyOf<UpdateDeviceData[T]>
  >

  public constructor(api: API, model: DeviceModel<T>) {
    super(api, model as DeviceModelAny)
    this.type = this.model.type as T
    this.flags = flags[this.type] as Record<keyof SetKeys[T], number>
    this.#dataMapping = reverse(this.setKeys)
  }

  public get data(): ListDevice[T]['Device'] {
    return this.model.data
  }

  get #setData(): Omit<UpdateDeviceData[T], 'EffectiveFlags'> {
    return Object.fromEntries(
      Object.entries(this.data).filter(
        ([key]) => this.#dataMapping[key] in this.setKeys,
      ),
    ) as Omit<UpdateDeviceData[T], 'EffectiveFlags'>
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

  public async set(setKeys: SetKeys[T]): Promise<SetDeviceData[T]> {
    if (!Object.keys(setKeys).length) {
      throw new Error('No changes to update')
    }
    const updateData = {
      ...Object.fromEntries(
        Object.entries(setKeys).map(([key, value]) => [
          this.setKeys[key as keyof SetKeys[T]],
          value,
        ]),
      ),
    }
    const { data } = await this.api.set({
      heatPumpType: this.type,
      postData: {
        ...this.#setData,
        ...updateData,
        DeviceID: this.id,
        EffectiveFlags: this.#getFlags(setKeys),
      },
    })
    this.model.update(this.#getUpdatedData(data))
    return data
  }

  #getFlags(setKeys: SetKeys[T]): number {
    return (Object.keys(setKeys) as (keyof SetKeys[T])[]).reduce(
      (acc, key) => Number(BigInt(this.flags[key]) | BigInt(acc)),
      FLAG_UNCHANGED,
    )
  }

  #getUpdatedData(
    data: SetDeviceData[T],
  ): Omit<UpdateDeviceData[T], 'EffectiveFlags'> {
    const { EffectiveFlags: effectiveFlags, ...newData } = data
    return Object.fromEntries(
      Object.entries(newData).filter(([key]) =>
        Number(
          BigInt(this.flags[this.#dataMapping[key]]) & BigInt(effectiveFlags),
        ),
      ),
    ) as Omit<UpdateDeviceData[T], 'EffectiveFlags'>
  }
}
