import type { BuildingData, BuildingSettings } from '../types'
import {
  type BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  type IBuildingModel,
} from '.'

export default class implements IBuildingModel {
  public static readonly buildings = new Map<number, BuildingModel>()

  public readonly data: BuildingSettings

  public readonly id: number

  public readonly name: string

  public constructor({ ID: id, Name: name, ...data }: BuildingData) {
    this.id = id
    this.name = name
    this.data = data
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(
      ({ buildingId }) => buildingId === this.id,
    )
  }

  public static getAll(): BuildingModel[] {
    return Array.from(this.buildings.values())
  }

  public static getById(id: number): BuildingModel | undefined {
    return this.buildings.get(id)
  }

  public static getByName(buildingName: string): BuildingModel | undefined {
    return this.getAll().find(({ name }) => name === buildingName)
  }

  public static upsert(data: BuildingData): void {
    this.buildings.set(data.ID, new this(data))
  }
}
