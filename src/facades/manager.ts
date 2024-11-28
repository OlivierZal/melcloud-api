import { createFacade } from './factory.ts'

import type { DeviceType } from '../enums.ts'
import type { IAPI } from '../main.ts'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
  IModel,
} from '../models/interfaces.ts'

import type {
  IBuildingFacade,
  IDeviceFacade,
  IDeviceFacadeAny,
  IFacade,
  IFacadeManager,
  ISuperDeviceFacade,
} from './interfaces.ts'

export class FacadeManager implements IFacadeManager {
  readonly #api: IAPI

  readonly #facades = new Map<string, IFacade>()

  public constructor(api: IAPI) {
    this.#api = api
  }

  public get<T extends DeviceType>(instance: IDeviceModel<T>): IDeviceFacade<T>
  public get(instance: IAreaModel | IFloorModel): ISuperDeviceFacade
  public get(instance: IBuildingModel): IBuildingFacade
  public get(instance: IDeviceModelAny): IDeviceFacadeAny
  public get(instance: IModel): IFacade
  public get(): undefined
  public get<T extends DeviceType>(
    instance?: IDeviceModel<T>,
  ): IDeviceFacade<T> | undefined
  public get(
    instance?: IAreaModel | IFloorModel,
  ): ISuperDeviceFacade | undefined
  public get(instance?: IBuildingModel): IBuildingFacade | undefined
  public get(instance?: IDeviceModelAny): IDeviceFacadeAny | undefined
  public get(instance?: IModel): IFacade | undefined {
    if (instance) {
      const {
        constructor: { name },
        id,
      } = instance
      const facadeId = `${name}:${String(id)}`
      if (!this.#facades.has(facadeId)) {
        this.#facades.set(facadeId, createFacade(this.#api, instance))
      }
      return this.#facades.get(facadeId)
    }
  }
}
