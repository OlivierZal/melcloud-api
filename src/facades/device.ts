import { DeviceModel, type DeviceModelAny } from '../models'
import {
  type DeviceType,
  type EnergyData,
  FLAG_UNCHANGED,
  type GetDeviceData,
  type ListDevice,
  type SetDeviceData,
  type SetDeviceDataAtaInList,
  type TilesData,
  type UpdateDeviceData,
  type Values,
  flags,
  fromListToSetMappingAta,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import type API from '../services'
import BaseFacade from './base'
import type { IDeviceFacade } from './interfaces'

// @ts-expect-error: most runtimes do not support natively
Symbol.metadata ??= Symbol('Symbol.metadata')
const valueSymbol = Symbol('value')

export const mapTo =
  <This extends { data: object }>(setData: string) =>
  (
    _target: unknown,
    context: ClassAccessorDecoratorContext<This>,
  ): ClassAccessorDecoratorResult<This, unknown> => ({
    get(this: This): unknown {
      const value = String(context.name)
      if (!(setData in this.data)) {
        throw new Error(`Cannot get value for ${value}`)
      }
      context.metadata[valueSymbol] ??= []
      const values = context.metadata[valueSymbol] as string[]
      if (!values.includes(value)) {
        values.push(value)
      }
      return this.data[setData as keyof typeof this.data]
    },
    set(): void {
      throw new Error(`Cannot set value for ${String(context.name)}`)
    },
  })

export default abstract class<T extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<T>
{
  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly modelClass = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  readonly #flags: Record<keyof UpdateDeviceData[T], number>

  readonly #type: T

  readonly #values: (keyof this)[]

  public constructor(api: API, model: DeviceModel<T>) {
    super(api, model as DeviceModelAny)
    this.#type = model.type
    this.#flags = flags[this.#type] as Record<keyof UpdateDeviceData[T], number>
    const prototype = Object.getPrototypeOf(this) as unknown
    Object.getOwnPropertyNames(prototype).forEach((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
      if (descriptor && typeof descriptor.get === 'function') {
        this.#initMetadata(name)
      }
    })
    this.#values = this.constructor[Symbol.metadata]?.[
      valueSymbol
    ] as (keyof this)[]
  }

  public get data(): ListDevice[T]['Device'] {
    return this.model.data
  }

  public get values(): Values[T] {
    return Object.fromEntries(this.#values.map((key) => [key, this[key]]))
  }

  get #setData(): UpdateDeviceData[T] {
    const entries =
      this.#type === 'Ata' ?
        (Object.entries(this.data).map(([key, value]) => [
          key in fromListToSetMappingAta ?
            fromListToSetMappingAta[key as keyof SetDeviceDataAtaInList]
          : key,
          value,
        ]) as [
          keyof UpdateDeviceData[T],
          UpdateDeviceData[T][keyof UpdateDeviceData[T]],
        ][])
      : Object.entries(this.data)
    return Object.fromEntries(
      entries.filter(([key]) => key in this.#flags),
    ) as UpdateDeviceData[T]
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
    if (this.#type === 'Erv') {
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

  public async set(data: UpdateDeviceData[T]): Promise<SetDeviceData[T]> {
    const { data: updatedData } = await this.api.set({
      heatPumpType: this.#type,
      postData: {
        ...this.#setData,
        ...data,
        DeviceID: this.id,
        EffectiveFlags: this.#getFlags(
          Object.keys(data) as (keyof UpdateDeviceData[T])[],
        ),
      },
    })
    this.model.update(this.#getUpdatedData(updatedData))
    return updatedData
  }

  #getFlags(keys: (keyof UpdateDeviceData[T])[]): number {
    return keys.reduce(
      (acc, key) => Number(BigInt(this.#flags[key]) | BigInt(acc)),
      FLAG_UNCHANGED,
    )
  }

  #getUpdatedData(data: SetDeviceData[T]): UpdateDeviceData[T] {
    const { EffectiveFlags: effectiveFlags, ...newData } = data
    return Object.fromEntries(
      Object.entries(newData).filter(
        ([key]) =>
          key in this.#flags &&
          Number(
            BigInt(this.#flags[key as keyof UpdateDeviceData[T]]) &
              BigInt(effectiveFlags),
          ),
      ),
    ) as UpdateDeviceData[T]
  }

  #initMetadata(name: string): unknown {
    return name in this ? this[name as keyof this] : null
  }
}
