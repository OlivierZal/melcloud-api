import { DateTime } from 'luxon'

import {
  DeviceModel,
  type BuildingModel,
  type FloorModel,
} from '../models/index.js'

import { createFacade } from './factory.js'
import { DEFAULT_YEAR, now } from './utils.js'

import type { DeviceType } from '../enums.js'
import type { AreaModelAny, Model } from '../models/interfaces.js'
import type { API } from '../services/api.js'
import type { ErrorData } from '../types/index.js'

import type { AreaFacade } from './area.js'
import type { BuildingFacade } from './building.js'
import type { FloorFacade } from './floor.js'
import type {
  DeviceFacade,
  ErrorLog,
  ErrorLogQuery,
  Facade,
} from './interfaces.js'

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

  readonly #facades = new Map<string, Facade>()

  public constructor(api: API) {
    this.api = api
  }

  public get(): undefined
  public get(instance: AreaModelAny): AreaFacade
  public get(instance: BuildingModel): BuildingFacade
  public get<T extends keyof typeof DeviceType>(
    instance: DeviceModel<T>,
  ): DeviceFacade[T]
  public get(instance: FloorModel): FloorFacade
  public get(
    instance: AreaModelAny | BuildingModel | FloorModel,
  ): AreaFacade | BuildingFacade | FloorFacade
  public get(instance: Model): Facade
  public get(instance?: AreaModelAny): AreaFacade | undefined
  public get(instance?: BuildingModel): BuildingFacade | undefined
  public get<T extends keyof typeof DeviceType>(
    instance?: DeviceModel<T>,
  ): DeviceFacade[T] | undefined
  public get(instance?: FloorModel): FloorFacade | undefined
  public get(instance?: Model): Facade | undefined {
    if (instance) {
      const {
        constructor: { name },
        id,
      } = instance
      const facadeId = `${name}:${String(id)}`
      if (!this.#facades.has(facadeId)) {
        this.#facades.set(facadeId, createFacade(this, instance))
      }
      return this.#facades.get(facadeId)
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
