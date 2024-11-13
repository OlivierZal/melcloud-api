import { FLAG_UNCHANGED } from '../constants.js'
import { fetchDevices } from '../decorators/fetchDevices.js'
import { syncDevices } from '../decorators/syncDevices.js'
import { updateDevice } from '../decorators/updateDevice.js'
import { DeviceModel } from '../models/index.js'
import { DEFAULT_YEAR, fromListToSetAta, now } from '../utils.js'

import { BaseFacade } from './base.js'

import type { DeviceType } from '../enums.js'
import type { IDeviceModel, IDeviceModelAny } from '../models/interfaces.js'
import type {
  EnergyData,
  GetDeviceData,
  ListDevice,
  SetDeviceData,
  SetDeviceDataAtaInList,
  TilesData,
  UpdateDeviceData,
} from '../types/index.js'

import type { IDeviceFacade } from './interfaces.js'
import type { FacadeManager } from './manager.js'

export abstract class BaseDeviceFacade<T extends keyof typeof DeviceType>
  extends BaseFacade<IDeviceModelAny>
  implements IDeviceFacade<T>
{
  public readonly type: T

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly model = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  public abstract readonly flags: Record<keyof UpdateDeviceData[T], number>

  public constructor(manager: FacadeManager, instance: IDeviceModel<T>) {
    super(manager, instance as IDeviceModelAny)
    ;({ type: this.type } = instance)
  }

  public override get devices(): IDeviceModelAny[] {
    return [this.instance]
  }

  public get data(): ListDevice[T]['Device'] {
    return this.instance.data
  }

  protected get setData(): Required<UpdateDeviceData[T]> {
    return Object.fromEntries(
      (this.type === 'Ata' ?
        (Object.entries(this.data).map(([key, value]) => [
          key in fromListToSetAta ?
            fromListToSetAta[key as keyof SetDeviceDataAtaInList]
          : key,
          value,
        ]) as [
          keyof UpdateDeviceData[T],
          UpdateDeviceData[T][keyof UpdateDeviceData[T]],
        ][])
      : Object.entries(this.data)
      ).filter(([key]) => key in this.flags),
    ) as Required<UpdateDeviceData[T]>
  }

  public override async onSync(): Promise<void> {
    await this.api.onSync?.(this.id)
  }

  public override async getTiles(select?: false): Promise<TilesData<null>>
  public override async getTiles(
    select: true | IDeviceModel<T>,
  ): Promise<TilesData<T>>
  public override async getTiles(
    select: boolean | IDeviceModel<T> = false,
  ): Promise<TilesData<T | null>> {
    return (
        select === false ||
          (select instanceof DeviceModel && select.id !== this.id)
      ) ?
        super.getTiles()
      : super.getTiles(this.instance as IDeviceModel<T>)
  }

  @fetchDevices
  public async fetch(): Promise<ListDevice[T]['Device']> {
    return Promise.resolve(this.data)
  }

  @syncDevices
  @updateDevice
  public async get(): Promise<GetDeviceData[T]> {
    return (
      await this.api.get({
        params: { buildingId: this.instance.buildingId, id: this.id },
      })
    ).data as GetDeviceData[T]
  }

  @syncDevices
  @updateDevice
  public async set(
    data: Partial<UpdateDeviceData[T]>,
  ): Promise<SetDeviceData[T]> {
    const newData = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) =>
          key in this.setData &&
          this.setData[key as keyof UpdateDeviceData[T]] !== value,
      ),
    ) as Partial<UpdateDeviceData[T]>
    const flags = this.#getFlags(
      Object.keys(newData) as (keyof UpdateDeviceData[T])[],
    )
    if (!flags) {
      throw new Error('No data to set')
    }
    return (
      await this.api.set({
        postData: {
          ...this.handle(newData),
          DeviceID: this.id,
          EffectiveFlags: flags,
        },
        type: this.type,
      })
    ).data
  }

  public async getEnergyReport({
    from,
    to,
  }: {
    from?: string
    to?: string
  }): Promise<EnergyData[T]> {
    if (this.type === 'Erv') {
      throw new Error('Erv devices do not support energy reports')
    }
    return (
      await this.api.getEnergyReport({
        postData: {
          DeviceID: this.id,
          FromDate: from ?? DEFAULT_YEAR,
          ToDate: to ?? now(),
        },
      })
    ).data as EnergyData[T]
  }

  protected handle(data: Partial<UpdateDeviceData[T]>): UpdateDeviceData[T] {
    return { ...this.setData, ...data }
  }

  #getFlags(keys: (keyof UpdateDeviceData[T])[]): number {
    return keys.reduce(
      (acc, key) => Number(BigInt(this.flags[key]) | BigInt(acc)),
      FLAG_UNCHANGED,
    )
  }
}
