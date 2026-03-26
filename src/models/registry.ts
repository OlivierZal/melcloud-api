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
import type { DeviceModelAny } from './interfaces.ts'
import { AreaModel } from './area.ts'
import { BuildingModel } from './building.ts'
import { DeviceModel } from './device.ts'
import { FloorModel } from './floor.ts'
import { syncModel } from './symbols.ts'

/*
 * Upsert + prune: update existing models in-place, create new ones,
 * and remove stale entries. Preserves object identity across syncs
 * so that facade references remain valid.
 */
const syncMap = <TModel, TData>(
  map: Map<number, TModel>,
  items: readonly TData[],
  {
    create,
    getId,
    update,
  }: {
    create: (item: TData) => TModel
    getId: (item: TData) => number
    update: (model: TModel, item: TData) => void
  },
): TModel[] => {
  const activeIds = new Set<number>()
  const models = items.map((item) => {
    const id = getId(item)
    activeIds.add(id)
    const existing = map.get(id)
    if (existing !== undefined) {
      update(existing, item)
      return existing
    }
    const model = create(item)
    map.set(id, model)
    return model
  })
  for (const id of map.keys()) {
    if (!activeIds.has(id)) {
      map.delete(id)
    }
  }
  return models
}

/*
 * Correlate model and device types for type-safe sync.
 * The inner type guards are defensive: a device type cannot change between syncs.
 */
const syncDeviceModel = (
  model: DeviceModelAny,
  device: ListDeviceAny,
): void => {
  switch (device.Type) {
    case DeviceType.Ata: {
      if (model.type === DeviceType.Ata) {
        model[syncModel](device)
      }
      break
    }
    case DeviceType.Atw: {
      if (model.type === DeviceType.Atw) {
        model[syncModel](device)
      }
      break
    }
    case DeviceType.Erv: {
      if (model.type === DeviceType.Erv) {
        model[syncModel](device)
      }
      break
    }
    // No default
  }
}

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
      throw new Error(
        `Unsupported device type: ${String((device as { Type: unknown }).Type)}`,
      )
    }
  }
}

const level = {
  building: 0,
  child: 1,
  grandchild: 2,
  great_grandchild: 3,
}

const flattenAreas = function* flattenAreas(
  areas: readonly AreaZone[],
): Generator<Zone> {
  for (const area of areas) {
    yield area
    yield* area.devices
  }
}

const flattenBuildings = function* flattenBuildings(
  buildings: readonly BuildingZone[],
): Generator<Zone> {
  for (const building of buildings) {
    yield building
    yield* building.devices
    yield* flattenAreas(building.areas)
    for (const floor of building.floors) {
      yield floor
      yield* floor.devices
      yield* flattenAreas(floor.areas)
    }
  }
}

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const getDeviceLevel = (
  areaId: number | null,
  floorId: number | null,
): number => {
  if (areaId !== null && floorId !== null) {
    return level.great_grandchild
  }
  return areaId !== null || floorId !== null ? level.grandchild : level.child
}

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
      level: getDeviceLevel(areaId, floorId),
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
  readonly #areas = new Map<number, AreaModel>()

  #areasByBuildingId = new Map<number, AreaModel[]>()

  #areasByFloorId = new Map<number, AreaModel[]>()

  readonly #buildings = new Map<number, BuildingModel>()

  readonly #devices = new Map<number, DeviceModelAny>()

  #devicesByAreaId = new Map<number, DeviceModelAny[]>()

  #devicesByBuildingId = new Map<number, DeviceModelAny[]>()

  #devicesByFloorId = new Map<number, DeviceModelAny[]>()

  readonly #devicesByZone = {
    area: (id: number): DeviceModelAny[] => this.getDevicesByAreaId(id),
    building: (id: number): DeviceModelAny[] => this.getDevicesByBuildingId(id),
    floor: (id: number): DeviceModelAny[] => this.getDevicesByFloorId(id),
  }

  readonly #floors = new Map<number, FloorModel>()

  #floorsByBuildingId = new Map<number, FloorModel[]>()

  public readonly areas = {
    getById: (id: number): AreaModel | undefined => this.#areas.get(id),
  }

  public readonly buildings = {
    getById: (id: number): BuildingModel | undefined => this.#buildings.get(id),
  }

  public readonly devices = {
    getById: (id: number): DeviceModelAny | undefined => this.#devices.get(id),
  }

  public readonly floors = {
    getById: (id: number): FloorModel | undefined => this.#floors.get(id),
  }

  /**
   * Build a hierarchical zone structure from the registry, optionally filtered by device type.
   * @param root0 - Options object.
   * @param root0.type - Optional device type to filter the zone structure.
   * @returns The hierarchical building zone structure.
   */
  public getBuildings({ type }: { type?: DeviceType } = {}): BuildingZone[] {
    return [...this.#buildings.values()]
      .filter((building) => this.#hasDevices(building.id, 'building', type))
      .map((building) => ({
        areas: this.#buildAreaZones(
          this.getAreasByBuildingId(building.id).filter(
            ({ floorId }) => floorId === null,
          ),
          level.child,
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
        level: level.building,
        model: 'buildings' as const,
        name: building.name,
      }))
      .toSorted(compareNames)
  }

  /**
   * Flatten the building hierarchy into a sorted list of all zones.
   * @param id - The building ID to look up areas for.
   * @returns The areas belonging to the specified building.
   */
  public getAreasByBuildingId(id: number): AreaModel[] {
    return this.#areasByBuildingId.get(id) ?? []
  }

  public getAreasByFloorId(id: number): AreaModel[] {
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

  public getDevicesByType<T extends DeviceType>(type: T): DeviceModel<T>[]
  public getDevicesByType(type: DeviceType): DeviceModelAny[] {
    return this.getDevices().filter((instance) => instance.type === type)
  }

  public getFloorsByBuildingId(id: number): FloorModel[] {
    return this.#floorsByBuildingId.get(id) ?? []
  }

  public getZones({ type }: { type?: DeviceType } = {}): Zone[] {
    return [...flattenBuildings(this.getBuildings({ type }))].toSorted(
      compareNames,
    )
  }

  public syncAreas(areas: AreaDataAny[]): void {
    const models = syncMap(this.#areas, areas, {
      create: (area) => new AreaModel(area),
      getId: (area) => area.ID,
      update: (model, area) => {
        model[syncModel](area)
      },
    })
    this.#areasByBuildingId = Map.groupBy(
      models,
      ({ buildingId }) => buildingId,
    )
    this.#areasByFloorId = Map.groupBy(
      models.filter(
        (model): model is AreaModel & { floorId: number } =>
          model.floorId !== null,
      ),
      ({ floorId }) => floorId,
    )
  }

  public syncBuildings(buildings: BuildingData[]): void {
    syncMap(this.#buildings, buildings, {
      create: (building) => new BuildingModel(building),
      getId: (building) => building.ID,
      update: (model, building) => {
        model[syncModel](building)
      },
    })
  }

  public syncDevices(devices: readonly ListDeviceAny[]): void {
    const models = syncMap(this.#devices, devices, {
      create: createDeviceModel,
      update: syncDeviceModel,
      getId: (device) => device.DeviceID,
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
    const models = syncMap(this.#floors, floors, {
      create: (floor) => new FloorModel(floor),
      getId: (floor) => floor.ID,
      update: (model, floor) => {
        model[syncModel](floor)
      },
    })
    this.#floorsByBuildingId = Map.groupBy(
      models,
      ({ buildingId }) => buildingId,
    )
  }

  #buildAreaZones(
    areas: AreaModel[],
    areaLevel: number,
    type?: DeviceType,
  ): AreaZone[] {
    return areas
      .filter((area) => this.#hasDevices(area.id, 'area', type))
      .map((area) => ({
        devices: buildDeviceZones(this.getDevicesByAreaId(area.id), type),
        id: area.id,
        level: areaLevel,
        model: 'areas' as const,
        name: area.name,
      }))
      .toSorted(compareNames)
  }

  #buildFloorZones(floors: FloorModel[], type?: DeviceType): FloorZone[] {
    return floors
      .filter((floor) => this.#hasDevices(floor.id, 'floor', type))
      .map((floor) => ({
        areas: this.#buildAreaZones(
          this.getAreasByFloorId(floor.id),
          level.grandchild,
          type,
        ),
        devices: buildDeviceZones(
          this.getDevicesByFloorId(floor.id).filter(
            ({ areaId }) => areaId === null,
          ),
          type,
        ),
        id: floor.id,
        level: level.child,
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
    const devices = this.#devicesByZone[zone](id)
    return type === undefined ?
        devices.length > 0
      : devices.some(({ type: deviceType }) => deviceType === type)
  }
}
