import BaseModel from './base'
import BuildingModel from './building'
import DeviceModel, { type DeviceModelAny } from './device'
import FloorModel from './floor'

import type { AreaData, AreaDataAny } from '../types'

import type { IAreaModel } from './interfaces'

export type AreaModelAny = AreaModel<null> | AreaModel<number>

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

  public get building(): BuildingModel | undefined {
    return BuildingModel.getById(this.buildingId)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getByAreaId(this.id)
  }

  public get floor(): FloorModel | null | undefined {
    return this.floorId === null ? null : FloorModel.getById(this.floorId)
  }

  public static getAll(): AreaModelAny[] {
    return [...this.#areas.values()]
  }

  public static getByBuildingId(id: number): AreaModelAny[] {
    return this.getAll().filter(({ buildingId }) => buildingId === id)
  }

  public static getByFloorId(id: number): AreaModelAny[] {
    return this.getAll().filter(({ floorId }) => floorId === id)
  }

  public static getById(id: number): AreaModelAny | undefined {
    return this.#areas.get(id)
  }

  public static getByName(name: string): AreaModelAny | undefined {
    return this.getAll().find(({ name: modelName }) => modelName === name)
  }

  public static upsert(area: AreaDataAny): void {
    this.#areas.set(area.ID, new this(area))
  }
}
