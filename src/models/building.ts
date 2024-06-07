import type { BuildingData, BuildingSettings } from '../types'
import {
  type BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  type IBuildingModel,
} from '.'

export default class implements IBuildingModel {
  public static readonly buildings = new Map<number, BuildingModel>()

  #data: BuildingSettings

  #id: number

  #name: string

  public constructor({ Name: name, ID: id, ...data }: BuildingData) {
    this.#data = data
    this.#id = id
    this.#name = name
  }

  public get data(): BuildingSettings {
    return this.#data
  }

  public get deviceIds(): number[] {
    return this.devices.map(({ #id: id }) => id)
  }

  public get devices(): DeviceModelAny[] {
    return DeviceModel.getAll().filter(
      ({ #buildingId: buildingId }) => buildingId === this.#id,
    )
  }

  public get id(): number {
    return this.#id
  }

  public get name(): string {
    return this.#name
  }

  public static getAll(): BuildingModel[] {
    return Array.from(this.buildings.values())
  }

  public static getById(id: number): BuildingModel | undefined {
    return this.buildings.get(id)
  }

  public static getByName(buildingName: string): BuildingModel | undefined {
    return this.getAll().find(({ #name: name }) => name === buildingName)
  }

  public static upsert(data: BuildingData): void {
    if (this.buildings.has(data.ID)) {
      this.buildings.get(data.ID)?.update(data)
      return
    }
    this.buildings.set(data.ID, new this(data))
  }

  public update({ Name: name, ID: id, ...data }: BuildingData): void {
    this.#data = data
    this.#id = id
    this.#name = name
  }
}
