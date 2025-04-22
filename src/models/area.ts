import type { AreaData, AreaDataAny } from '../types/common.ts'

import type { BuildingModel } from './building.ts'
import type { DeviceModel } from './device.ts'
import type { FloorModel } from './floor.ts'
import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModelAny,
  IFloorModel,
} from './interfaces.ts'

import { BaseModel } from './base.ts'

export class AreaModel<T extends number | null>
  extends BaseModel
  implements IAreaModel
{
  static #buildingModel: typeof BuildingModel

  static #deviceModel: typeof DeviceModel

  static #floorModel: typeof FloorModel

  static #instances = new Map<number, IAreaModel>()

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

  public get building(): IBuildingModel | undefined {
    return AreaModel.#buildingModel.getById(this.buildingId)
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): IDeviceModelAny[] {
    return AreaModel.#deviceModel.getByAreaId(this.id)
  }

  public get floor(): IFloorModel | null | undefined {
    return this.floorId === null ?
        null
      : AreaModel.#floorModel.getById(this.floorId)
  }

  public static getAll(): IAreaModel[] {
    return [...this.#instances.values()]
  }

  public static getByBuildingId(id: number): IAreaModel[] {
    return this.getAll().filter(({ buildingId }) => buildingId === id)
  }

  public static getByFloorId(id: number): IAreaModel[] {
    return this.getAll().filter(({ floorId }) => floorId === id)
  }

  public static getById(id: number): IAreaModel | undefined {
    return this.#instances.get(id)
  }

  public static getByName(name: string): IAreaModel | undefined {
    return this.getAll().find(({ name: instanceName }) => instanceName === name)
  }

  public static setModels({
    buildingModel,
    deviceModel,
    floorModel,
  }: {
    buildingModel: typeof BuildingModel
    deviceModel: typeof DeviceModel
    floorModel: typeof FloorModel
  }): void {
    this.#buildingModel = buildingModel
    this.#deviceModel = deviceModel
    this.#floorModel = floorModel
  }

  public static sync(areas: AreaDataAny[]): void {
    this.#instances = new Map(areas.map((area) => [area.ID, new this(area)]))
  }
}
