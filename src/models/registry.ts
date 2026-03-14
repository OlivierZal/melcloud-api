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
   * Pre-computed indexes for O(1) lookups by parent relationship.
   * Public accessors expose readonly query interfaces over private maps,
   * preventing callers from clearing or replacing entire collections.
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
    getById: (id: number): FloorModelContract | undefined =>
      this.#floors.get(id),
  }

  #areasByBuildingId = new Map<number, AreaModelContract[]>()

  #areasByFloorId = new Map<number, AreaModelContract[]>()

  #devicesByAreaId = new Map<number, DeviceModelAny[]>()

  #devicesByBuildingId = new Map<number, DeviceModelAny[]>()

  #devicesByFloorId = new Map<number, DeviceModelAny[]>()

  #floorsByBuildingId = new Map<number, FloorModelContract[]>()

  public getAreasByBuildingId(id: number): AreaModelContract[] {
    return this.#areasByBuildingId.get(id) ?? []
  }

  public getAreasByFloorId(id: number): AreaModelContract[] {
    return this.#areasByFloorId.get(id) ?? []
  }

  public getDevices(): DeviceModelAny[] {
    return [...this.#devices.values()]
  }

  public getDevicesByAreaId(id: number): DeviceModelAny[] {
    return this.#devicesByAreaId.get(id) ?? []
  }

  public getDevicesByBuildingId(id: number): DeviceModelAny[] {
    return this.#devicesByBuildingId.get(id) ?? []
  }

  public getDevicesByFloorId(id: number): DeviceModelAny[] {
    return this.#devicesByFloorId.get(id) ?? []
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
    return this.#floorsByBuildingId.get(id) ?? []
  }

  public syncAreas(areas: AreaDataAny[]): void {
    this.#areas.clear()
    const models = areas.map((area) => {
      const model = new AreaModel(area)
      this.#areas.set(area.ID, model)
      return model
    })
    this.#areasByBuildingId = Map.groupBy(models, ({ buildingId }) => buildingId)
    this.#areasByFloorId = Map.groupBy(
      models.filter(
        (model): model is AreaModelContract & { floorId: number } =>
          model.floorId !== null,
      ),
      ({ floorId }) => floorId,
    )
  }

  public syncBuildings(buildings: BuildingData[]): void {
    this.#buildings.clear()
    for (const building of buildings) {
      this.#buildings.set(building.ID, new BuildingModel(building))
    }
  }

  public syncDevices(devices: readonly ListDeviceAny[]): void {
    this.#devices.clear()
    const models = devices.map((device) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DeviceModel instances are always one of the three DeviceType variants
      const model = new DeviceModel(device) as DeviceModelAny
      this.#devices.set(device.DeviceID, model)
      return model
    })
    this.#devicesByBuildingId = Map.groupBy(
      models,
      ({ buildingId }) => buildingId,
    )
    this.#devicesByFloorId = Map.groupBy(
      models.filter(
        (model): model is DeviceModelAny & { floorId: number } =>
          model.floorId !== null,
      ),
      ({ floorId }) => floorId,
    )
    this.#devicesByAreaId = Map.groupBy(
      models.filter(
        (model): model is DeviceModelAny & { areaId: number } =>
          model.areaId !== null,
      ),
      ({ areaId }) => areaId,
    )
  }

  public syncFloors(floors: FloorData[]): void {
    this.#floors.clear()
    const models = floors.map((floor) => {
      const model = new FloorModel(floor)
      this.#floors.set(floor.ID, model)
      return model
    })
    this.#floorsByBuildingId = Map.groupBy(
      models,
      ({ buildingId }) => buildingId,
    )
  }
}
