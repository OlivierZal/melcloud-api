import { ClassicDeviceType } from '../constants.ts'
import {
  type ClassicAreaDataAny,
  type ClassicAreaID,
  type ClassicAreaZone,
  type ClassicBuildingData,
  type ClassicBuildingID,
  type ClassicBuildingZone,
  type ClassicDeviceZone,
  type ClassicFloorData,
  type ClassicFloorID,
  type ClassicFloorZone,
  type ClassicListDeviceAny,
  type ClassicZone,
  toClassicAreaId,
  toClassicBuildingId,
  toClassicFloorId,
} from '../types/index.ts'
import type { ClassicDeviceAny } from './classic-interfaces.ts'
import { ClassicArea } from './area.ts'
import { ClassicBuilding } from './building.ts'
import { ClassicDevice } from './classic-device.ts'
import { ClassicFloor } from './floor.ts'
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

const syncDeviceModel = (
  model: ClassicDeviceAny,
  device: ClassicListDeviceAny,
): void => {
  if (model.type === device.Type) {
    model[syncModel](device)
  }
}

const KNOWN_DEVICE_TYPES = new Set<number>(Object.values(ClassicDeviceType))

const createDeviceModel = (device: ClassicListDeviceAny): ClassicDeviceAny => {
  /*
   * Guard runtime values that slipped past Zod's `z.number()` on `Type`.
   * Keeps the switch below exhaustive on the union so no `default` arm
   * is needed (per the strict `switch-exhaustiveness-check` setting).
   */
  if (!KNOWN_DEVICE_TYPES.has(device.Type as number)) {
    throw new Error(
      `Unsupported device type: ${JSON.stringify((device as { Type: unknown }).Type)}`,
    )
  }
  switch (device.Type) {
    case ClassicDeviceType.Ata: {
      return new ClassicDevice(device)
    }
    case ClassicDeviceType.Atw: {
      return new ClassicDevice(device)
    }
    case ClassicDeviceType.Erv: {
      return new ClassicDevice(device)
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
  areas: readonly ClassicAreaZone[],
): Generator<ClassicZone> {
  for (const area of areas) {
    yield area
    yield* area.devices
  }
}

const flattenBuildings = function* flattenBuildings(
  buildings: readonly ClassicBuildingZone[],
): Generator<ClassicZone> {
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
  devices: ClassicDeviceAny[],
  type?: ClassicDeviceType,
): ClassicDeviceZone[] => {
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
 * Synced from the Classic API response and queryable by ID or parent relationship.
 */
export class ClassicRegistry {
  /*
   * Pre-computed indexes for O(1) lookups by parent relationship.
   * Public accessors expose readonly query interfaces over private maps,
   * preventing callers from clearing or replacing entire collections.
   */
  readonly #areas = new Map<number, ClassicArea>()

  public readonly areas = {
    getById: (id: number): ClassicArea | undefined => this.#areas.get(id),
  }

  readonly #buildings = new Map<number, ClassicBuilding>()

  public readonly buildings = {
    getById: (id: number): ClassicBuilding | undefined =>
      this.#buildings.get(id),
  }

  readonly #devices = new Map<number, ClassicDeviceAny>()

  public readonly devices = {
    getById: (id: number): ClassicDeviceAny | undefined =>
      this.#devices.get(id),
  }

  readonly #floors = new Map<number, ClassicFloor>()

  public readonly floors = {
    getById: (id: number): ClassicFloor | undefined => this.#floors.get(id),
  }

  #areasByBuildingId = new Map<number, ClassicArea[]>()

  #areasByFloorId = new Map<number, ClassicArea[]>()

  #devicesByAreaId = new Map<number, ClassicDeviceAny[]>()

  #devicesByBuildingId = new Map<number, ClassicDeviceAny[]>()

  #devicesByFloorId = new Map<number, ClassicDeviceAny[]>()

  #floorsByBuildingId = new Map<number, ClassicFloor[]>()

  /**
   * Get all areas within a specific building.
   * @param id - The building ID to look up areas for.
   * @returns The areas belonging to the specified building.
   */
  public getAreasByBuildingId(id: ClassicBuildingID): ClassicArea[] {
    return this.#areasByBuildingId.get(id) ?? []
  }

  public getAreasByFloorId(id: ClassicFloorID): ClassicArea[] {
    return this.#areasByFloorId.get(id) ?? []
  }

  /**
   * Build a hierarchical zone structure from the registry, optionally filtered by device type.
   * @param root0 - Options object.
   * @param root0.type - Optional device type to filter the zone structure.
   * @returns The hierarchical building zone structure.
   */
  public getBuildings({
    type,
  }: { type?: ClassicDeviceType } = {}): ClassicBuildingZone[] {
    return [...this.#buildings.values()]
      .filter((building) => this.#hasDevices(building.id, 'building', type))
      .map((building) => ({
        areas: this.#buildAreaZones(
          this.getAreasByBuildingId(toClassicBuildingId(building.id)).filter(
            ({ floorId }) => floorId === null,
          ),
          level.child,
          type,
        ),
        devices: buildDeviceZones(
          this.getDevicesByBuildingId(toClassicBuildingId(building.id)).filter(
            ({ areaId, floorId }) => areaId === null && floorId === null,
          ),
          type,
        ),
        floors: this.#buildFloorZones(
          this.getFloorsByBuildingId(toClassicBuildingId(building.id)),
          type,
        ),
        id: building.id,
        level: level.building,
        model: 'buildings' as const,
        name: building.name,
      }))
      .toSorted(compareNames)
  }

  public getDevices(): ClassicDeviceAny[] {
    return [...this.#devices.values()]
  }

  public getDevicesByAreaId(id: ClassicAreaID): ClassicDeviceAny[] {
    return this.#devicesByAreaId.get(id) ?? []
  }

  public getDevicesByBuildingId(id: ClassicBuildingID): ClassicDeviceAny[] {
    return this.#devicesByBuildingId.get(id) ?? []
  }

  public getDevicesByFloorId(id: ClassicFloorID): ClassicDeviceAny[] {
    return this.#devicesByFloorId.get(id) ?? []
  }

  public getDevicesByType<T extends ClassicDeviceType>(
    type: T,
  ): ClassicDevice<T>[]
  public getDevicesByType(type: ClassicDeviceType): ClassicDeviceAny[] {
    return this.getDevices().filter((instance) => instance.type === type)
  }

  public getFloorsByBuildingId(id: ClassicBuildingID): ClassicFloor[] {
    return this.#floorsByBuildingId.get(id) ?? []
  }

  public getZones({ type }: { type?: ClassicDeviceType } = {}): ClassicZone[] {
    return [...flattenBuildings(this.getBuildings({ type }))].toSorted(
      compareNames,
    )
  }

  public syncAreas(areas: ClassicAreaDataAny[]): void {
    const models = syncMap(this.#areas, areas, {
      create: (area) => new ClassicArea(area),
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
        (model): model is ClassicArea & { floorId: number } =>
          model.floorId !== null,
      ),
      ({ floorId }) => floorId,
    )
  }

  public syncBuildings(buildings: ClassicBuildingData[]): void {
    syncMap(this.#buildings, buildings, {
      create: (building) => new ClassicBuilding(building),
      getId: (building) => building.ID,
      update: (model, building) => {
        model[syncModel](building)
      },
    })
  }

  public syncDevices(devices: readonly ClassicListDeviceAny[]): void {
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
        (model): model is ClassicDeviceAny & { floorId: number } =>
          model.floorId !== null,
      ),
      ({ floorId }) => floorId,
    )
    this.#devicesByAreaId = Map.groupBy(
      models.filter(
        (model): model is ClassicDeviceAny & { areaId: number } =>
          model.areaId !== null,
      ),
      ({ areaId }) => areaId,
    )
  }

  public syncFloors(floors: ClassicFloorData[]): void {
    const models = syncMap(this.#floors, floors, {
      create: (floor) => new ClassicFloor(floor),
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
    areas: ClassicArea[],
    areaLevel: number,
    type?: ClassicDeviceType,
  ): ClassicAreaZone[] {
    return areas
      .filter((area) => this.#hasDevices(area.id, 'area', type))
      .map((area) => ({
        devices: buildDeviceZones(
          this.getDevicesByAreaId(toClassicAreaId(area.id)),
          type,
        ),
        id: area.id,
        level: areaLevel,
        model: 'areas' as const,
        name: area.name,
      }))
      .toSorted(compareNames)
  }

  #buildFloorZones(
    floors: ClassicFloor[],
    type?: ClassicDeviceType,
  ): ClassicFloorZone[] {
    return floors
      .filter((floor) => this.#hasDevices(floor.id, 'floor', type))
      .map((floor) => ({
        areas: this.#buildAreaZones(
          this.getAreasByFloorId(toClassicFloorId(floor.id)),
          level.grandchild,
          type,
        ),
        devices: buildDeviceZones(
          this.getDevicesByFloorId(toClassicFloorId(floor.id)).filter(
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

  #getDevicesByZone(
    id: number,
    zone: 'area' | 'building' | 'floor',
  ): ClassicDeviceAny[] {
    if (zone === 'area') {
      return this.getDevicesByAreaId(toClassicAreaId(id))
    }
    return zone === 'building' ?
        this.getDevicesByBuildingId(toClassicBuildingId(id))
      : this.getDevicesByFloorId(toClassicFloorId(id))
  }

  #hasDevices(
    id: number,
    zone: 'area' | 'building' | 'floor',
    type?: ClassicDeviceType,
  ): boolean {
    const devices = this.#getDevicesByZone(id, zone)
    return type === undefined ?
        devices.length > 0
      : devices.some(({ type: deviceType }) => deviceType === type)
  }
}
