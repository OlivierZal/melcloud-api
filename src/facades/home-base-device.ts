import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type { AvailabilityAware } from '../entities/types.ts'
import { EntityNotFoundError } from '../errors/index.ts'
import {
  type HomeDeviceData,
  type HomeEnergyData,
  type HomeFrostProtection,
  type HomeHolidayMode,
  type Hour,
  type Result,
  mapResult,
} from '../types/index.ts'
import type { ReportChartLineOptions } from './report-types.ts'
import {
  resolveHomeDayWindow,
  resolveHomeHourWindow,
  toHomeSignalOptions,
  toHomeWireWindow,
} from './home-report.ts'

/**
 * Shared scaffolding for every Home device facade. Holds the API
 * client + registry-resident model, exposes the common identity
 * getters (`id`, `name`, `rssi`) and the cross-type `getSignal`
 * passthrough, and provides the protected `setting()` lookup used by
 * both the ATA and ATW facade subclasses.
 *
 * `TData` narrows the wrapped device payload (e.g. `HomeAtaDeviceData`
 * for {@link HomeDeviceAtaFacade}) so subclasses see the device-type
 * specific shape on `model.data` without unsafe casts.
 *
 * The class is intentionally thin: anything that diverges between
 * ATA and ATW (operation modes, capability fields, update payload
 * shape, telemetry endpoints) lives in the subclass.
 * @template TData - Wire-format device payload variant exposed on
 * `model.data`, narrowed to the device-type-specific shape by each subclass.
 * @category Facades
 */
export abstract class HomeBaseDeviceFacade<
  TData extends HomeDeviceData,
> implements AvailabilityAware {
  /**
   * Whether the underlying device still exists in the registry.
   * Non-throwing introspection mirroring the Classic facades' `exists`:
   * a consumer holding a cached facade can detect staleness without a
   * try/catch.
   * @returns `true` while the registry still resolves the id.
   */
  public get exists(): boolean {
    return this.api.registry.getById(this.#id) !== undefined
  }

  /**
   * Current frost-protection settings, or `null` when not configured.
   * @returns The frost-protection descriptor from `/context`.
   */
  public get frostProtection(): HomeFrostProtection | null {
    return this.model.data.frostProtection
  }

  /**
   * Current holiday-mode window, or `null` when not configured.
   * @returns The holiday-mode descriptor from `/context`.
   */
  public get holidayMode(): HomeHolidayMode | null {
    return this.model.data.holidayMode
  }

  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The GUID string assigned by MELCloud Home.
   */
  public get id(): string {
    return this.#id
  }

  /**
   * Whether MELCloud can still deliver writes to the unit. `false`
   * means the wifi adapter lost its link to the cloud: writes are
   * accepted but never delivered, and readings go stale.
   * @returns The `/context` connectivity flag.
   */
  public get isAvailable(): boolean {
    return this.model.data.isConnected
  }

  /**
   * Whether the current account owns this device rather than being a
   * guest of it. Reports the structural origin only: `false` does not
   * by itself prove a guest is barred from control (the BFF accepts
   * guest writes on shared units).
   * @returns `true` when owned, `false` when shared with this account.
   */
  public get isOwner(): boolean {
    return this.model.isOwner
  }

  /**
   * User-facing display name set in the MELCloud Home app.
   * @returns The device's display name.
   */
  public get name(): string {
    return this.model.name
  }

  /**
   * Last-reported Wi-Fi signal strength of the device adapter, in dBm.
   * @returns The RSSI value.
   */
  public get rssi(): number {
    return this.model.data.rssi
  }

  protected readonly api: HomeAPIAdapter

  /**
   * IANA timezone anchoring chart windows and labels, from the API
   * configuration; the Home wire itself always speaks UTC wall-clock.
   * @returns The display timezone, UTC when unconfigured.
   */
  protected get chartTimezone(): string {
    return this.api.timezone ?? 'UTC'
  }

  /**
   * Registry-resident model resolved by id on every access, so a
   * long-lived facade never reads a pruned wrapper's frozen snapshot
   * (a logout/login cycle rebuilds the registry with new wrappers —
   * a pinned reference froze `isConnected` and kept a healed unit
   * unavailable forever).
   * @returns The current model for this facade's id.
   * @throws EntityNotFoundError when the registry no longer holds the id.
   */
  protected get model(): HomeDevice<TData> {
    const model = this.api.registry.getById(this.#id)
    if (model === undefined) {
      throw new EntityNotFoundError('Device', { entityId: this.#id })
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the id was minted from a TData-shaped model and a physical device never changes type
    return model as HomeDevice<TData>
  }

  readonly #id: string

  /**
   * Builds a Home device facade backed by the given API client and
   * registry-resident device model. Only the model's id is retained:
   * every later access re-resolves through the registry.
   * @param api - Home API client.
   * @param model - Backing device model, narrowed to a specific variant.
   */
  protected constructor(api: HomeAPIAdapter, model: HomeDevice<TData>) {
    this.api = api
    this.#id = model.id
  }

  /**
   * Pushes a partial update to the device. Each subclass narrows the
   * payload to its device-type shape; both shapes share the `power`
   * field this base's {@link updatePower} relies on.
   * @param values - Partial update payload.
   */
  public abstract updateValues(values: {
    power?: boolean | null
  }): Promise<void>

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
    return this.api.getSignal(this.id, params)
  }

  /**
   * Fetches the Wi-Fi signal chart — the whole of today on a
   * five-minute grid, or one specific hour on a minute grid. The Home
   * counterpart of the Classic `getSignalStrength` contract.
   * @param hour - Optional hour of today (0-23); omitted covers today.
   * @returns Structured line chart options (`dBm`), or a typed failure.
   */
  public async getSignalStrength(
    hour?: Hour,
  ): Promise<Result<ReportChartLineOptions>> {
    const { cutoff, window } =
      hour === undefined
        ? resolveHomeDayWindow(this.chartTimezone)
        : {
            cutoff: undefined,
            window: resolveHomeHourWindow(hour, this.chartTimezone),
          }
    return mapResult(
      await this.api.getSignal(this.id, toHomeWireWindow(window)),
      (data) =>
        toHomeSignalOptions({
          cutoff,
          data,
          gridUnit: hour === undefined ? 'fiveMinutes' : 'minute',
          locale: this.api.locale,
          name: this.name,
          window,
        }),
    )
  }

  /**
   * Powers the unit on or off. This is the unit-level master power (the
   * `Power` setting, shown as the system on/off toggle in the app),
   * defined at the base like the Classic side's `updatePower` — the
   * contracts differ: this one resolves `void` and throws the typed
   * transport error. Convenience wrapper over {@link updateValues}.
   * @param isOn - `true` to power on, `false` to power off.
   */
  public async updatePower(isOn = true): Promise<void> {
    await this.updateValues({ power: isOn })
  }

  /**
   * Looks up a setting value by name from the device's settings array,
   * returning the empty string when the setting is absent. Subclasses
   * layer typed accessors on top.
   * @param name - Setting name (e.g. `'Power'`, `'OperationModeZone1'`).
   * @returns The setting value, or `''` when not present.
   */
  protected setting(name: string): string {
    return (
      this.model.data.settings.find((entry) => entry.name === name)?.value ?? ''
    )
  }

  /**
   * Reads a boolean device setting (the BFF serializes them as
   * `'True'`/`'False'` strings).
   * @param name - Setting name (e.g. `'Power'`).
   * @returns `true` when the wire value is the string `'True'`.
   */
  protected settingBool(name: string): boolean {
    return this.setting(name) === 'True'
  }

  /**
   * Reads a numeric device setting (the BFF serializes numbers as
   * strings). An absent setting reads `0` (`Number('')`).
   * @param name - Setting name (e.g. `'RoomTemperatureZone1'`).
   * @returns The wire string parsed as a number, `0` when absent.
   */
  protected settingNumber(name: string): number {
    return Number(this.setting(name))
  }
}
