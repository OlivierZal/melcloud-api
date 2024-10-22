import { BaseModel } from './base.js'

import type { FloorData } from '../types/index.js'

import type { AreaModel } from './area.js'
import type { BuildingModel } from './building.js'
import type { DeviceModel, DeviceModelAny } from './device.js'
import type { IFloorModel } from './interfaces.js'

export class FloorModel extends BaseModel implements IFloorModel {
  static readonly #instances = new Map<number, FloorModel>()

  static #areaModel: typeof AreaModel

  static #buildingModel: typeof BuildingModel

  static #deviceModel: typeof DeviceModel

  public readonly buildingId: number

  private constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: FloorData) {
    super({ id, name })
    this.buildingId = buildingId
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): AreaModel<number>[] {
    return FloorModel.#areaModel.getByFloorId(this.id)
  }

  public get building(): BuildingModel | undefined {
    return FloorModel.#buildingModel.getById(this.buildingId)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return FloorModel.#deviceModel.getByFloorId(this.id)
  }

  public static getAll(): FloorModel[] {
    return [...this.#instances.values()]
  }

  public static getByBuildingId(id: number): FloorModel[] {
    return this.getAll().filter(({ buildingId }) => buildingId === id)
  }

  public static getById(id: number): FloorModel | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): FloorModel | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static setAreaModel(model: typeof AreaModel): void {
    this.#areaModel = model
  }

  public static setBuildingModel(model: typeof BuildingModel): void {
    this.#buildingModel = model
  }

  public static setDeviceModel(model: typeof DeviceModel): void {
    this.#deviceModel = model
  }

  public static upsert(floor: FloorData): void {
    this.#instances.set(floor.ID, new this(floor))
  }
}
