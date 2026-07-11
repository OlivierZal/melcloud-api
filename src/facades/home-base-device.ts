import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type { HomeDeviceData, HomeEnergyData, Result } from '../types/index.ts'

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
export abstract class HomeBaseDeviceFacade<TData extends HomeDeviceData> {
  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The GUID string assigned by MELCloud Home.
   */
  public get id(): string {
    return this.model.id
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

  protected readonly model: HomeDevice<TData>

  /**
   * Builds a Home device facade backed by the given API client and
   * registry-resident device model.
   * @param api - Home API client.
   * @param model - Backing device model, narrowed to a specific variant.
   */
  protected constructor(api: HomeAPIAdapter, model: HomeDevice<TData>) {
    this.api = api
    this.model = model
  }

  /**
   * Pushes a partial update to the device. Each subclass narrows the
   * payload to its device-type shape; both shapes share the `power`
   * field this base's {@link updatePower} relies on.
   * @param values - Partial update payload.
   * @returns `true` when the update succeeded.
   */
  public abstract updateValues(values: {
    power?: boolean | null
  }): Promise<boolean>

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
   * Powers the unit on or off. This is the unit-level master power (the
   * `Power` setting, shown as the system on/off toggle in the app),
   * mirroring the Classic facade's `updatePower` contract. Convenience
   * wrapper over {@link updateValues}.
   * @param isOn - `true` to power on, `false` to power off.
   * @returns `true` when the update succeeded.
   */
  public async updatePower(isOn = true): Promise<boolean> {
    return this.updateValues({ power: isOn })
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
}
