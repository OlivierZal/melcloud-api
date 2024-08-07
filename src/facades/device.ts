import type API from '../services'
import type { IDeviceFacade } from './interfaces'

import { type DeviceModelAny, DeviceModel } from '../models'
import {
  type DeviceType,
  type EnergyData,
  type GetDeviceData,
  type KeysOfSetDeviceDataAtaNotInList,
  type ListDevice,
  type SetDeviceData,
  type SetDeviceDataAtaInList,
  type TilesData,
  type UpdateDeviceData,
  type Values,
  FLAG_UNCHANGED,
  FLAGS,
  FROM_LIST_TO_SET_ATA,
  FROM_SET_TO_LIST_ATA,
} from '../types'
import BaseFacade from './base'
import { YEAR_1970, nowISO } from './utils'

// @ts-expect-error: most runtimes do not support natively
Symbol.metadata ??= Symbol('Symbol.metadata')
const valueSymbol = Symbol('value')

export const alias =
  <This extends { canCool: boolean; data: object; hasZone2: boolean }>(
    key: string,
  ) =>
  (
    _target: unknown,
    context: ClassAccessorDecoratorContext<This>,
  ): ClassAccessorDecoratorResult<This, unknown> => ({
    get(this: This): unknown {
      const value = String(context.name)
      if (!(key in this.data)) {
        throw new Error(`Cannot get value for ${value}`)
      }
      if (
        (!value.includes('Cool') || this.canCool) &&
        (!value.includes('Zone2') || this.hasZone2)
      ) {
        context.metadata[valueSymbol] ??= []
        const values = context.metadata[valueSymbol] as string[]
        if (!values.includes(value)) {
          values.push(value)
        }
      }
      return this.data[key as keyof typeof this.data]
    },
    set(): void {
      throw new Error(`Cannot set value for ${String(context.name)}`)
    },
  })

const convertToListDeviceData = <T extends keyof typeof DeviceType>(
  instance: DeviceFacade<T>,
  data: SetDeviceData[T],
): Partial<ListDevice[T]['Device']> => {
  const { EffectiveFlags: flags, ...newData } = data
  const entries =
    flags === FLAG_UNCHANGED ?
      Object.entries(newData)
    : Object.entries(newData).filter(
        ([key]) =>
          key in instance.flags &&
          Number(
            BigInt(instance.flags[key as keyof UpdateDeviceData[T]]) &
              BigInt(flags),
          ),
      )
  return Object.fromEntries(
    instance.type === 'Ata' ?
      entries.map(([key, value]) =>
        key in FROM_SET_TO_LIST_ATA ?
          [FROM_SET_TO_LIST_ATA[key as KeysOfSetDeviceDataAtaNotInList], value]
        : [key, value],
      )
    : entries,
  ) as Partial<ListDevice[T]['Device']>
}

const updateDevice = <
  T extends keyof typeof DeviceType,
  DeviceData extends GetDeviceData[T] | SetDeviceData[T],
>(
  target: (...args: any[]) => Promise<DeviceData>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: unknown,
): ((...args: any[]) => Promise<DeviceData>) =>
  async function newTarget(this: DeviceFacade<T>, ...args: unknown[]) {
    const data = await target.call(this, ...args)
    ;(this.model as DeviceModel<T>).update(convertToListDeviceData(this, data))
    return data
  }

export default abstract class DeviceFacade<T extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<T>
{
  public readonly canCool: boolean = false

  public readonly flags: Record<keyof UpdateDeviceData[T], number>

  public readonly hasZone2: boolean = false

  public readonly type: T

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly modelClass = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  readonly #values: (keyof this)[]

  public constructor(api: API, model: DeviceModel<T>) {
    super(api, model as DeviceModelAny)
    this.type = model.type
    this.flags = FLAGS[this.type] as Record<keyof UpdateDeviceData[T], number>

    this.#initMetadata()
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

  protected get setData(): Required<UpdateDeviceData[T]> {
    return Object.fromEntries(
      (this.type === 'Ata' ?
        (Object.entries(this.data).map(([key, value]) => [
          key in FROM_LIST_TO_SET_ATA ?
            FROM_LIST_TO_SET_ATA[key as keyof SetDeviceDataAtaInList]
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

  @updateDevice
  public async get(): Promise<GetDeviceData[T]> {
    return (
      await this.api.get({
        params: { buildingId: this.model.buildingId, id: this.id },
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
        heatPumpType: this.type,
        postData: {
          ...this.handle(newData),
          DeviceID: this.id,
          EffectiveFlags: flags,
        },
      })
    ).data
  }

  public async fetch(): Promise<ListDevice[T]['Device']> {
    await this.api.fetch()
    return this.data
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
          FromDate: from ?? YEAR_1970,
          ToDate: to ?? nowISO(),
        },
      })
    ).data as EnergyData[T]
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
      : super.getTiles(this.model as DeviceModel<T>)
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
