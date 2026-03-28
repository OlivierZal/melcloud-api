import type { HomeAPI } from '../services/home-api.ts'
import type {
  HomeAtaValues,
  HomeDevice,
  HomeDeviceCapabilities,
  HomeDeviceSetting,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
} from '../types/index.ts'

interface TemperatureRange {
  max: number
  min: number
}

const temperatureRanges = new Map<
  string,
  (capabilities: HomeDeviceCapabilities) => TemperatureRange
>([
  [
    'Automatic',
    ({ maxTempAutomatic: max, minTempAutomatic: min }): TemperatureRange => ({
      max,
      min,
    }),
  ],
  [
    'Cool',
    ({ maxTempCoolDry: max, minTempCoolDry: min }): TemperatureRange => ({
      max,
      min,
    }),
  ],
  [
    'Dry',
    ({ maxTempCoolDry: max, minTempCoolDry: min }): TemperatureRange => ({
      max,
      min,
    }),
  ],
  [
    'Fan',
    ({ maxTempHeat: max, minTempHeat: min }): TemperatureRange => ({
      max,
      min,
    }),
  ],
  [
    'Heat',
    ({ maxTempHeat: max, minTempHeat: min }): TemperatureRange => ({
      max,
      min,
    }),
  ],
])

const getSetting = (settings: HomeDeviceSetting[], name: string): string =>
  settings.find((setting) => setting.name === name)?.value ?? ''

/**
 * Facade for a MELCloud Home ATA device. Provides typed access to device
 * settings and temperature clamping per operation mode before sending
 * values to the API.
 */
export class HomeDeviceAtaFacade {
  readonly #api: HomeAPI

  readonly #device: HomeDevice

  public get capabilities(): HomeDeviceCapabilities {
    return this.#device.capabilities
  }

  public get id(): string {
    return this.#device.id
  }

  public get name(): string {
    return this.#device.givenDisplayName
  }

  public get operationMode(): string {
    return getSetting(this.#device.settings, 'OperationMode')
  }

  public get power(): boolean {
    return getSetting(this.#device.settings, 'Power') === 'True'
  }

  public get roomTemperature(): number {
    return Number(getSetting(this.#device.settings, 'RoomTemperature'))
  }

  public get setTemperature(): number {
    return Number(getSetting(this.#device.settings, 'SetTemperature'))
  }

  public constructor(api: HomeAPI, device: HomeDevice) {
    this.#api = api
    this.#device = device
  }

  public async getEnergy(params: {
    from: string
    interval: string
    to: string
  }): Promise<HomeEnergyData | null> {
    return this.#api.getEnergy(this.id, params)
  }

  public async getErrorLog(): Promise<HomeErrorLogEntry[]> {
    return this.#api.getErrorLog(this.id)
  }

  public async getSignal(params: {
    from: string
    to: string
  }): Promise<HomeEnergyData | null> {
    return this.#api.getSignal(this.id, params)
  }

  public async getTemperatures(params: {
    from: string
    period: string
    to: string
  }): Promise<HomeReportData[] | null> {
    return this.#api.getTemperatures(this.id, params)
  }

  public async setValues(values: HomeAtaValues): Promise<boolean> {
    return this.#api.setValues(this.id, {
      ...values,
      ...this.#clampTemperature(values),
    })
  }

  #clampTemperature({
    operationMode,
    setTemperature: value,
  }: HomeAtaValues): { setTemperature?: number } {
    if (value === undefined || value === null) {
      return {}
    }
    const mode = operationMode ?? this.operationMode
    const getRange = temperatureRanges.get(mode)
    if (!getRange) {
      return { setTemperature: value }
    }
    const { max, min } = getRange(this.capabilities)
    return { setTemperature: Math.min(Math.max(value, min), max) }
  }
}
