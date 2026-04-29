import type { HomeAPI } from '../api/home-types.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type {
  HomeAtaValues,
  HomeDeviceCapabilities,
  HomeDeviceSetting,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeResult,
} from '../types/index.ts'
import { ClassicFanSpeed } from '../constants.ts'
import {
  type HomeFanSpeed,
  type HomeHorizontal,
  type HomeOperationMode,
  type HomeVertical,
  fanSpeedFromClassic,
  isClassicFanSpeed,
  isHomeFanSpeed,
} from '../enum-mappings.ts'
import { NoChangesError } from '../errors/index.ts'
import { clampToRange } from '../utils.ts'

interface TemperatureRange {
  max: number
  min: number
}

const coolDryRange = ({
  maxTempCoolDry: max,
  minTempCoolDry: min,
}: HomeDeviceCapabilities): TemperatureRange => ({ max, min })

const heatFanRange = ({
  maxTempHeat: max,
  minTempHeat: min,
}: HomeDeviceCapabilities): TemperatureRange => ({ max, min })

const temperatureRanges = new Map<
  HomeOperationMode,
  (capabilities: HomeDeviceCapabilities) => TemperatureRange
>([
  [
    'Automatic',
    ({ maxTempAutomatic: max, minTempAutomatic: min }): TemperatureRange => ({
      max,
      min,
    }),
  ],
  ['Cool', coolDryRange],
  ['Dry', coolDryRange],
  ['Fan', heatFanRange],
  ['Heat', heatFanRange],
])

const getSetting = (settings: HomeDeviceSetting[], name: string): string =>
  settings.find((setting) => setting.name === name)?.value ?? ''

/**
 * Facade for a MELCloud Home ATA device. Provides typed access to device
 * settings and temperature clamping per operation mode before sending
 * values to the Classic API.
 */
export class HomeDeviceAtaFacade {
  public get capabilities(): HomeDeviceCapabilities {
    return this.#model.data.capabilities
  }

  public get id(): string {
    return this.#model.id
  }

  public get name(): string {
    return this.#model.name
  }

  public get operationMode(): HomeOperationMode {
    return this.#setting('OperationMode')
  }

  public get power(): boolean {
    return this.#setting('Power') === 'True'
  }

  public get roomTemperature(): number {
    return this.#setting('RoomTemperature')
  }

  public get rssi(): number {
    return this.#model.data.rssi
  }

  public get setFanSpeed(): HomeFanSpeed {
    // MELCloud Home API inconsistency: SetFanSpeed returns a stringified
    // number ("0") instead of the enum name ("Auto") like other settings.
    // Normalize via fanSpeedFromClassic, falling back to raw if already a name.
    const raw = this.#setting('SetFanSpeed')
    const numeric = Number(raw)
    if (raw !== '' && isClassicFanSpeed(numeric)) {
      return fanSpeedFromClassic[numeric]
    }
    return isHomeFanSpeed(raw) ? raw : fanSpeedFromClassic[ClassicFanSpeed.auto]
  }

  public get setTemperature(): number {
    return this.#setting('SetTemperature')
  }

  public get vaneHorizontalDirection(): HomeHorizontal {
    return this.#setting('VaneHorizontalDirection')
  }

  public get vaneVerticalDirection(): HomeVertical {
    return this.#setting('VaneVerticalDirection')
  }

  readonly #api: HomeAPI

  readonly #model: HomeDevice

  public constructor(api: HomeAPI, model: HomeDevice) {
    this.#api = api
    this.#model = model
  }

  public async getEnergy(params: {
    from: string
    interval: string
    to: string
  }): Promise<HomeResult<HomeEnergyData>> {
    return this.#api.getEnergy(this.id, params)
  }

  public async getErrorLog(): Promise<HomeResult<HomeErrorLogEntry[]>> {
    return this.#api.getErrorLog(this.id)
  }

  public async getSignal(params: {
    from: string
    to: string
  }): Promise<HomeResult<HomeEnergyData>> {
    return this.#api.getSignal(this.id, params)
  }

  public async getTemperatures(params: {
    from: string
    period: string
    to: string
  }): Promise<HomeResult<HomeReportData[]>> {
    return this.#api.getTemperatures(this.id, params)
  }

  public async updateValues(values: HomeAtaValues): Promise<boolean> {
    if (Object.keys(values).length === 0) {
      throw new NoChangesError(this.id)
    }
    return this.#api.updateValues(this.id, {
      ...values,
      ...this.#clampSetTemperature(values),
    })
  }

  #clampSetTemperature({
    operationMode,
    setTemperature: value,
  }: HomeAtaValues): { setTemperature?: number } {
    if (value === undefined || value === null) {
      return {}
    }
    const mode = operationMode ?? this.operationMode
    const getRange = temperatureRanges.get(mode)
    return getRange ?
        { setTemperature: clampToRange(value, getRange(this.capabilities)) }
      : { setTemperature: value }
  }

  #setting(name: 'OperationMode'): HomeOperationMode

  #setting(name: 'Power' | 'SetFanSpeed'): string

  #setting(name: 'RoomTemperature' | 'SetTemperature'): number

  #setting(name: 'VaneHorizontalDirection'): HomeHorizontal

  #setting(name: 'VaneVerticalDirection'): HomeVertical

  #setting(name: string): unknown

  #setting(name: string): unknown {
    const raw = getSetting(this.#model.data.settings, name)
    if (name === 'RoomTemperature' || name === 'SetTemperature') {
      return Number(raw)
    }
    return raw
  }
}
