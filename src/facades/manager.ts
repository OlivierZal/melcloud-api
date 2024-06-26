import {
  AreaModel,
  type AreaModelAny,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  FloorModel,
} from '../models'
import DeviceFacade, { type DeviceFacadeAny } from './device'
import type API from '../services'
import AreaFacade from './area'
import BuildingFacade from './building'
import type { DeviceType } from '../types'
import FloorFacade from './floor'

export default class FacadeManager {
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
  ): DeviceFacade<T>
  public get(model: FloorModel): FloorFacade
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
        case model instanceof DeviceModel:
          this.#facades.set(
            id,
            new DeviceFacade(this.#api, model) as DeviceFacadeAny,
          )
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
