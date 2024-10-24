import { BaseModel } from './base.js'

import type { AreaData, AreaDataAny } from '../types/index.js'

import type { BuildingModel } from './building.js'
import type { DeviceModel, DeviceModelAny } from './device.js'
import type { FloorModel } from './floor.js'
import type { IAreaModel } from './interfaces.js'

export type AreaModelAny = AreaModel<null> | AreaModel<number>

export class AreaModel<T extends number | null>
  extends BaseModel
  implements IAreaModel
{
  static #buildingModel: typeof BuildingModel

  static #deviceModel: typeof DeviceModel

  static #floorModel: typeof FloorModel

  static #instances = new Map<number, AreaModelAny>()

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

  public static sync(areas: AreaDataAny[]): void {
    this.#instances = new Map(areas.map((area) => [area.ID, new this(area)]))
  }
}
