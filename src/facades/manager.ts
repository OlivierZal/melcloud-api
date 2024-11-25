import { createFacade } from './factory.js'

import type { DeviceType } from '../enums.js'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
  IModel,
} from '../models/interfaces.js'
import type { API } from '../services/api.js'

import type {
  IBuildingFacade,
  IDeviceFacadeAny,
  IDeviceFacadeAta,
  IDeviceFacadeAtw,
  IFacade,
  IFacadeManager,
  ISuperDeviceFacade,
} from './interfaces.js'

export class FacadeManager implements IFacadeManager {
  readonly #api: API

  readonly #facades = new Map<string, IFacade>()

  public constructor(api: API) {
    this.#api = api
  }

  public get(instance: IAreaModel | IFloorModel): ISuperDeviceFacade
  public get(instance: IBuildingModel): IBuildingFacade
  public get(instance: IDeviceModel<DeviceType.Ata>): IDeviceFacadeAta
  public get(instance: IDeviceModel<DeviceType.Atw>): IDeviceFacadeAtw
  public get(instance: IDeviceModel<DeviceType.Ata>): IDeviceFacadeAta
  public get(instance: IDeviceModelAny): IDeviceFacadeAny
  public get(instance: IModel): IFacade
  public get(): undefined
  public get(
    instance?: IAreaModel | IFloorModel,
  ): ISuperDeviceFacade | undefined
  public get(instance?: IBuildingModel): IBuildingFacade | undefined
  public get(
    instance?: IDeviceModel<DeviceType.Ata>,
  ): IDeviceFacadeAta | undefined
  public get(
    instance?: IDeviceModel<DeviceType.Atw>,
  ): IDeviceFacadeAtw | undefined
  public get(
    instance?: IDeviceModel<DeviceType.Ata>,
  ): IDeviceFacadeAta | undefined
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
