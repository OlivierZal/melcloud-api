import type { DeviceType } from '../enums.ts'
import type {
  AreaDataAny,
  BuildingData,
  FloorData,
  ListDeviceAny,
} from '../types/index.ts'

import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModelAny,
  IFloorModel,
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
  readonly #areas = new Map<number, IAreaModel>()

  public readonly areas = {
    getById: (id: number): IAreaModel | undefined => this.#areas.get(id),
  }

  readonly #buildings = new Map<number, IBuildingModel>()

  public readonly buildings = {
    getById: (id: number): IBuildingModel | undefined =>
      this.#buildings.get(id),
  }

  readonly #devices = new Map<number, IDeviceModelAny>()

  public readonly devices = {
    getById: (id: number): IDeviceModelAny | undefined => this.#devices.get(id),
  }

  readonly #floors = new Map<number, IFloorModel>()

  public readonly floors = {
    getById: (id: number): IFloorModel | undefined => this.#floors.get(id),
  }

  public getAllDevices(): IDeviceModelAny[] {
    return [...this.#devices.values()]
  }

  public getAreasByBuildingId(id: number): IAreaModel[] {
    return [...this.#areas.values()].filter(
      ({ buildingId }) => buildingId === id,
    )
  }

  public getAreasByFloorId(id: number): IAreaModel[] {
    return [...this.#areas.values()].filter(({ floorId }) => floorId === id)
  }

  public getDeviceById(id: number): IDeviceModelAny | undefined {
    return this.#devices.get(id)
  }

  public getDevicesByAreaId(id: number): IDeviceModelAny[] {
    return [...this.#devices.values()].filter(({ areaId }) => areaId === id)
  }

  public getDevicesByBuildingId(id: number): IDeviceModelAny[] {
    return [...this.#devices.values()].filter(
      ({ buildingId }) => buildingId === id,
    )
  }

  public getDevicesByFloorId(id: number): IDeviceModelAny[] {
    return [...this.#devices.values()].filter(({ floorId }) => floorId === id)
  }

  public getDevicesByType<U extends DeviceType>(
    type: U,
  ): (IDeviceModelAny & { type: U })[] {
    return this.getAllDevices().filter(
      (instance): instance is IDeviceModelAny & { type: U } =>
        instance.type === type,
    )
  }

  public getFloorsByBuildingId(id: number): IFloorModel[] {
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
        new DeviceModel(device) as IDeviceModelAny,
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
