import { DateTime } from 'luxon'

import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
  type AreaModelAny,
  type DeviceModelAny,
} from '../models'

import { AreaFacade } from './area'
import { BuildingFacade } from './building'
import { DeviceAtaFacade } from './device_ata'
import { DeviceAtwFacade } from './device_atw'
import { DeviceErvFacade } from './device_erv'
import { FloorFacade } from './floor'
import { DEFAULT_YEAR, now } from './utils'

import type { API } from '../services'
import type { DeviceType, ErrorData } from '../types'

import type { ErrorLog, ErrorLogQuery } from './interfaces'

export interface DeviceFacade {
  Ata: DeviceAtaFacade
  Atw: DeviceAtwFacade
  Erv: DeviceErvFacade
}
export type DeviceFacadeAny =
  | DeviceAtaFacade
  | DeviceAtwFacade
  | DeviceErvFacade

const DEFAULT_LIMIT = 1
const DEFAULT_OFFSET = 0
const INVALID_YEAR = 1

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const handleErrorLogQuery = ({
  from,
  limit,
  offset,
  to,
}: ErrorLogQuery): {
  fromDate: DateTime
  period: number
  toDate: DateTime
} => {
  const fromDate =
    from !== undefined && from ? DateTime.fromISO(from) : undefined
  const toDate = to !== undefined && to ? DateTime.fromISO(to) : DateTime.now()

  const numberLimit = Number(limit)
  const period = Number.isFinite(numberLimit) ? numberLimit : DEFAULT_LIMIT

  const offsetLimit = Number(offset)
  const daysOffset =
    !fromDate && Number.isFinite(offsetLimit) ? offsetLimit : DEFAULT_OFFSET

  const daysLimit = fromDate ? DEFAULT_LIMIT : period
  const days = daysLimit * daysOffset + daysOffset
  return {
    fromDate: fromDate ?? toDate.minus({ days: days + daysLimit }),
    period,
    toDate: toDate.minus({ days }),
  }
}

export class FacadeManager {
  public readonly api: API

  readonly #facades = new Map<
    string,
    AreaFacade | BuildingFacade | DeviceFacadeAny | FloorFacade
  >()

  public constructor(api: API) {
    this.api = api
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
            this.#facades.set(id, new AreaFacade(this, model))
            break
          case model instanceof BuildingModel:
            this.#facades.set(id, new BuildingFacade(this, model))
            break
          case model instanceof DeviceModel && model.type === 'Ata':
            this.#facades.set(id, new DeviceAtaFacade(this, model))
            break
          case model instanceof DeviceModel && model.type === 'Atw':
            this.#facades.set(id, new DeviceAtwFacade(this, model))
            break
          case model instanceof DeviceModel && model.type === 'Erv':
            this.#facades.set(id, new DeviceErvFacade(this, model))
            break
          case model instanceof FloorModel:
            this.#facades.set(id, new FloorFacade(this, model))
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

  public async getErrors(
    query: ErrorLogQuery,
    deviceIds = DeviceModel.getAll().map(({ id }) => id),
  ): Promise<ErrorLog> {
    const { fromDate, period, toDate } = handleErrorLogQuery(query)
    const nextToDate = fromDate.minus({ days: 1 })
    return {
      errors: (await this.#getErrors(deviceIds, fromDate, toDate))
        .map(
          ({
            DeviceId: deviceId,
            ErrorMessage: errorMessage,
            StartDate: startDate,
          }) => ({
            date:
              DateTime.fromISO(startDate).year === INVALID_YEAR ?
                ''
              : DateTime.fromISO(startDate).toLocaleString(
                  DateTime.DATETIME_MED,
                ),
            device: DeviceModel.getById(deviceId)?.name ?? '',
            error: errorMessage?.trim() ?? '',
          }),
        )
        .filter(({ date, error }) => date && error)
        .reverse(),
      fromDateHuman: fromDate.toLocaleString(DateTime.DATE_FULL),
      nextFromDate: nextToDate.minus({ days: period }).toISODate() ?? '',
      nextToDate: nextToDate.toISODate() ?? '',
    }
  }

  async #getErrors(
    deviceIds: number[],
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ErrorData[]> {
    const { data } = await this.api.getErrors({
      postData: {
        DeviceIDs: deviceIds,
        FromDate: fromDate.toISODate() ?? DEFAULT_YEAR,
        ToDate: toDate.toISODate() ?? now(),
      },
    })
    if ('AttributeErrors' in data) {
      throw new Error(formatErrors(data.AttributeErrors))
    }
    return data
  }
}
