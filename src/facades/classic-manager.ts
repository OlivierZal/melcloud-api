import type { ClassicAPIAdapter } from '../api/index.ts'
import type { ClassicDeviceType } from '../constants.ts'
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
  ZoneFacade,
} from './interfaces.ts'
import { createFacade } from './factory.ts'

/**
 * Lazily creates and caches facade instances using a WeakMap keyed by model reference.
 * Ensures each model instance maps to exactly one facade throughout its lifetime.
 */
export class ClassicFacadeManager {
  readonly #api: ClassicAPIAdapter

  readonly #facades = new WeakMap<Model, Facade>()

  readonly #registry: ClassicRegistry

  public constructor(api: ClassicAPIAdapter, registry: ClassicRegistry) {
    this.#api = api
    this.#registry = registry
  }

  public get<T extends ClassicDeviceType>(instance: Device<T>): DeviceFacade<T>
  public get(instance: Area | Floor): ZoneFacade
  public get(instance: Building): BuildingFacade
  public get(instance: DeviceAny): DeviceFacadeAny
  public get(instance: Model): Facade
  public get(): null
  public get<T extends ClassicDeviceType>(
    instance?: Device<T>,
  ): DeviceFacade<T> | null
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

  public getBuildings(params?: { type?: ClassicDeviceType }): BuildingZone[] {
    return this.#registry.getBuildings(params)
  }

  public getZones(params?: { type?: ClassicDeviceType }): Zone[] {
    return this.#registry.getZones(params)
  }
}
