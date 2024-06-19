import type { AreaData, AreaDataAny } from '../types'
import DeviceModel, { type DeviceModelAny } from './device'
import BaseModel from './base'
import BuildingModel from './building'
import FloorModel from './floor'
import type { IAreaModel } from './interfaces'

export type AreaModelAny = AreaModel<number> | AreaModel<null>

export default class AreaModel<T extends number | null>
  extends BaseModel
  implements IAreaModel
{
  static readonly #areas = new Map<number, AreaModelAny>()

  public readonly buildingId: number

  public readonly floorId: number | null

  private constructor({
    BuildingId: buildingId,
    FloorId: floorId,
    ID: id,
    Name: name,
  }: AreaData<T>) {
    super({ id, name })
    this.buildingId = buildingId
    this.floorId = floorId
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.buildingId) ?? null
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(({ areaId }) => areaId === this.id)
  }

  public get floor(): FloorModel | null {
    return this.floorId === null ?
        null
      : FloorModel.getById(this.floorId) ?? null
  }

  public static getAll(): AreaModelAny[] {
    return Array.from(this.#areas.values())
  }

  public static getByBuildingId(buildingId: number): AreaModelAny[] {
    return this.getAll().filter(({ buildingId: id }) => id === buildingId)
  }

  public static getById(id: number): AreaModelAny | undefined {
    return this.#areas.get(id)
  }

  public static getByName(areaName: string): AreaModelAny | undefined {
    return this.getAll().find(({ name }) => name === areaName)
  }

  public static upsert(data: AreaDataAny): void {
    this.#areas.set(data.ID, new this(data))
  }
}
