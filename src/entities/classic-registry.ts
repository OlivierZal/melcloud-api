import type { ClassicDeviceType } from '../constants.ts'
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
import type { ClassicDeviceAny } from './classic-types.ts'
import { ClassicArea, syncArea } from './area.ts'
import { ClassicBuilding, syncBuilding } from './building.ts'
import { ClassicDevice, syncDevice } from './classic-device.ts'
import { ClassicFloor, syncFloor } from './floor.ts'

// Upsert + prune: update existing models in-place, create new ones,
// and remove stale entries. Preserves object identity across syncs
// so that facade references remain valid.
//
// `NoInfer<TModel>` on the callback positions pins inference to the
// `map` argument: a typo'd `create` returning the wrong subtype is
// rejected at the call site instead of silently widening `TModel`.
const syncMap = <TModel, TData>(
  map: Map<number, TModel>,
  items: readonly TData[],
  {
    create,
    getId,
    update,
  }: {
    create: (item: TData) => NoInfer<TModel>
    getId: (item: TData) => number
    update: (model: NoInfer<TModel>, item: TData) => void
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
    syncDevice(model, device)
  }
}

// `ClassicBuildingListSchema` has already validated `device.Type` against
// the literal union of `ClassicDeviceType`, so no runtime guard nor
// per-variant switch is needed here.
const createDeviceModel = (device: ClassicListDeviceAny): ClassicDeviceAny =>
  new ClassicDevice(device)

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
  // Pre-computed indexes for O(1) lookups by parent relationship.
  // Public accessors expose readonly query interfaces over private maps,
  // preventing callers from clearing or replacing entire collections.
  readonly #areas = new Map<number, ClassicArea>()

  /** Lookup interface for areas — `getById` returns the area with the given id, or `undefined` if absent. */
  public readonly areas = {
    /**
     * Returns the area with the given id, or `undefined` when no such area is registered.
     * @param id - Area identifier.
     * @returns The area, or `undefined`.
     */
    getById: (id: number): ClassicArea | undefined => this.#areas.get(id),
  }

  readonly #buildings = new Map<number, ClassicBuilding>()

  /** Lookup interface for buildings — `getById` returns the building with the given id, or `undefined` if absent. */
  public readonly buildings = {
    /**
     * Returns the building with the given id, or `undefined` when no such building is registered.
     * @param id - Building identifier.
     * @returns The building, or `undefined`.
     */
    getById: (id: number): ClassicBuilding | undefined =>
      this.#buildings.get(id),
  }

  readonly #devices = new Map<number, ClassicDeviceAny>()

  /** Lookup interface for devices — `getById` returns the device with the given id, or `undefined` if absent. */
  public readonly devices = {
    /**
     * Returns the device with the given id, or `undefined` when no such device is registered.
     * @param id - Device identifier.
     * @returns The device, or `undefined`.
     */
    getById: (id: number): ClassicDeviceAny | undefined =>
      this.#devices.get(id),
  }

  readonly #floors = new Map<number, ClassicFloor>()

  /** Lookup interface for floors — `getById` returns the floor with the given id, or `undefined` if absent. */
  public readonly floors = {
    /**
     * Returns the floor with the given id, or `undefined` when no such floor is registered.
     * @param id - Floor identifier.
     * @returns The floor, or `undefined`.
     */
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

  /**
   * Returns the areas attached to the given floor (excluding building-level areas).
   * @param id - Floor identifier.
   * @returns The areas under that floor.
   */
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

  /**
   * Returns every device currently held in the registry.
   * @returns All devices.
   */
  public getDevices(): ClassicDeviceAny[] {
    return [...this.#devices.values()]
  }

  /**
   * Returns the devices attached directly to the given area.
   * @param id - Area identifier.
   * @returns The devices in that area.
   */
  public getDevicesByAreaId(id: ClassicAreaID): ClassicDeviceAny[] {
    return this.#devicesByAreaId.get(id) ?? []
  }

  /**
   * Returns every device under the given building (regardless of floor or area placement).
   * @param id - Building identifier.
   * @returns The devices under that building.
   */
  public getDevicesByBuildingId(id: ClassicBuildingID): ClassicDeviceAny[] {
    return this.#devicesByBuildingId.get(id) ?? []
  }

  /**
   * Returns every device under the given floor (regardless of area placement).
   * @param id - Floor identifier.
   * @returns The devices under that floor.
   */
  public getDevicesByFloorId(id: ClassicFloorID): ClassicDeviceAny[] {
    return this.#devicesByFloorId.get(id) ?? []
  }

  /**
   * Returns every device whose `Type` matches the given device type.
   * @param type - Ata, Atw, or Erv discriminator.
   * @returns The matching devices.
   */
  public getDevicesByType<T extends ClassicDeviceType>(
    type: T,
  ): ClassicDevice<T>[]
  public getDevicesByType(type: ClassicDeviceType): ClassicDeviceAny[] {
    return this.getDevices().filter((instance) => instance.type === type)
  }

  /**
   * Returns the floors of the given building.
   * @param id - Building identifier.
   * @returns The floors under that building.
   */
  public getFloorsByBuildingId(id: ClassicBuildingID): ClassicFloor[] {
    return this.#floorsByBuildingId.get(id) ?? []
  }

  /**
   * Flattens the hierarchical zone tree returned by {@link getBuildings}
   * into a single, name-sorted list.
   * @param root0 - Optional filter.
   * @param root0.type - Restrict to a single device type.
   * @returns Every zone (buildings, floors, areas, devices), sorted by name.
   */
  public getZones({ type }: { type?: ClassicDeviceType } = {}): ClassicZone[] {
    return [...flattenBuildings(this.getBuildings({ type }))].toSorted(
      compareNames,
    )
  }

  /**
   * Upserts the area registry and rebuilds the by-building / by-floor
   * indexes; entries absent from `areas` are pruned.
   * @param areas - Fresh wire-format area entries.
   */
  public syncAreas(areas: ClassicAreaDataAny[]): void {
    const models = syncMap(this.#areas, areas, {
      create: (area) => new ClassicArea(area),
      getId: (area) => area.ID,
      update: (model, area) => {
        syncArea(model, area)
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

  /**
   * Upserts the building registry; entries absent from `buildings` are pruned.
   * @param buildings - Fresh wire-format building entries.
   */
  public syncBuildings(buildings: ClassicBuildingData[]): void {
    syncMap(this.#buildings, buildings, {
      create: (building) => new ClassicBuilding(building),
      getId: (building) => building.ID,
      update: (model, building) => {
        syncBuilding(model, building)
      },
    })
  }

  /**
   * Upserts the device registry and rebuilds the by-building / by-floor /
   * by-area indexes; entries absent from `devices` are pruned.
   * @param devices - Fresh wire-format list-device entries.
   */
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

  /**
   * Upserts the floor registry and rebuilds the by-building index;
   * entries absent from `floors` are pruned.
   * @param floors - Fresh wire-format floor entries.
   */
  public syncFloors(floors: ClassicFloorData[]): void {
    const models = syncMap(this.#floors, floors, {
      create: (floor) => new ClassicFloor(floor),
      getId: (floor) => floor.ID,
      update: (model, floor) => {
        syncFloor(model, floor)
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
