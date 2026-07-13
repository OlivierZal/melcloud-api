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
import {
  ClassicOperationModeStateHotWater,
  ClassicOperationModeStateZone,
  HomeAtwOperationalState,
  HomeAtwZoneMode,
} from '../constants.ts'
import { NoChangesError } from '../errors/index.ts'
import { clampToRange, omitUndefined } from '../utils.ts'
import { HomeBaseDeviceFacade } from './home-base-device.ts'

interface TemperatureRange {
  max: number
  min: number
}

// Mirrors the Classic hot-water derivation: the FTC operation mode marks
// active DHW production or a legionella cycle; every other mode reads idle.
const hotWaterStateFromOperationMode: Partial<
  Record<string, ClassicOperationModeStateHotWater>
> = {
  HotWater: ClassicOperationModeStateHotWater.dhw,
  // Live-captured 2026-07-13 during a running cycle; the bare
  // `Legionella` spelling stays as defensive tolerance.
  Legionella: ClassicOperationModeStateHotWater.legionella,
  LegionellaPrevention: ClassicOperationModeStateHotWater.legionella,
}

// FTC `OperationMode` normalized to the Classic state vocabulary; `Stop`
// reads idle and unknown firmware strings read `null` (no state).
const operationalStateFromOperationMode: Partial<
  Record<string, HomeAtwOperationalState>
> = {
  Cooling: HomeAtwOperationalState.cooling,
  Defrost: HomeAtwOperationalState.defrost,
  Heating: HomeAtwOperationalState.heating,
  HotWater: HomeAtwOperationalState.dhw,
  Idle: HomeAtwOperationalState.idle,
  // Live-captured 2026-07-13; the bare spelling stays as tolerance.
  Legionella: HomeAtwOperationalState.legionella,
  LegionellaPrevention: HomeAtwOperationalState.legionella,
  Stop: HomeAtwOperationalState.idle,
}

// Mirrors the Classic zone derivation minus its flag refinements: the
// `Idle{Zone}`/`Prohibit*` inputs are absent from the Home wire, so the
// zone state is the top-level `OperationMode` projection — the same one
// the MELCloud Home app displays (a running legionella cycle shows the
// zone as idle).
const zoneStateFromOperationMode: Partial<
  Record<string, ClassicOperationModeStateZone>
> = {
  Cooling: ClassicOperationModeStateZone.cooling,
  Defrost: ClassicOperationModeStateZone.defrost,
  Heating: ClassicOperationModeStateZone.heating,
}

// FTC zone operation modes normalized to the control basis. The external
// `*Thermostat` variants and unknown firmware strings degrade to the room
// modes so new FTC vocabulary can never break a consumer's sync.
const zoneModeFromWire: Partial<Record<string, HomeAtwZoneMode>> = {
  CoolFlowTemperature: HomeAtwZoneMode.flowCool,
  CoolRoomTemperature: HomeAtwZoneMode.roomCool,
  CoolThermostat: HomeAtwZoneMode.roomCool,
  HeatCurve: HomeAtwZoneMode.curve,
  HeatFlowTemperature: HomeAtwZoneMode.flow,
  HeatRoomTemperature: HomeAtwZoneMode.room,
  HeatThermostat: HomeAtwZoneMode.room,
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
    return this.settingBool('ForcedHotWaterMode')
  }

  /**
   * Whether the device firmware reports cooling-mode support. Distinct
   * from {@link HomeAtwDeviceCapabilities.hasHeatZone1}/`hasHeatZone2`
   * (per-zone heat capability) — this flag mirrors the `HasCoolingMode`
   * setting from `/context`.
   * @returns `true` when the device reports cooling mode availability.
   */
  public get hasCoolingMode(): boolean {
    return this.settingBool('HasCoolingMode')
  }

  /**
   * Derived hot-water operational state, mirroring the Classic ATW
   * facade's `hotWater.operationalState`: forced production reads `dhw`,
   * a prohibit flag reads `prohibited`, otherwise the FTC operation mode
   * decides between `dhw`, `legionella` and `idle`.
   * @returns The derived hot-water state.
   */
  public get hotWaterOperationalState(): ClassicOperationModeStateHotWater {
    if (this.forcedHotWaterMode) {
      return ClassicOperationModeStateHotWater.dhw
    }
    return this.prohibitHotWater ?
        ClassicOperationModeStateHotWater.prohibited
      : (hotWaterStateFromOperationMode[this.operationMode] ??
          ClassicOperationModeStateHotWater.idle)
  }

  /**
   * Whether the unit is in standby (powered, but idle).
   * @returns `true` when on standby.
   */
  public get inStandbyMode(): boolean {
    return this.settingBool('InStandbyMode')
  }

  /**
   * Top-level derived operational state, the FTC {@link operationMode}
   * normalized to the Classic state vocabulary (`Stop` reads `idle`).
   * Unknown firmware strings read `null`.
   * @returns The derived state, or `null` when the mode is unknown.
   */
  public get operationalState(): HomeAtwOperationalState | null {
    return operationalStateFromOperationMode[this.operationMode] ?? null
  }

  /**
   * Zone-1 derived operational state: the top-level {@link operationMode}
   * projected onto the zone (`Heating`/`Cooling`/`Defrost` map through,
   * everything else — hot water, legionella, stop, unknown — reads
   * `idle`), matching what the MELCloud Home app displays. The Classic
   * flag refinements (`Idle{Zone}`, `Prohibit*`) do not exist on the
   * Home wire, so `prohibited` is never produced.
   * @returns The derived zone-1 state.
   */
  public get operationalStateZone1(): ClassicOperationModeStateZone {
    return (
      zoneStateFromOperationMode[this.operationMode] ??
      ClassicOperationModeStateZone.idle
    )
  }

  /**
   * Zone-2 derived operational state, or `null` when the unit is
   * single-zone. Same projection as {@link operationalStateZone1}.
   * @returns The derived zone-2 state, or `null`.
   */
  public get operationalStateZone2(): ClassicOperationModeStateZone | null {
    return this.#whenZone2(this.operationalStateZone1)
  }

  /**
   * Top-level operation mode advertised by the FTC controller. Values
   * include `Stop` and the heat/cool modes; the SDK does not narrow
   * further because the controller exposes other strings on some
   * firmware revisions.
   * @returns The raw mode string as reported by the FTC.
   */
  public get operationMode(): string {
    return this.setting('OperationMode')
  }

  /**
   * Active zone-1 control basis, normalized from the FTC zone operation
   * mode (`'HeatCurve'` reads `'curve'`, the external `*Thermostat`
   * variants and unknown firmware strings degrade to the room modes).
   * @returns The zone-1 mode.
   */
  public get operationModeZone1(): HomeAtwZoneMode {
    return (
      zoneModeFromWire[this.setting('OperationModeZone1')] ??
      HomeAtwZoneMode.room
    )
  }

  /**
   * Active zone-2 control basis, or `null` when the unit is single-zone.
   * Same normalization as {@link operationModeZone1}.
   * @returns The zone-2 mode, or `null`.
   */
  public get operationModeZone2(): HomeAtwZoneMode | null {
    return this.#whenZone2(
      zoneModeFromWire[this.setting('OperationModeZone2')] ??
        HomeAtwZoneMode.room,
    )
  }

  /**
   * Outdoor temperature reported by the FTC, in degrees Celsius.
   * @returns Degrees Celsius as measured at the outdoor unit.
   */
  public get outdoorTemperature(): number {
    return this.settingNumber('OutdoorTemperature')
  }

  /**
   * Whether the unit is powered on.
   * @returns `true` when on, `false` otherwise.
   */
  public get power(): boolean {
    return this.settingBool('Power')
  }

  /**
   * Whether hot-water generation is currently inhibited.
   * @returns `true` when prohibited.
   */
  public get prohibitHotWater(): boolean {
    return this.settingBool('ProhibitHotWater')
  }

  /**
   * Last-reported zone-1 room temperature in degrees Celsius.
   * @returns Degrees Celsius for the zone-1 thermostat.
   */
  public get roomTemperatureZone1(): number {
    return this.settingNumber('RoomTemperatureZone1')
  }

  /**
   * Last-reported zone-2 room temperature, or `null` for single-zone units.
   * @returns The room temperature, or `null`.
   */
  public get roomTemperatureZone2(): number | null {
    return this.#whenZone2(this.settingNumber('RoomTemperatureZone2'))
  }

  /**
   * Configured tank-water target temperature in degrees Celsius.
   * @returns The setpoint.
   */
  public get setTankWaterTemperature(): number {
    return this.settingNumber('SetTankWaterTemperature')
  }

  /**
   * Configured zone-1 target temperature in degrees Celsius.
   * @returns The setpoint.
   */
  public get setTemperatureZone1(): number {
    return this.settingNumber('SetTemperatureZone1')
  }

  /**
   * Configured zone-2 target temperature, or `null` for single-zone units.
   * @returns The setpoint, or `null`.
   */
  public get setTemperatureZone2(): number | null {
    return this.#whenZone2(this.settingNumber('SetTemperatureZone2'))
  }

  /**
   * Last-reported tank water temperature in degrees Celsius.
   * @returns Degrees Celsius of the domestic hot-water tank.
   */
  public get tankWaterTemperature(): number {
    return this.settingNumber('TankWaterTemperature')
  }

  /**
   * Builds a Home ATW facade backed by the given API client and
   * registry-resident device model.
   * @param api - Home API client.
   * @param model - Backing device model, narrowed to the ATW variant.
   */
  public constructor(
    api: HomeAPIAdapter,
    model: HomeDevice<HomeAtwDeviceData>,
  ) {
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
   * `values` carries no defined value (an explicitly-`undefined` key
   * counts as absent), otherwise clamps zone setpoints to
   * `[minSetTemperature, maxSetTemperature]` and the tank setpoint to
   * `[minSetTankTemperature, maxSetTankTemperature]` before forwarding.
   * @param values - Partial setpoint payload.
   */
  public override async updateValues(values: HomeAtwValues): Promise<void> {
    const changes = omitUndefined(values)
    if (Object.keys(changes).length === 0) {
      throw new NoChangesError(this.id)
    }
    await this.api.updateAtwValues(this.id, {
      ...changes,
      ...this.#clampSetpoints(changes),
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

  // Zone-2 accessors share the single-zone null: the capability flag is
  // the only wire signal a second zone exists.
  #whenZone2<T>(value: T): T | null {
    return this.capabilities.hasZone2 ? value : null
  }
}
