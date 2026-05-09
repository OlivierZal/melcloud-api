import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type {
  HomeAtaDeviceCapabilities,
  HomeAtaDeviceData,
  HomeAtaValues,
  HomeDeviceSetting,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  Result,
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
}: HomeAtaDeviceCapabilities): TemperatureRange => ({ max, min })

const heatFanRange = ({
  maxTempHeat: max,
  minTempHeat: min,
}: HomeAtaDeviceCapabilities): TemperatureRange => ({ max, min })

const temperatureRanges = new Map<
  HomeOperationMode,
  (capabilities: HomeAtaDeviceCapabilities) => TemperatureRange
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
 * @category Facades
 */
export class HomeDeviceAtaFacade {
  /**
   * Static capability flags and per-mode temperature bounds advertised
   * by this device.
   * @returns The capability descriptor.
   */
  public get capabilities(): HomeAtaDeviceCapabilities {
    return this.#model.data.capabilities
  }

  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The device id.
   */
  public get id(): string {
    return this.#model.id
  }

  /**
   * User-facing display name set in the MELCloud Home app.
   * @returns The device's display name.
   */
  public get name(): string {
    return this.#model.name
  }

  /**
   * Currently active operation mode (heat/cool/auto/dry/fan/off).
   * @returns The operation mode.
   */
  public get operationMode(): HomeOperationMode {
    return this.#setting('OperationMode')
  }

  /**
   * Whether the unit is powered on.
   * @returns `true` when on, `false` when standby.
   */
  public get power(): boolean {
    return this.#setting('Power') === 'True'
  }

  /**
   * Last-reported room temperature in degrees Celsius.
   * @returns The room temperature.
   */
  public get roomTemperature(): number {
    return this.#setting('RoomTemperature')
  }

  /**
   * Last-reported Wi-Fi signal strength of the device adapter, in dBm.
   * @returns The RSSI value.
   */
  public get rssi(): number {
    return this.#model.data.rssi
  }

  /**
   * Currently configured fan speed. Normalised from MELCloud Home's
   * inconsistent stringified-number representation back to the enum.
   * @returns The fan speed.
   */
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

  /**
   * Target temperature setpoint in degrees Celsius.
   * @returns The setpoint temperature.
   */
  public get setTemperature(): number {
    return this.#setting('SetTemperature')
  }

  /**
   * Currently configured horizontal vane direction.
   * @returns The horizontal vane setting.
   */
  public get vaneHorizontalDirection(): HomeHorizontal {
    return this.#setting('VaneHorizontalDirection')
  }

  /**
   * Currently configured vertical vane direction.
   * @returns The vertical vane setting.
   */
  public get vaneVerticalDirection(): HomeVertical {
    return this.#setting('VaneVerticalDirection')
  }

  readonly #api: HomeAPIAdapter

  readonly #model: HomeDevice<HomeAtaDeviceData>

  /**
   * Builds a Home ATA facade backed by the given API client and
   * registry-resident device model.
   * @param api - Home API client.
   * @param model - Backing device model, narrowed to the ATA variant.
   */
  public constructor(api: HomeAPIAdapter, model: HomeDevice<HomeAtaDeviceData>) {
    this.#api = api
    this.#model = model
  }

  /**
   * Fetches cumulative-energy telemetry for this device over the given time window.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (e.g. `PT1H`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The telemetry bundle, or a typed failure.
   */
  public async getEnergy(params: {
    from: string
    interval: string
    to: string
  }): Promise<Result<HomeEnergyData>> {
    return this.#api.getEnergy(this.id, params)
  }

  /**
   * Fetches the error-log entries for this device.
   * @returns The entries (possibly empty), or a typed failure.
   */
  public async getErrorLog(): Promise<Result<HomeErrorLogEntry[]>> {
    return this.#api.getErrorLog(this.id)
  }

  /**
   * Fetches RSSI telemetry for this device over the given time window.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The telemetry bundle, or a typed failure.
   */
  public async getSignal(params: {
    from: string
    to: string
  }): Promise<Result<HomeEnergyData>> {
    return this.#api.getSignal(this.id, params)
  }

  /**
   * Fetches the trend-summary temperature report for this device over
   * the given time window.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `hour`, `day`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The report datasets, or a typed failure.
   */
  public async getTemperatures(params: {
    from: string
    period: string
    to: string
  }): Promise<Result<HomeReportData[]>> {
    return this.#api.getTemperatures(this.id, params)
  }

  /**
   * Pushes a partial setpoint update; throws {@link NoChangesError} when
   * `values` is empty, otherwise clamps `setTemperature` to the active
   * mode's bounds and forwards.
   * @param values - Partial setpoint payload.
   * @returns `true` when the update succeeded.
   */
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
