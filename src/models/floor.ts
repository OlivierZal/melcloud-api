import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  type FloorModel,
  type IFloorModel,
} from '.'
import type { LocationData } from '../types'

export default class implements IFloorModel {
  public static readonly floors = new Map<number, FloorModel>()

  public readonly buildingId: number

  public readonly id: number

  public readonly name: string

  public constructor({
    ID: id,
    BuildingId: buildingId,
    Name: name,
  }: LocationData) {
    this.id = id
    this.name = name
    this.buildingId = buildingId
  }

  public get areaIds(): number[] {
    return this.areas.map(({ id }) => id)
  }

  public get areas(): AreaModel[] {
    return AreaModel.getAll().filter(({ floorId }) => floorId === this.id)
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

  public static upsert(data: LocationData): void {
    this.floors.set(data.ID, new this(data))
  }
}
