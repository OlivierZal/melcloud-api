import { DeviceModel, type DeviceModelAny } from '../models'
import {
  type DeviceType,
  type EnergyData,
  FLAG_UNCHANGED,
  FanSpeed,
  type GetDeviceData,
  type ListDevice,
  type NonEffectiveFlagsKeyOf,
  type SetDeviceData,
  type TilesData,
  type UpdateDeviceData,
  effectiveFlagsAta,
  effectiveFlagsAtw,
  effectiveFlagsErv,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import type API from '../services'
import BaseFacade from './base'
import type { IDeviceFacade } from './interfaces'

export default class<T extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<T>
{
  public readonly type: T

  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly modelClass = DeviceModel<T>

  protected readonly tableName = 'DeviceLocation'

  readonly #effectiveFlagsMapping: Record<
    NonEffectiveFlagsKeyOf<UpdateDeviceData[T]>,
    number
  >

  public constructor(api: API, id: number) {
    super(api, id)
    this.type = this.model.type as T
    switch (this.type) {
      case 'Ata':
        this.#effectiveFlagsMapping = effectiveFlagsAta
        break
      case 'Atw':
        this.#effectiveFlagsMapping = effectiveFlagsAtw
        break
      case 'Erv':
        this.#effectiveFlagsMapping = effectiveFlagsErv
        break
      default:
        throw new Error('Invalid device type')
    }
  }

  public get data(): ListDevice[T]['Device'] {
    return this.model.data
  }

  public async fetch(): Promise<ListDevice[T]['Device']> {
    await this.api.sync()
    return this.data
  }

  public async get(): Promise<GetDeviceData[T]> {
    return (
      await this.api.getDevice({
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

  public async getTile(select?: false): Promise<TilesData<null>>
  public async getTile(select: true): Promise<TilesData<T>>
  public async getTile(select = false): Promise<TilesData<T | null>> {
    return select ?
        ((
          await this.api.getTiles({
            postData: {
              DeviceIDs: [this.id],
              SelectedBuilding: this.model.buildingId,
              SelectedDevice: this.id,
            },
          })
        ).data as TilesData<T>)
      : (await this.api.getTiles({ postData: { DeviceIDs: [this.id] } })).data
  }

  public async set(postData: UpdateDeviceData[T]): Promise<SetDeviceData[T]> {
    const { EffectiveFlags: effectiveFlags, ...updateData } = postData
    let newEffectiveFlags =
      typeof effectiveFlags === 'undefined' ?
        Object.keys(updateData).reduce<number>(
          (acc, key) =>
            acc |
            this.#effectiveFlagsMapping[
              key as NonEffectiveFlagsKeyOf<UpdateDeviceData[T]>
            ],
          FLAG_UNCHANGED,
        )
      : effectiveFlags
    if (
      'SetFanSpeed' in updateData &&
      updateData.SetFanSpeed === FanSpeed.silent &&
      'SetFanSpeed' in this.#effectiveFlagsMapping &&
      typeof this.#effectiveFlagsMapping.SetFanSpeed !== 'undefined' &&
      this.#effectiveFlagsMapping.SetFanSpeed !== null
    ) {
      newEffectiveFlags &= ~this.#effectiveFlagsMapping.SetFanSpeed
    }
    return (
      await this.api.setDevice({
        heatPumpType: this.type,
        postData: {
          ...updateData,
          DeviceID: this.id,
          EffectiveFlags: newEffectiveFlags,
        },
      })
    ).data
  }
}
