import { FLAG_UNCHANGED } from '../constants.js'
import { valueSymbol } from '../decorators/alias.js'
import { fetchDevices } from '../decorators/fetchDevices.js'
import { updateDevice } from '../decorators/updateDevice.js'
import { DeviceModel } from '../models/index.js'

import { BaseFacade } from './base.js'
import { DEFAULT_YEAR, fromListToSetAta, now } from './utils.js'

import type { DeviceType } from '../enums.js'
import type { DeviceModelAny } from '../models/interfaces.js'
import type {
  EnergyData,
  GetDeviceData,
  ListDevice,
  SetDeviceData,
  SetDeviceDataAtaInList,
  TilesData,
  UpdateDeviceData,
} from '../types/index.js'

import type { IDeviceFacade, Values } from './interfaces.js'
import type { FacadeManager } from './manager.js'

export abstract class BaseDeviceFacade<T extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<T>
{
  public readonly canCool: boolean = false

  public readonly hasZone2: boolean = false

  public readonly type: T

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly model = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  readonly #values: Set<keyof this>

  public abstract readonly flags: Record<keyof UpdateDeviceData[T], number>

  public constructor(manager: FacadeManager, instance: DeviceModel<T>) {
    super(manager, instance as DeviceModelAny)
    ;({ type: this.type } = instance)
    this.#initMetadata()
    this.#values = this.constructor[Symbol.metadata]?.[valueSymbol] as Set<
      keyof this
    >
  }

  public get data(): ListDevice[T]['Device'] {
    return this.instance.data
  }

  public get values(): Values[T] {
    return Object.fromEntries([...this.#values].map((key) => [key, this[key]]))
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

  public override async getTiles(select?: false): Promise<TilesData<null>>
  public override async getTiles(
    select: true | DeviceModel<T>,
  ): Promise<TilesData<T>>
  public override async getTiles(
    select: boolean | DeviceModel<T> = false,
  ): Promise<TilesData<T | null>> {
    return (
        select === false ||
          (select instanceof DeviceModel && select.id !== this.id)
      ) ?
        super.getTiles()
      : super.getTiles(this.instance as DeviceModel<T>)
  }

  @fetchDevices
  public async fetch(): Promise<ListDevice[T]['Device']> {
    return Promise.resolve(this.data)
  }

  @updateDevice
  public async get(): Promise<GetDeviceData[T]> {
    return (
      await this.api.get({
        params: { buildingId: this.instance.buildingId, id: this.id },
      })
    ).data as GetDeviceData[T]
  }

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

  #callProperty(name: keyof this): unknown {
    return this[name]
  }

  #getFlags(keys: (keyof UpdateDeviceData[T])[]): number {
    return keys.reduce(
      (acc, key) => Number(BigInt(this.flags[key]) | BigInt(acc)),
      FLAG_UNCHANGED,
    )
  }

  #initMetadata(): void {
    const prototype = Object.getPrototypeOf(this) as unknown
    Object.getOwnPropertyNames(prototype).forEach((name) => {
      if (
        typeof name === 'string' &&
        !['data', 'model', 'values'].includes(name)
      ) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
        if (descriptor && typeof descriptor.get === 'function') {
          this.#callProperty(name as keyof this)
        }
      }
    })
  }
}
