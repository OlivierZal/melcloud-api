import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  type IFloorModel,
} from '.'
import type { FloorData } from '../types'

export default class FloorModel implements IFloorModel {
  public static readonly floors = new Map<number, FloorModel>()

  public readonly buildingId: number

  public readonly id: number

  public readonly name: string

  private constructor({
    BuildingId: buildingId,
    ID: id,
    Name: name,
  }: FloorData) {
    this.buildingId = buildingId
    this.id = id
    this.name = name
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): AreaModel<number>[] {
    return AreaModel.getAll().filter(
      (area): area is AreaModel<number> => area.floorId === this.id,
    )
  }

  public get building(): BuildingModel | null {
    return BuildingModel.getById(this.buildingId) ?? null
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(({ floorId }) => floorId === this.id)
  }

  public static getAll(): FloorModel[] {
    return Array.from(this.floors.values())
  }

  public static getByBuildingId(buildingId: number): FloorModel[] {
    return this.getAll().filter(({ buildingId: id }) => id === buildingId)
  }

  public static getById(id: number): FloorModel | undefined {
    return this.floors.get(id)
  }

  public static getByName(floorName: string): FloorModel | undefined {
    return this.getAll().find(({ name }) => name === floorName)
  }

  public static upsert(data: FloorData): void {
    this.floors.set(data.ID, new this(data))
  }
}
