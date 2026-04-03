import type { HomeDeviceModel } from '../services/home-device-model.ts'
import type { HomeAPI } from '../services/interfaces.ts'
import type {
  HomeAtaValues,
  HomeDeviceCapabilities,
  HomeDeviceSetting,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
} from '../types/index.ts'
import {
  type HomeFanSpeed,
  type HomeHorizontal,
  type HomeOperationMode,
  type HomeVertical,
  fanSpeedFromClassic,
} from '../adapters/index.ts'

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

  readonly #model: HomeDeviceModel

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
    return Number(this.#setting('RoomTemperature'))
  }

  public get setFanSpeed(): HomeFanSpeed {
    /*
     * MELCloud Home API inconsistency: SetFanSpeed returns a stringified
     * number ("0") instead of the enum name ("Auto") like other settings.
     * Normalize via fanSpeedFromClassic, falling back to raw if already a name.
     */
    const raw = this.#setting('SetFanSpeed')
    const numeric = Number(raw)
    if (raw !== '' && numeric in fanSpeedFromClassic) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- `in` guard ensures numeric is a valid FanSpeed key
      return fanSpeedFromClassic[numeric as keyof typeof fanSpeedFromClassic]
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Fallback for when API returns the enum name directly (or empty string for missing setting)
    return raw as HomeFanSpeed
  }

  public get setTemperature(): number {
    return Number(this.#setting('SetTemperature'))
  }

  public get vaneHorizontalDirection(): HomeHorizontal {
    return this.#setting('VaneHorizontalDirection')
  }

  public get vaneVerticalDirection(): HomeVertical {
    return this.#setting('VaneVerticalDirection')
  }

  public constructor(api: HomeAPI, model: HomeDeviceModel) {
    this.#api = api
    this.#model = model
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
    if (Object.keys(values).length === 0) {
      throw new Error('No data to set')
    }
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

  #setting(name: 'OperationMode'): HomeOperationMode

  #setting(name: 'VaneHorizontalDirection'): HomeHorizontal

  #setting(name: 'VaneVerticalDirection'): HomeVertical

  #setting(name: string): string

  #setting(name: string): string {
    return getSetting(this.#model.data.settings, name)
  }
}
