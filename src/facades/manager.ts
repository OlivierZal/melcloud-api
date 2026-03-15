import type { DeviceType } from '../constants.ts'
import type { ModelRegistry } from '../models/index.ts'
import type {
  AreaModel,
  BuildingModel,
  DeviceModel,
  DeviceModelAny,
  FloorModel,
  Model,
} from '../models/interfaces.ts'
import type { APIAdapter } from '../services/index.ts'
import type { BuildingZone, Zone } from '../types/index.ts'

import type {
  BuildingFacade,
  DeviceFacade,
  DeviceFacadeAny,
  Facade,
  FacadeManager as FacadeManagerContract,
  SuperDeviceFacade,
} from './interfaces.ts'

import { createFacade } from './factory.ts'

/**
 * Lazily creates and caches facade instances using a WeakMap keyed by model reference.
 * Ensures each model instance maps to exactly one facade throughout its lifetime.
 */
export class FacadeManager implements FacadeManagerContract {
  readonly #api: APIAdapter

  readonly #facades = new WeakMap<Model, Facade>()

  readonly #registry: ModelRegistry

  public constructor(api: APIAdapter, registry: ModelRegistry) {
    this.#api = api
    this.#registry = registry
  }

  public get<T extends DeviceType>(instance: DeviceModel<T>): DeviceFacade<T>
  public get(instance: AreaModel | FloorModel): SuperDeviceFacade
  public get(instance: BuildingModel): BuildingFacade
  public get(instance: DeviceModelAny): DeviceFacadeAny
  public get(instance: Model): Facade
  public get(): null
  public get<T extends DeviceType>(
    instance?: DeviceModel<T>,
  ): DeviceFacade<T> | null
  public get(instance?: AreaModel | FloorModel): SuperDeviceFacade | null
  public get(instance?: BuildingModel): BuildingFacade | null
  public get(instance?: DeviceModelAny): DeviceFacadeAny | null
  public get(instance?: Model): Facade | null {
    if (instance) {
      let facade = this.#facades.get(instance)
      if (!facade) {
        facade = createFacade(this.#api, this.#registry, instance)
        this.#facades.set(instance, facade)
      }
      return facade
    }
    return null
  }

  public getBuildings(params?: { type?: DeviceType }): BuildingZone[] {
    return this.#registry.getBuildings(params)
  }

  public getZones(params?: { type?: DeviceType }): Zone[] {
    return this.#registry.getZones(params)
  }
}
