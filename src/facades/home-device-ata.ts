import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
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
import {
  type ClassicFailureData,
  type ClassicGroupState,
  type ClassicSuccessData,
  type HomeAtaDeviceCapabilities,
  type HomeAtaDeviceData,
  type HomeAtaValues,
  type HomeEnergyData,
  type HomeErrorLogEntry,
  type HomeReportData,
  type Result,
  ok,
} from '../types/index.ts'
import { clampToRange, omitUndefined } from '../utils.ts'
import { toClassicAtaGroupState, toHomeAtaValues } from './home-ata-group.ts'
import { HomeBaseDeviceFacade } from './home-base-device.ts'

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

/**
 * Facade for a MELCloud Home ATA device. Provides typed access to device
 * settings and per-mode temperature clamping before forwarding updates
 * to the BFF.
 * @category Facades
 */
export class HomeDeviceAtaFacade extends HomeBaseDeviceFacade<HomeAtaDeviceData> {
  /**
   * Static capability flags and per-mode temperature bounds advertised
   * by this device.
   * @returns The capability descriptor.
   */
  public get capabilities(): HomeAtaDeviceCapabilities {
    return this.model.data.capabilities
  }

  /**
   * Currently active operation mode (heat/cool/auto/dry/fan/off). The
   * type documents the known vocabulary; unknown or absent wire values
   * pass through unchecked (see `#enumSetting`), so exhaustive
   * switches should keep a default arm.
   * @returns The operation mode — a `HomeOperationMode` member for known
   * wire values, an unchecked wire string otherwise.
   */
  public get operationMode(): HomeOperationMode {
    return this.#enumSetting('OperationMode')
  }

  /**
   * Whether the unit is powered on.
   * @returns `true` when on, `false` when standby.
   */
  public get power(): boolean {
    return this.settingBool('Power')
  }

  /**
   * Last-reported room temperature in degrees Celsius.
   * @returns Degrees Celsius as last reported by the device.
   */
  public get roomTemperature(): number {
    return this.settingNumber('RoomTemperature')
  }

  /**
   * Currently configured fan speed. Normalised from MELCloud Home's
   * inconsistent stringified-number representation back to the enum.
   * @returns A `HomeFanSpeed` enum value, `auto` when unset.
   */
  public get setFanSpeed(): HomeFanSpeed {
    // MELCloud Home API inconsistency: SetFanSpeed returns a stringified
    // number ("0") instead of the enum name ("Auto") like other settings.
    // Normalize via fanSpeedFromClassic, falling back to raw if already a name.
    const raw = this.setting('SetFanSpeed')
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
    return this.settingNumber('SetTemperature')
  }

  /**
   * Currently configured horizontal vane direction. Same pass-through
   * contract as {@link operationMode}.
   * @returns The horizontal vane setting.
   */
  public get vaneHorizontalDirection(): HomeHorizontal {
    return this.#enumSetting('VaneHorizontalDirection')
  }

  /**
   * Currently configured vertical vane direction. Same pass-through
   * contract as {@link operationMode}.
   * @returns The vertical vane setting.
   */
  public get vaneVerticalDirection(): HomeVertical {
    return this.#enumSetting('VaneVerticalDirection')
  }

  /**
   * Builds a Home ATA facade backed by the given API client and
   * registry-resident device model.
   * @param api - Home API client.
   * @param model - Backing device model, narrowed to the ATA variant.
   */
  public constructor(
    api: HomeAPIAdapter,
    model: HomeDevice<HomeAtaDeviceData>,
  ) {
    super(api, model)
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
    return this.api.getAtaEnergy(this.id, params)
  }

  /**
   * Fetches the error-log entries for this device.
   * @returns The entries (possibly empty), or a typed failure.
   */
  public async getErrorLog(): Promise<Result<HomeErrorLogEntry[]>> {
    return this.api.getAtaErrorLog(this.id)
  }

  /**
   * Read this device's current state projected as a Classic group state,
   * treating the device as a group of one: MELCloud Home has no group
   * endpoint, so the already-synced values are reused with no wire call.
   * @returns A success result wrapping the device's group state.
   */
  // Pure projection of cached data; the `await Promise.resolve(...)` shape
  // satisfies the async group contract shared with the Classic facades
  // without an eslint disable (see `fetch` in classic-base-device.ts).
  public async getGroup(): Promise<Result<ClassicGroupState>> {
    const source = await Promise.resolve(this)
    return ok(toClassicAtaGroupState(source))
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
    return this.api.getAtaTemperatures(this.id, params)
  }

  /**
   * Apply a Classic group state to this device: the delta is translated to
   * the Home vocabulary and pushed through the native per-device update
   * path. Group writes are no-op tolerant: an all-null delta translates to
   * nothing and resolves without a wire call, and a device already matching
   * the delta (a {@link NoChangesError} from its update) counts as success.
   * @param state - Partial Classic group state to push to the device.
   * @returns The zone-shaped success outcome once the write completes.
   */
  public async updateGroupState(
    state: ClassicGroupState,
  ): Promise<ClassicFailureData | ClassicSuccessData> {
    const values = toHomeAtaValues(state)
    if (Object.keys(values).length > 0) {
      try {
        await this.updateValues(values)
      } catch (error) {
        // A device already matching the group state is fine by definition —
        // zone group writes are no-op tolerant, so the group-of-one is too.
        if (!(error instanceof NoChangesError)) {
          throw error
        }
      }
    }
    return { AttributeErrors: null, Success: true }
  }

  /**
   * Pushes a partial setpoint update; throws {@link NoChangesError} when
   * `values` carries no defined value (an explicitly-`undefined` key
   * counts as absent), otherwise clamps `setTemperature` to the active
   * mode's bounds and forwards.
   * @param values - Partial setpoint payload.
   */
  public override async updateValues(values: HomeAtaValues): Promise<void> {
    const changes = omitUndefined(values)
    if (Object.keys(changes).length === 0) {
      throw new NoChangesError(this.id)
    }
    await this.api.updateAtaValues(this.id, {
      ...changes,
      ...this.#clampSetTemperature(changes),
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
    return getRange === undefined ?
        { setTemperature: value }
      : { setTemperature: clampToRange(value, getRange(this.capabilities)) }
  }

  // Typed reads of the enum-backed settings. The overloads deliberately
  // pass unknown wire values through (no validation, no degradation):
  // the setpoint clamp falls back to no-clamp on out-of-vocabulary
  // modes, and inventing a member here would silently clamp with the
  // wrong range.
  #enumSetting(name: 'OperationMode'): HomeOperationMode

  #enumSetting(name: 'VaneHorizontalDirection'): HomeHorizontal

  #enumSetting(name: 'VaneVerticalDirection'): HomeVertical

  #enumSetting(name: string): unknown {
    return this.setting(name)
  }
}
