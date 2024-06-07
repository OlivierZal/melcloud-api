import {
  type AreaModel,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  FloorModel,
  type IAreaModel,
} from '.'
import type { LocationData } from '../types'

export default class implements IAreaModel {
  public static readonly areas = new Map<number, AreaModel>()

  public readonly buildingId: number

  public readonly floorId: number | null

  public readonly id: number

  public readonly name: string

  public constructor({
    ID: id,
    BuildingId: buildingId,
    FloorId: floorId,
    Name: name,
  }: LocationData & {
    readonly FloorId: number | null
  }) {
    this.id = id
    this.name = name
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
    if (this.floorId === null) {
      return null
    }
    return FloorModel.getById(this.floorId) ?? null
  }

  public static getAll(): AreaModel[] {
    return Array.from(this.areas.values())
  }

  public static getByBuildingId(buildingId: number): AreaModel[] {
    return this.getAll().filter(({ buildingId: id }) => id === buildingId)
  }

  public static getById(id: number): AreaModel | undefined {
    return this.areas.get(id)
  }

  public static getByName(areaName: string): AreaModel | undefined {
    return this.getAll().find(({ name }) => name === areaName)
  }

  public static upsert(
    data: LocationData & { readonly FloorId: number | null },
  ): void {
    this.areas.set(data.ID, new this(data))
  }
}
