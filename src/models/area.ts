import { BaseModel } from './base'

import type { AreaData, AreaDataAny } from '../types'

import type { BuildingModel } from './building'
import type { DeviceModel, DeviceModelAny } from './device'
import type { FloorModel } from './floor'
import type { IAreaModel } from './interfaces'

export type AreaModelAny = AreaModel<null> | AreaModel<number>

export class AreaModel<T extends number | null>
  extends BaseModel
  implements IAreaModel
{
  static readonly #instances = new Map<number, AreaModelAny>()

  static #buildingModel: typeof BuildingModel

  static #deviceModel: typeof DeviceModel

  static #floorModel: typeof FloorModel

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
    return AreaModel.#buildingModel.getById(this.buildingId)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return AreaModel.#deviceModel.getByAreaId(this.id)
  }

  public get floor(): FloorModel | null | undefined {
    return this.floorId === null ?
        null
      : AreaModel.#floorModel.getById(this.floorId)
  }

  public static getAll(): AreaModelAny[] {
    return [...this.#instances.values()]
  }

  public static getByBuildingId(id: number): AreaModelAny[] {
    return this.getAll().filter(({ buildingId }) => buildingId === id)
  }

  public static getByFloorId(id: number): AreaModelAny[] {
    return this.getAll().filter(({ floorId }) => floorId === id)
  }

  public static getById(id: number): AreaModelAny | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): AreaModelAny | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static setBuildingModel(model: typeof BuildingModel): void {
    this.#buildingModel = model
  }

  public static setDeviceModel(model: typeof DeviceModel): void {
    this.#deviceModel = model
  }

  public static setFloorModel(model: typeof FloorModel): void {
    this.#floorModel = model
  }

  public static upsert(area: AreaDataAny): void {
    this.#instances.set(area.ID, new this(area))
  }
}
