import {
  type AreaModel,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  FloorModel,
  type IAreaModel,
} from '.'
import type { AreaData } from '../types'

export type AreaModelAny = AreaModel<number> | AreaModel<null>

export default class<T extends number | null> implements IAreaModel<T> {
  public static readonly areas = new Map<number, AreaModel<number | null>>()

  #buildingId: number

  #floorId: number | null

  #id: number

  #name: string

  public constructor({
    BuildingId: buildingId,
    FloorId: floorId,
    ID: id,
    Name: name,
  }: AreaData<T>) {
    this.#buildingId = buildingId
    this.#floorId = floorId
    this.#id = id
    this.#name = name
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.#buildingId) ?? null
  }

  public get buildingId(): number {
    return this.#buildingId
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ #id: id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(
      ({ #areaId: areaId }) => areaId === this.#id,
    )
  }

  public get floor(): FloorModel | null {
    return this.#floorId === null ?
        null
      : FloorModel.getById(this.#floorId) ?? null
  }

  public get floorId(): number | null {
    return this.#floorId
  }

  public get id(): number {
    return this.#id
  }

  public get name(): string {
    return this.#name
  }

  public static getAll(): AreaModelAny[] {
    return Array.from(this.areas.values())
  }

  public static getByBuildingId(buildingId: number): AreaModelAny[] {
    return this.getAll().filter(({ buildingId: id }) => id === buildingId)
  }

  public static getById(id: number): AreaModelAny | undefined {
    return this.areas.get(id)
  }

  public static getByName(areaName: string): AreaModelAny | undefined {
    return this.getAll().find(({ name }) => name === areaName)
  }

  public static upsert(data: AreaData<number | null>): void {
    if (this.areas.has(data.ID)) {
      this.areas.get(data.ID)?.update(data)
      return
    }
    this.areas.set(data.ID, new this(data))
  }

  public update({
    BuildingId: buildingId,
    FloorId: floorId,
    ID: id,
    Name: name,
  }: AreaData<T>): void {
    this.#buildingId = buildingId
    this.#floorId = floorId
    this.#id = id
    this.#name = name
  }
}
