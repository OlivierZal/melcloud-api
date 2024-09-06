import type API from '../services'
import type { DeviceType } from '../types'

import {
  type AreaModelAny,
  type DeviceModelAny,
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models'
import AreaFacade from './area'
import BuildingFacade from './building'
import DeviceFacadeAta from './device_ata'
import DeviceFacadeAtw from './device_atw'
import DeviceFacadeErv from './device_erv'
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

  public get(): undefined
  public get(model: AreaModelAny): AreaFacade
  public get(model: BuildingModel): BuildingFacade
  public get<T extends keyof typeof DeviceType>(
    model: DeviceModel<T>,
  ): DeviceFacade[T]
  public get(model: FloorModel): FloorFacade
  public get(
    model: AreaModelAny | BuildingModel | FloorModel,
  ): AreaFacade | BuildingFacade | FloorFacade
  public get(
    model: AreaModelAny | BuildingModel | DeviceModelAny | FloorModel,
  ): AreaFacade | BuildingFacade | DeviceFacadeAny | FloorFacade
  public get(model?: AreaModelAny): AreaFacade | undefined
  public get(model?: BuildingModel): BuildingFacade | undefined
  public get<T extends keyof typeof DeviceType>(
    model?: DeviceModel<T>,
  ): DeviceFacade[T] | undefined
  public get(model?: FloorModel): FloorFacade | undefined
  public get(
    model?: AreaModelAny | BuildingModel | DeviceModelAny | FloorModel,
  ): AreaFacade | BuildingFacade | DeviceFacadeAny | FloorFacade | undefined {
    if (model) {
      const modelName = model.constructor.name
      const modelId = String(model.id)
      const id = `${modelName}:${modelId}`
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
      if (!facade) {
        throw new Error(`Facade not found for ${modelName} with id ${modelId}`)
      }
      return facade
    }
  }
}
