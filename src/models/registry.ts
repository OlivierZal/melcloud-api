import type {
  AreaDataAny,
  AreaZone,
  BuildingData,
  BuildingZone,
  DeviceZone,
  FloorData,
  FloorZone,
  ListDeviceAny,
  Zone,
} from '../types/index.ts'

import { DeviceType } from '../constants.ts'

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

const createDeviceModel = (device: ListDeviceAny): DeviceModelAny => {
  switch (device.Type) {
    case DeviceType.Ata: {
      return new DeviceModel(device)
    }
    case DeviceType.Atw: {
      return new DeviceModel(device)
    }
    case DeviceType.Erv: {
      return new DeviceModel(device)
    }
    default: {
      throw new Error(`Unsupported device type: ${String(device.Type)}`)
    }
  }
}

const BUILDING_LEVEL = 0
const CHILD_LEVEL = 1
const GRANDCHILD_LEVEL = 2
const GREAT_GRANDCHILD_LEVEL = 3

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const buildDeviceZones = (
  devices: DeviceModelAny[],
  type?: DeviceType,
): DeviceZone[] => {
  const filtered =
    type === undefined ? devices : (
      devices.filter(({ type: deviceType }) => deviceType === type)
    )
  return filtered
    .map(({ areaId, floorId, id, name }) => ({
      id,
      level:
        areaId !== null && floorId !== null ? GREAT_GRANDCHILD_LEVEL
        : areaId !== null || floorId !== null ? GRANDCHILD_LEVEL
        : CHILD_LEVEL,
      model: 'devices' as const,
      name,
    }))
    .toSorted(compareNames)
}

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

  /** Build a hierarchical zone structure from the registry, optionally filtered by device type. */
  public getBuildings({ type }: { type?: DeviceType } = {}): BuildingZone[] {
    return [...this.#buildings.values()]
      .filter((building) => this.#hasDevices(building.id, 'building', type))
      .map((building) => ({
        areas: this.#buildAreaZones(
          this.getAreasByBuildingId(building.id).filter(
            ({ floorId }) => floorId === null,
          ),
          CHILD_LEVEL,
          type,
        ),
        devices: buildDeviceZones(
          this.getDevicesByBuildingId(building.id).filter(
            ({ areaId, floorId }) => areaId === null && floorId === null,
          ),
          type,
        ),
        floors: this.#buildFloorZones(
          this.getFloorsByBuildingId(building.id),
          type,
        ),
        id: building.id,
        level: BUILDING_LEVEL,
        model: 'buildings' as const,
        name: building.name,
      }))
      .toSorted(compareNames)
  }

  /** Flatten the building hierarchy into a sorted list of all zones. */
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

  public getZones({ type }: { type?: DeviceType } = {}): Zone[] {
    return this.getBuildings({ type })
      .flatMap((building): Zone[] => [
        building,
        ...building.devices,
        ...building.areas.flatMap((area): Zone[] => [area, ...area.devices]),
        ...building.floors.flatMap((floor): Zone[] => [
          floor,
          ...floor.devices,
          ...floor.areas.flatMap((floorArea): Zone[] => [
            floorArea,
            ...floorArea.devices,
          ]),
        ]),
      ])
      .toSorted(compareNames)
  }

  public syncAreas(areas: AreaDataAny[]): void {
    this.#areas.clear()
    const models = areas.map((area) => {
      const model = new AreaModel(area)
      this.#areas.set(area.ID, model)
      return model
    })
    this.#areasByBuildingId = Map.groupBy(
      models,
      ({ buildingId }) => buildingId,
    )
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
      const model = createDeviceModel(device)
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

  #buildAreaZones(
    areas: AreaModelContract[],
    level: number,
    type?: DeviceType,
  ): AreaZone[] {
    return areas
      .filter((area) => this.#hasDevices(area.id, 'area', type))
      .map((area) => ({
        devices: buildDeviceZones(this.getDevicesByAreaId(area.id), type),
        id: area.id,
        level,
        model: 'areas' as const,
        name: area.name,
      }))
      .toSorted(compareNames)
  }

  #buildFloorZones(
    floors: FloorModelContract[],
    type?: DeviceType,
  ): FloorZone[] {
    return floors
      .filter((floor) => this.#hasDevices(floor.id, 'floor', type))
      .map((floor) => ({
        areas: this.#buildAreaZones(
          this.getAreasByFloorId(floor.id),
          GRANDCHILD_LEVEL,
          type,
        ),
        devices: buildDeviceZones(
          this.getDevicesByFloorId(floor.id).filter(
            ({ areaId }) => areaId === null,
          ),
          type,
        ),
        id: floor.id,
        level: CHILD_LEVEL,
        model: 'floors' as const,
        name: floor.name,
      }))
      .toSorted(compareNames)
  }

  #hasDevices(
    id: number,
    zone: 'area' | 'building' | 'floor',
    type?: DeviceType,
  ): boolean {
    const devices =
      zone === 'building' ? this.getDevicesByBuildingId(id)
      : zone === 'floor' ? this.getDevicesByFloorId(id)
      : this.getDevicesByAreaId(id)
    return type === undefined ?
        Boolean(devices.length)
      : devices.some(({ type: deviceType }) => deviceType === type)
  }
}
