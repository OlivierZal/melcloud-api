import type { ClassicAPIAdapter } from '../api/index.ts'
import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicArea,
  ClassicBuilding,
  ClassicDevice,
  ClassicDeviceAny,
  ClassicFloor,
  ClassicModel,
  ClassicRegistry,
} from '../entities/index.ts'
import type { ClassicBuildingZone, ClassicZone } from '../types/index.ts'
import type {
  ClassicBuildingFacade,
  ClassicDeviceFacade,
  ClassicDeviceFacadeAny,
  ClassicFacade,
  ClassicZoneFacade,
} from './classic-types.ts'
import { createFacade } from './classic-factory.ts'

/**
 * Lazily creates and caches facade instances using a WeakMap keyed by model reference.
 * Ensures each model instance maps to exactly one facade throughout its lifetime.
 */
export class ClassicFacadeManager {
  readonly #api: ClassicAPIAdapter

  readonly #facades = new WeakMap<ClassicModel, ClassicFacade>()

  readonly #registry: ClassicRegistry

  /**
   * Builds a facade manager bound to the given API client and registry;
   * facades it returns share these references.
   * @param api - Classic API client.
   * @param registry - Backing registry.
   */
  public constructor(api: ClassicAPIAdapter, registry: ClassicRegistry) {
    this.#api = api
    this.#registry = registry
  }

  /**
   * Returns the cached facade for the given model, lazily creating one
   * on first access; passing `undefined` returns `null`.
   * @param instance - Registry model to wrap, or `undefined`.
   * @returns The facade, or `null` when no instance was supplied.
   */
  public get<T extends ClassicDeviceType>(
    instance: ClassicDevice<T>,
  ): ClassicDeviceFacade<T>
  public get(instance: ClassicArea | ClassicFloor): ClassicZoneFacade
  public get(instance: ClassicBuilding): ClassicBuildingFacade
  public get(instance: ClassicDeviceAny): ClassicDeviceFacadeAny
  public get(instance: ClassicModel): ClassicFacade
  public get(): null
  public get<T extends ClassicDeviceType>(
    instance?: ClassicDevice<T>,
  ): ClassicDeviceFacade<T> | null
  public get(instance?: ClassicArea | ClassicFloor): ClassicZoneFacade | null
  public get(instance?: ClassicBuilding): ClassicBuildingFacade | null
  public get(instance?: ClassicDeviceAny): ClassicDeviceFacadeAny | null
  public get(instance?: ClassicModel): ClassicFacade | null {
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

  /**
   * Returns the registry's hierarchical building zone tree, optionally
   * filtered to a single device type.
   * @param params - Optional filter.
   * @param params.type - Restrict to a single device type.
   * @returns The building zone tree.
   */
  public getBuildings(params?: {
    type?: ClassicDeviceType
  }): ClassicBuildingZone[] {
    return this.#registry.getBuildings(params)
  }

  /**
   * Returns the flattened list of every registry zone (buildings, floors,
   * areas, devices), optionally filtered to a single device type.
   * @param params - Optional filter.
   * @param params.type - Restrict to a single device type.
   * @returns Every zone, name-sorted.
   */
  public getZones(params?: { type?: ClassicDeviceType }): ClassicZone[] {
    return this.#registry.getZones(params)
  }
}
