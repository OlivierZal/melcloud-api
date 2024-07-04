import {
  AreaModel,
  type AreaModelAny,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  FloorModel,
} from '../models'
import type API from '../services'
import AreaFacade from './area'
import BuildingFacade from './building'
import DeviceFacadeAta from './device_ata'
import DeviceFacadeAtw from './device_atw'
import DeviceFacadeErv from './device_erv'
import type { DeviceType } from '../types'
import FloorFacade from './floor'

export interface DeviceFacade {
  Ata: DeviceFacadeAta
  Atw: DeviceFacadeAtw
  Erv: DeviceFacadeErv
}
export type DeviceFacadeAny =
  | DeviceFacadeAta
  | DeviceFacadeAtw
  | DeviceFacadeErv

export default class {
  readonly #api: API

  readonly #facades = new Map<
    string,
    AreaFacade | BuildingFacade | DeviceFacadeAny | FloorFacade
  >()

  public constructor(api: API) {
    this.#api = api
  }

  public get(): null
  public get(model: AreaModelAny): AreaFacade
  public get(model: BuildingModel): BuildingFacade
  public get<T extends keyof typeof DeviceType>(
    model: DeviceModel<T>,
  ): DeviceFacade[T]
  public get(model: FloorModel): FloorFacade
  public get(model?: AreaModelAny): AreaFacade | null
  public get(model?: BuildingModel): BuildingFacade | null
  public get<T extends keyof typeof DeviceType>(
    model?: DeviceModel<T>,
  ): DeviceFacade[T] | null
  public get(model?: FloorModel): FloorFacade | null
  public get(
    model?: AreaModelAny | BuildingModel | DeviceModelAny | FloorModel,
  ): AreaFacade | BuildingFacade | DeviceFacadeAny | FloorFacade | null {
    if (typeof model === 'undefined') {
      return null
    }
    const modelName = model.constructor.name
    const id = `${modelName}:${model.id}`
    if (!this.#facades.has(id)) {
      switch (true) {
        case model instanceof AreaModel:
          this.#facades.set(id, new AreaFacade(this.#api, model))
          break
        case model instanceof BuildingModel:
          this.#facades.set(id, new BuildingFacade(this.#api, model))
          break
        case model instanceof DeviceModel && model.type === 'Ata':
          this.#facades.set(id, new DeviceFacadeAta(this.#api, model))
          break
        case model instanceof DeviceModel && model.type === 'Atw':
          this.#facades.set(id, new DeviceFacadeAtw(this.#api, model))
          break
        case model instanceof DeviceModel && model.type === 'Erv':
          this.#facades.set(id, new DeviceFacadeErv(this.#api, model))
          break
        case model instanceof FloorModel:
          this.#facades.set(id, new FloorFacade(this.#api, model))
          break
        default:
      }
    }
    const facade = this.#facades.get(id)
    if (typeof facade === 'undefined') {
      throw new Error(`Facade not found for ${modelName} with id ${model.id}`)
    }
    return facade
  }
}
