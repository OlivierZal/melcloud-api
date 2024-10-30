import { DateTime } from 'luxon'

import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models/index.js'

import { AreaFacade } from './area.js'
import { BuildingFacade } from './building.js'
import { DeviceAtaFacade } from './device_ata.js'
import { DeviceAtwFacade } from './device_atw.js'
import { DeviceErvFacade } from './device_erv.js'
import { FloorFacade } from './floor.js'
import { DEFAULT_YEAR, now } from './utils.js'

import type { AreaModelAny, Model } from '../models/interfaces.js'
import type { API } from '../services/api.js'
import type { DeviceType, ErrorData } from '../types/index.js'

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
      } = instance
      const modelId = String(instance.id)
      const id = `${name}:${modelId}`
      if (!this.#facades.has(id)) {
        this.#setFacade(id, instance)
      }
      const facade = this.#facades.get(id)
      if (!facade) {
        throw new Error(`Facade not found for ${name} with id ${modelId}`)
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

  #setFacade(id: string, instance: Model): void {
    if (instance instanceof AreaModel) {
      this.#facades.set(id, new AreaFacade(this, instance))
    } else if (instance instanceof BuildingModel) {
      this.#facades.set(id, new BuildingFacade(this, instance))
    } else if (instance instanceof DeviceModel) {
      if (instance.type === 'Ata') {
        this.#facades.set(id, new DeviceAtaFacade(this, instance))
      } else if (instance.type === 'Atw') {
        this.#facades.set(id, new DeviceAtwFacade(this, instance))
      } else {
        this.#facades.set(id, new DeviceErvFacade(this, instance))
      }
    } else if (instance instanceof FloorModel) {
      this.#facades.set(id, new FloorFacade(this, instance))
    }
  }
}
