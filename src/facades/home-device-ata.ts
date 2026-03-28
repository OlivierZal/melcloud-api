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

const coolDryRange = ({
  maxTempCoolDry: max,
  minTempCoolDry: min,
}: HomeDeviceCapabilities): TemperatureRange => ({ max, min })

const heatFanRange = ({
  maxTempHeat: max,
  minTempHeat: min,
}: HomeDeviceCapabilities): TemperatureRange => ({ max, min })

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
  ['Cool', coolDryRange],
  ['Dry', coolDryRange],
  ['Fan', heatFanRange],
  ['Heat', heatFanRange],
])

const clampTemperature = (
  value: number,
  { max, min }: TemperatureRange,
): number => Math.min(Math.max(value, min), max)

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
    return this.#setting('OperationMode')
  }

  public get power(): boolean {
    return this.#setting('Power') === 'True'
  }

  public get roomTemperature(): number {
    return Number(this.#setting('RoomTemperature'))
  }

  public get setTemperature(): number {
    return Number(this.#setting('SetTemperature'))
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
        { setTemperature: clampTemperature(value, getRange(this.capabilities)) }
      : { setTemperature: value }
  }

  #setting(name: string): string {
    return getSetting(this.#device.settings, name)
  }
}
