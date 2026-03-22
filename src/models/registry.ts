import type {
  AreaDataAny,
  AreaZone,
  BuildingData,
  BuildingZone,
  DeviceZone,
  FloorData,
  FloorZone,
  ListDevice,
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

const SUPPORTED_DEVICE_TYPES: ReadonlySet<number> = new Set<number>([
  DeviceType.Ata,
  DeviceType.Atw,
  DeviceType.Erv,
])

const createDeviceModel = (device: ListDeviceAny): DeviceModelAny => {
  if (!SUPPORTED_DEVICE_TYPES.has(device.Type)) {
    throw new Error(
      `Unsupported device type: ${String((device as { Type: unknown }).Type)}`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- runtime-verified via SUPPORTED_DEVICE_TYPES
  return new DeviceModel(device) as DeviceModelAny
}

const BUILDING_LEVEL = 0
const CHILD_LEVEL = 1
const GRANDCHILD_LEVEL = 2
const GREAT_GRANDCHILD_LEVEL = 3

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const getDeviceLevel = (
  areaId: number | null,
  floorId: number | null,
): number => {
  if (areaId !== null && floorId !== null) {
    return GREAT_GRANDCHILD_LEVEL
  }
  if (areaId !== null || floorId !== null) {
    return GRANDCHILD_LEVEL
  }
  return CHILD_LEVEL
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

  readonly #devicesByZone = {
    area: (id: number): DeviceModelAny[] => this.getDevicesByAreaId(id),
    building: (id: number): DeviceModelAny[] => this.getDevicesByBuildingId(id),
    floor: (id: number): DeviceModelAny[] => this.getDevicesByFloorId(id),
  }

  #areasByBuildingId = new Map<number, AreaModelContract[]>()

  #areasByFloorId = new Map<number, AreaModelContract[]>()

  #devicesByAreaId = new Map<number, DeviceModelAny[]>()

  #devicesByBuildingId = new Map<number, DeviceModelAny[]>()

  #devicesByFloorId = new Map<number, DeviceModelAny[]>()

  #floorsByBuildingId = new Map<number, FloorModelContract[]>()

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

  /**
   * Flatten the building hierarchy into a sorted list of all zones.
   * @param id - The building ID to look up areas for.
   * @returns The areas belonging to the specified building.
   */
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

  public getDevicesByType<TDeviceType extends DeviceType>(
    type: TDeviceType,
  ): (DeviceModelAny & { type: TDeviceType })[] {
    return this.getDevices().filter(
      (instance): instance is DeviceModelAny & { type: TDeviceType } =>
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
    const models = syncMap(this.#areas, areas, {
      create: (area) => new AreaModel(area),
      getId: (area) => area.ID,
      update: (model, area) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- registry-created instance
        ;(model as AreaModel).sync(area)
      },
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
    syncMap(this.#buildings, buildings, {
      create: (building) => new BuildingModel(building),
      getId: (building) => building.ID,
      update: (model, building) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- registry-created instance
        ;(model as BuildingModel).sync(building)
      },
    })
  }

  public syncDevices(devices: readonly ListDeviceAny[]): void {
    const models = syncMap(this.#devices, devices, {
      create: createDeviceModel,
      getId: (device) => device.DeviceID,
      update: (model, device) => {
        /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- runtime-verified via type guard */
        // Defensive: device type should never change between syncs
        /* v8 ignore start */
        if (model.type !== device.Type) {
          return
        }

        /* v8 ignore stop */
        ;(model as DeviceModel<typeof device.Type>).sync(
          device as ListDevice<typeof device.Type>,
        )
        /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
      },
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- registry-created instance
        ;(model as FloorModel).sync(floor)
      },
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
    const devices = this.#devicesByZone[zone](id)
    return type === undefined ?
        Boolean(devices.length)
      : devices.some(({ type: deviceType }) => deviceType === type)
  }
}
