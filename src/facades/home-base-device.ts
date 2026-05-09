import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import type {
  HomeDeviceData,
  HomeEnergyData,
  Result,
} from '../types/index.ts'

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
 * @category Facades
 */
export abstract class HomeBaseDeviceFacade<TData extends HomeDeviceData> {
  /**
   * Last-synced wire-format payload for this device. Mirrors the
   * `data` accessor exposed by Classic facades so consumers always
   * have a typed escape hatch to fields the SDK does not surface
   * through dedicated getters.
   * @returns A read-only snapshot of the device data.
   */
  public get data(): Readonly<TData> {
    return this.model.data
  }

  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The device id.
   */
  public get id(): string {
    return this.model.id
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
   * Looks up a setting value by name from the device's settings array,
   * returning the empty string when the setting is absent. Subclasses
   * layer typed accessors on top.
   * @param name - Setting name (e.g. `'Power'`, `'OperationModeZone1'`).
   * @returns The setting value, or `''` when not present.
   */
  protected setting(name: string): string {
    return (
      this.model.data.settings.find((entry) => entry.name === name)?.value ??
      ''
    )
  }
}
