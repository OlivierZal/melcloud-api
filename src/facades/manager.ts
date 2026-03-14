import type { DeviceType } from '../enums.ts'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
  IModel,
  ModelRegistry,
} from '../models/index.ts'
import type { IAPIAdapter } from '../services/index.ts'

import type {
  IBuildingFacade,
  IDeviceFacade,
  IDeviceFacadeAny,
  IFacade,
  IFacadeManager,
  ISuperDeviceFacade,
} from './interfaces.ts'

import { createFacade } from './factory.ts'

/**
 * Lazily creates and caches facade instances using a WeakMap keyed by model reference.
 * Ensures each model instance maps to exactly one facade throughout its lifetime.
 */
export class FacadeManager implements IFacadeManager {
  readonly #api: IAPIAdapter

  readonly #facades = new WeakMap<IModel, IFacade>()

  readonly #registry: ModelRegistry

  public constructor(api: IAPIAdapter, registry: ModelRegistry) {
    this.#api = api
    this.#registry = registry
  }

  public get<T extends DeviceType>(instance: IDeviceModel<T>): IDeviceFacade<T>
  public get(instance: IAreaModel | IFloorModel): ISuperDeviceFacade
  public get(instance: IBuildingModel): IBuildingFacade
  public get(instance: IDeviceModelAny): IDeviceFacadeAny
  public get(instance: IModel): IFacade
  public get(): null
  public get<T extends DeviceType>(
    instance?: IDeviceModel<T>,
  ): IDeviceFacade<T> | null
  public get(instance?: IAreaModel | IFloorModel): ISuperDeviceFacade | null
  public get(instance?: IBuildingModel): IBuildingFacade | null
  public get(instance?: IDeviceModelAny): IDeviceFacadeAny | null
  public get(instance?: IModel): IFacade | null {
    if (instance) {
      if (!this.#facades.has(instance)) {
        this.#facades.set(
          instance,
          createFacade(this.#api, this.#registry, instance),
        )
      }
      return this.#facades.get(instance) ?? null
    }
    return null
  }
}
