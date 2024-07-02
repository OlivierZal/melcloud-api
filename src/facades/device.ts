import { DeviceModel, type DeviceModelAny } from '../models'
import {
  type DeviceType,
  type EnergyData,
  FLAG_UNCHANGED,
  type GetDeviceData,
  type ListDevice,
  type ListDeviceDataAny,
  type NonFlagsKeyOf,
  type SetDeviceData,
  type TilesData,
  type UpdateDeviceData,
  type Values,
  flags,
  keys,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import type API from '../services'
import BaseFacade from './base'
import type { IDeviceFacade } from './interfaces'

// @ts-expect-error: most runtimes do not support it natively
Symbol.metadata ??= Symbol('Symbol.metadata')
const keySymbol = Symbol('value')
const setDataSymbol = Symbol('setData')

export const mapTo =
  <This extends { data: ListDeviceDataAny }>(setData: string) =>
  (
    _target: unknown,
    context: ClassAccessorDecoratorContext<This>,
  ): ClassAccessorDecoratorResult<This, unknown> => ({
    get(this: This): unknown {
      const key = String(context.name)
      context.metadata[keySymbol] ??= {}
      ;(context.metadata[keySymbol] as Record<string, string>)[key] = setData
      context.metadata[setDataSymbol] ??= {}
      ;(context.metadata[setDataSymbol] as Record<string, string>)[setData] =
        key
      if (!(setData in this.data)) {
        throw new Error(`Cannot get value for ${key}`)
      }
      return this.data[setData as keyof ListDeviceDataAny]
    },
    set(this: This, _value: unknown): void {
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

  readonly #flags: Record<NonFlagsKeyOf<UpdateDeviceData[T]>, number>

  readonly #type: T

  public constructor(api: API, model: DeviceModel<T>) {
    super(api, model as DeviceModelAny)
    this.#type = model.type
    this.#flags = flags[this.#type] as Record<
      NonFlagsKeyOf<UpdateDeviceData[T]>,
      number
    >
    keys[this.#type]
      .filter((key) => key in this)
      .forEach((key) => this[key as keyof typeof this])
  }

  @mapTo('Power')
  public accessor power: unknown = false

  public get data(): ListDevice[T]['Device'] {
    return this.model.data
  }

  public get values(): Values[T] {
    return Object.fromEntries(
      Object.keys(
        this.constructor[Symbol.metadata]?.[keySymbol] as Record<
          string,
          string
        >,
      )
        .filter((key) => key in this)
        .map((key) => [key, this[key as keyof typeof this]]),
    )
  }

  get #setData(): Omit<UpdateDeviceData[T], 'EffectiveFlags'> {
    return Object.fromEntries(
      Object.entries(this.data).filter(([key]) => key in this.#setDataMapping),
    ) as Omit<UpdateDeviceData[T], 'EffectiveFlags'>
  }

  get #setDataMapping(): Record<
    NonFlagsKeyOf<UpdateDeviceData[T]>,
    keyof Values[T]
  > {
    return this.constructor[Symbol.metadata]?.[setDataSymbol] as Record<
      NonFlagsKeyOf<UpdateDeviceData[T]>,
      keyof Values[T]
    >
  }

  get #valueMapping(): Record<
    keyof Values[T],
    NonFlagsKeyOf<UpdateDeviceData[T]>
  > {
    return this.constructor[Symbol.metadata]?.[keySymbol] as Record<
      keyof Values[T],
      NonFlagsKeyOf<UpdateDeviceData[T]>
    >
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

  public async set(values: Values[T]): Promise<SetDeviceData[T]> {
    if (!Object.keys(values).length) {
      throw new Error('No changes to update')
    }
    const updateData = {
      ...Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          this.#valueMapping[key as keyof Values[T]],
          value,
        ]),
      ),
    }
    const { data } = await this.api.set({
      heatPumpType: this.#type,
      postData: {
        ...this.#setData,
        ...updateData,
        DeviceID: this.id,
        EffectiveFlags: this.#getFlags(values),
      },
    })
    this.model.update(this.#getUpdatedData(data))
    return data
  }

  #getFlags(values: Values[T]): number {
    return (Object.keys(values) as (keyof Values[T])[]).reduce(
      (acc, key) =>
        Number(BigInt(this.#flags[this.#valueMapping[key]]) | BigInt(acc)),
      FLAG_UNCHANGED,
    )
  }

  #getUpdatedData(
    data: SetDeviceData[T],
  ): Omit<UpdateDeviceData[T], 'EffectiveFlags'> {
    const { EffectiveFlags: effectiveFlags, ...newData } = data
    return Object.fromEntries(
      Object.entries(newData).filter(
        ([key]) =>
          key in this.#setDataMapping &&
          Number(
            BigInt(this.#flags[key as NonFlagsKeyOf<UpdateDeviceData[T]>]) &
              BigInt(effectiveFlags),
          ),
      ),
    ) as Omit<UpdateDeviceData[T], 'EffectiveFlags'>
  }
}
