import type { FloorData } from '../types'
import type { IFloorModel } from './interfaces'

import AreaModel from './area'
import BaseModel from './base'
import BuildingModel from './building'
import DeviceModel, { type DeviceModelAny } from './device'

export default class FloorModel extends BaseModel implements IFloorModel {
  static readonly #floors = new Map<number, FloorModel>()

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
    return AreaModel.getByFloorId(this.id)
  }

  public get building(): BuildingModel | undefined {
    return BuildingModel.getById(this.buildingId)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getByFloorId(this.id)
  }

  public static getAll(): FloorModel[] {
    return [...this.#floors.values()]
  }

  public static getByBuildingId(id: number): FloorModel[] {
    return this.getAll().filter((model) => model.buildingId === id)
  }

  public static getById(id: number): FloorModel | undefined {
    return this.#floors.get(id)
  }

  public static getByName(name: string): FloorModel | undefined {
    return this.getAll().find((model) => model.name === name)
  }

  public static upsert(floor: FloorData): void {
    this.#floors.set(floor.ID, new this(floor))
  }
}
