import type { APIAdapter } from '../api/index.ts'
import type { DeviceType } from '../constants.ts'
import type {
  Area,
  Building,
  ClassicRegistry,
  Device,
  DeviceAny,
  Floor,
  Model,
} from '../models/index.ts'
import type { BuildingZone, Zone } from '../types/index.ts'
import type {
  BuildingFacade,
  DeviceFacade,
  DeviceFacadeAny,
  Facade,
  FacadeManager as FacadeManagerContract,
  ZoneFacade,
} from './interfaces.ts'
import { createFacade } from './factory.ts'

/**
 * Lazily creates and caches facade instances using a WeakMap keyed by model reference.
 * Ensures each model instance maps to exactly one facade throughout its lifetime.
 */
export class FacadeManager implements FacadeManagerContract {
  readonly #api: APIAdapter

  readonly #facades = new WeakMap<Model, Facade>()

  readonly #registry: ClassicRegistry

  public constructor(api: APIAdapter, registry: ClassicRegistry) {
    this.#api = api
    this.#registry = registry
  }

  public get<T extends DeviceType>(instance: Device<T>): DeviceFacade<T>
  public get(instance: Area | Floor): ZoneFacade
  public get(instance: Building): BuildingFacade
  public get(instance: DeviceAny): DeviceFacadeAny
  public get(instance: Model): Facade
  public get(): null
  public get<T extends DeviceType>(instance?: Device<T>): DeviceFacade<T> | null
  public get(instance?: Area | Floor): ZoneFacade | null
  public get(instance?: Building): BuildingFacade | null
  public get(instance?: DeviceAny): DeviceFacadeAny | null
  public get(instance?: Model): Facade | null {
    if (!instance) {
      return null
    }
    let facade = this.#facades.get(instance)
    if (!facade) {
      facade = createFacade(this.#api, this.#registry, instance)
      this.#facades.set(instance, facade)
    }
    return facade
  }

  public getBuildings(params?: { type?: DeviceType }): BuildingZone[] {
    return this.#registry.getBuildings(params)
  }

  public getZones(params?: { type?: DeviceType }): Zone[] {
    return this.#registry.getZones(params)
  }
}
