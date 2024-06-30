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
  type Values,
  flags,
  setDataMapping,
  valueMapping,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import type API from '../services'
import BaseFacade from './base'
import { DeviceFacadeErv } from '.'
import type { IDeviceFacade } from './interfaces'

// @ts-expect-error: most runtimes do not support it natively
Symbol.metadata ??= Symbol('Symbol.metadata')

export const isValue = (
  _target: unknown,
  context: ClassGetterDecoratorContext,
): void => {
  context.metadata[Symbol('value')] ??= []
  ;(context.metadata as string[]).push(context.name as string)
}

const jsonify = (instance: object): Record<string, unknown> => {
  const values = instance.constructor[Symbol.metadata]?.[Symbol('value')] as
    | string[]
    | undefined
  if (!values) {
    throw new Error('No members marked with @values')
  }
  return values.reduce(
    (acc, key) => ({
      ...acc,
      [key]: instance[key as keyof typeof instance] as unknown,
    }),
    {},
  )
}

export default abstract class<T extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<T>
{
  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly modelClass = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  readonly #flags: Record<keyof Values[T], number>

  readonly #setDataMapping: Record<
    NonFlagsKeyOf<UpdateDeviceData[T]>,
    keyof Values[T]
  >

  readonly #type: T

  readonly #valueMapping: Record<
    keyof Values[T],
    NonFlagsKeyOf<UpdateDeviceData[T]>
  >

  public constructor(api: API, model: DeviceModel<T>) {
    super(api, model as DeviceModelAny)
    this.#type = model.type
    this.#flags = flags[this.#type] as Record<keyof Values[T], number>
    this.#setDataMapping = setDataMapping[this.#type] as Record<
      NonFlagsKeyOf<UpdateDeviceData[T]>,
      keyof Values[T]
    >
    this.#valueMapping = valueMapping[this.#type] as Record<
      keyof Values[T],
      NonFlagsKeyOf<UpdateDeviceData[T]>
    >
  }

  @isValue
  public get power(): boolean {
    return this.data.Power
  }

  public get data(): ListDevice[T]['Device'] {
    return this.model.data
  }

  public get values(): Values[T] {
    return jsonify(this)
  }

  get #setData(): Omit<UpdateDeviceData[T], 'EffectiveFlags'> {
    return Object.fromEntries(
      Object.entries(this.data).filter(([key]) => key in this.#setDataMapping),
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
    if (this instanceof DeviceFacadeErv) {
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
      (acc, key) => Number(BigInt(this.#flags[key]) | BigInt(acc)),
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
          BigInt(
            this.#flags[
              this.#setDataMapping[key as NonFlagsKeyOf<UpdateDeviceData[T]>]
            ],
          ) & BigInt(effectiveFlags),
        ),
      ),
    ) as Omit<UpdateDeviceData[T], 'EffectiveFlags'>
  }
}
