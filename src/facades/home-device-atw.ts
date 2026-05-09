import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type {
  HomeAtwDeviceCapabilities,
  HomeAtwDeviceData,
  HomeAtwValues,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  Result,
} from '../types/index.ts'
import { NoChangesError } from '../errors/index.ts'
import { clampToRange } from '../utils.ts'
import { HomeBaseDeviceFacade } from './home-base-device.ts'

interface TemperatureRange {
  max: number
  min: number
}

const zoneRange = ({
  maxSetTemperature: max,
  minSetTemperature: min,
}: HomeAtwDeviceCapabilities): TemperatureRange => ({ max, min })

const tankRange = ({
  maxSetTankTemperature: max,
  minSetTankTemperature: min,
}: HomeAtwDeviceCapabilities): TemperatureRange => ({ max, min })

/**
 * Facade for a MELCloud Home ATW (air-to-water) device. Provides
 * typed access to zone setpoints, tank temperature, and ATW telemetry
 * endpoints (`comfort-graph`, `internaltemperatures`, interval energy).
 * @category Facades
 */
export class HomeDeviceAtwFacade extends HomeBaseDeviceFacade<HomeAtwDeviceData> {
  /**
   * Static capability flags and ranges advertised by this device.
   * @returns The capability descriptor.
   */
  public get capabilities(): HomeAtwDeviceCapabilities {
    return this.model.data.capabilities
  }

  /**
   * Whether the unit is forcing hot-water generation.
   * @returns `true` when forced, `false` otherwise.
   */
  public get forcedHotWaterMode(): boolean {
    return this.setting('ForcedHotWaterMode') === 'True'
  }

  /**
   * Whether the device firmware reports cooling-mode support. Distinct
   * from {@link HomeAtwDeviceCapabilities.hasHeatZone1}/`hasHeatZone2`
   * (per-zone heat capability) — this flag mirrors the `HasCoolingMode`
   * setting from `/context`.
   * @returns `true` when the device reports cooling mode availability.
   */
  public get hasCoolingMode(): boolean {
    return this.setting('HasCoolingMode') === 'True'
  }

  /**
   * Whether the unit is in standby (powered, but idle).
   * @returns `true` when on standby.
   */
  public get inStandbyMode(): boolean {
    return this.setting('InStandbyMode') === 'True'
  }

  /**
   * Top-level operation mode advertised by the FTC controller. Values
   * include `Stop` and the heat/cool modes; the SDK does not narrow
   * further because the controller exposes other strings on some
   * firmware revisions.
   * @returns The operation mode.
   */
  public get operationMode(): string {
    return this.setting('OperationMode')
  }

  /**
   * Active zone-1 operation mode as advertised by the FTC (e.g.
   * `'HeatRoomTemperature'`). Typed as `string` because the controller
   * exposes firmware-specific variants beyond the canonical
   * {@link HomeAtwOperationModeZone} set; callers can narrow at the
   * use site against that union.
   * @returns The zone-1 mode.
   */
  public get operationModeZone1(): string {
    return this.setting('OperationModeZone1')
  }

  /**
   * Active zone-2 operation mode, or `null` when the unit is single-zone.
   * Same typing rationale as {@link operationModeZone1}.
   * @returns The zone-2 mode, or `null`.
   */
  public get operationModeZone2(): string | null {
    if (!this.capabilities.hasZone2) {
      return null
    }
    return this.setting('OperationModeZone2')
  }

  /**
   * Outdoor temperature reported by the FTC, in degrees Celsius.
   * @returns The outdoor temperature.
   */
  public get outdoorTemperature(): number {
    return Number(this.setting('OutdoorTemperature'))
  }

  /**
   * Whether the unit is powered on.
   * @returns `true` when on, `false` otherwise.
   */
  public get power(): boolean {
    return this.setting('Power') === 'True'
  }

  /**
   * Whether hot-water generation is currently inhibited.
   * @returns `true` when prohibited.
   */
  public get prohibitHotWater(): boolean {
    return this.setting('ProhibitHotWater') === 'True'
  }

  /**
   * Last-reported zone-1 room temperature in degrees Celsius.
   * @returns The room temperature.
   */
  public get roomTemperatureZone1(): number {
    return Number(this.setting('RoomTemperatureZone1'))
  }

  /**
   * Last-reported zone-2 room temperature, or `null` for single-zone units.
   * @returns The room temperature, or `null`.
   */
  public get roomTemperatureZone2(): number | null {
    if (!this.capabilities.hasZone2) {
      return null
    }
    return Number(this.setting('RoomTemperatureZone2'))
  }

  /**
   * Configured tank-water target temperature in degrees Celsius.
   * @returns The setpoint.
   */
  public get setTankWaterTemperature(): number {
    return Number(this.setting('SetTankWaterTemperature'))
  }

  /**
   * Configured zone-1 target temperature in degrees Celsius.
   * @returns The setpoint.
   */
  public get setTemperatureZone1(): number {
    return Number(this.setting('SetTemperatureZone1'))
  }

  /**
   * Configured zone-2 target temperature, or `null` for single-zone units.
   * @returns The setpoint, or `null`.
   */
  public get setTemperatureZone2(): number | null {
    if (!this.capabilities.hasZone2) {
      return null
    }
    return Number(this.setting('SetTemperatureZone2'))
  }

  /**
   * Last-reported tank water temperature in degrees Celsius.
   * @returns The tank temperature.
   */
  public get tankWaterTemperature(): number {
    return Number(this.setting('TankWaterTemperature'))
  }

  /**
   * Builds a Home ATW facade backed by the given API client and
   * registry-resident device model.
   * @param api - Home API client.
   * @param model - Backing device model, narrowed to the ATW variant.
   */
  public constructor(api: HomeAPIAdapter, model: HomeDevice<HomeAtwDeviceData>) {
    super(api, model)
  }

  /**
   * Fetches interval-energy telemetry for this device.
   * @param params - Query window plus energy direction.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (e.g. `Hour`, `Day`).
   * @param params.measure - Energy direction (`'consumed'` or `'produced'`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The telemetry bundle, or a typed failure.
   */
  public async getEnergy(params: {
    from: string
    interval: string
    measure: 'consumed' | 'produced'
    to: string
  }): Promise<Result<HomeEnergyData>> {
    return this.api.getAtwEnergy(this.id, params)
  }

  /**
   * Fetches the error-log entries for this device.
   * @returns The entries (possibly empty), or a typed failure.
   */
  public async getErrorLog(): Promise<Result<HomeErrorLogEntry[]>> {
    return this.api.getAtwErrorLog(this.id)
  }

  /**
   * Fetches the internal-temperatures report (flow/return/tank/zone)
   * for this device over the given time window.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `Daily`, `Hourly`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The report datasets, or a typed failure.
   */
  public async getInternalTemperatures(params: {
    from: string
    period: string
    to: string
  }): Promise<Result<HomeReportData[]>> {
    return this.api.getAtwInternalTemperatures(this.id, params)
  }

  /**
   * Fetches the comfort-graph report (outside / room / set temperature)
   * for this device over the given time window.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `Daily`, `Hourly`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns The report datasets, or a typed failure.
   */
  public async getTemperatures(params: {
    from: string
    period: string
    to: string
  }): Promise<Result<HomeReportData[]>> {
    return this.api.getAtwTemperatures(this.id, params)
  }

  /**
   * Pushes a partial setpoint update; throws {@link NoChangesError} when
   * `values` is empty, otherwise clamps zone setpoints to
   * `[minSetTemperature, maxSetTemperature]` and the tank setpoint to
   * `[minSetTankTemperature, maxSetTankTemperature]` before forwarding.
   * @param values - Partial setpoint payload.
   * @returns `true` when the update succeeded.
   */
  public async updateValues(values: HomeAtwValues): Promise<boolean> {
    if (Object.keys(values).length === 0) {
      throw new NoChangesError(this.id)
    }
    return this.api.updateAtwValues(this.id, {
      ...values,
      ...this.#clampSetpoints(values),
    })
  }

  #clampSetpoints({
    setTankWaterTemperature: tank,
    setTemperatureZone1: zone1,
    setTemperatureZone2: zone2,
  }: HomeAtwValues): {
    setTankWaterTemperature?: number
    setTemperatureZone1?: number
    setTemperatureZone2?: number
  } {
    const zone = zoneRange(this.capabilities)
    const result: {
      setTankWaterTemperature?: number
      setTemperatureZone1?: number
      setTemperatureZone2?: number
    } = {}
    if (typeof zone1 === 'number') {
      result.setTemperatureZone1 = clampToRange(zone1, zone)
    }
    if (typeof zone2 === 'number') {
      result.setTemperatureZone2 = clampToRange(zone2, zone)
    }
    if (typeof tank === 'number') {
      result.setTankWaterTemperature = clampToRange(
        tank,
        tankRange(this.capabilities),
      )
    }
    return result
  }
}
