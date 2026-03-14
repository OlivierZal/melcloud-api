import type { DeviceType } from '../enums.ts'
import type {
  AreaDataAny,
  BuildingData,
  FloorData,
  ListDeviceAny,
} from '../types/index.ts'

import type {
  AreaModel as AreaModelContract,
  BuildingModel as BuildingModelContract,
  DeviceModelAny,
  FloorModel as FloorModelContract,
} from './interfaces.ts'

import { AreaModel } from './area.ts'
import { BuildingModel } from './building.ts'
import { DeviceModel } from './device.ts'
import { FloorModel } from './floor.ts'

/**
 * Central in-memory registry of all MELCloud models (buildings, floors, areas, devices).
 * Synced from the API response and queryable by ID or parent relationship.
 */
export class ModelRegistry {

  /*
   * Public accessors expose readonly query interfaces over private maps,
   * preventing callers from clearing or replacing entire collections
   */
  readonly #areas = new Map<number, AreaModelContract>()

  public readonly areas = {
    getById: (id: number): AreaModelContract | undefined => this.#areas.get(id),
  }

  readonly #buildings = new Map<number, BuildingModelContract>()

  public readonly buildings = {
    getById: (id: number): BuildingModelContract | undefined =>
      this.#buildings.get(id),
  }

  readonly #devices = new Map<number, DeviceModelAny>()

  public readonly devices = {
    getById: (id: number): DeviceModelAny | undefined => this.#devices.get(id),
  }

  readonly #floors = new Map<number, FloorModelContract>()

  public readonly floors = {
    getById: (id: number): FloorModelContract | undefined => this.#floors.get(id),
  }

  public getAreasByBuildingId(id: number): AreaModelContract[] {
    return [...this.#areas.values()].filter(
      ({ buildingId }) => buildingId === id,
    )
  }

  public getAreasByFloorId(id: number): AreaModelContract[] {
    return [...this.#areas.values()].filter(({ floorId }) => floorId === id)
  }

  public getDevices(): DeviceModelAny[] {
    return [...this.#devices.values()]
  }

  public getDevicesByAreaId(id: number): DeviceModelAny[] {
    return [...this.#devices.values()].filter(({ areaId }) => areaId === id)
  }

  public getDevicesByBuildingId(id: number): DeviceModelAny[] {
    return [...this.#devices.values()].filter(
      ({ buildingId }) => buildingId === id,
    )
  }

  public getDevicesByFloorId(id: number): DeviceModelAny[] {
    return [...this.#devices.values()].filter(({ floorId }) => floorId === id)
  }

  public getDevicesByType<U extends DeviceType>(
    type: U,
  ): (DeviceModelAny & { type: U })[] {
    return this.getDevices().filter(
      (instance): instance is DeviceModelAny & { type: U } =>
        instance.type === type,
    )
  }

  public getFloorsByBuildingId(id: number): FloorModelContract[] {
    return [...this.#floors.values()].filter(
      ({ buildingId }) => buildingId === id,
    )
  }

  public syncAreas(areas: AreaDataAny[]): void {
    this.#areas.clear()
    for (const area of areas) {
      this.#areas.set(area.ID, new AreaModel(area))
    }
  }

  public syncBuildings(buildings: BuildingData[]): void {
    this.#buildings.clear()
    for (const building of buildings) {
      this.#buildings.set(building.ID, new BuildingModel(building))
    }
  }

  public syncDevices(devices: readonly ListDeviceAny[]): void {
    this.#devices.clear()
    for (const device of devices) {
      this.#devices.set(
        device.DeviceID,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DeviceModel instances are always one of the three DeviceType variants
        new DeviceModel(device) as DeviceModelAny,
      )
    }
  }

  public syncFloors(floors: FloorData[]): void {
    this.#floors.clear()
    for (const floor of floors) {
      this.#floors.set(floor.ID, new FloorModel(floor))
    }
  }
}
