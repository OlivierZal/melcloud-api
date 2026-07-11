import type {
  HomeAtaDeviceData,
  HomeAtwDeviceData,
  HomeDeviceData,
} from '../types/index.ts'
import { HomeDeviceType } from '../constants.ts'

/**
 * Mutable wrapper around a {@link HomeDeviceData}, preserving object identity across syncs.
 * `TData` narrows the wrapped payload to a specific connection-type variant
 * (e.g. {@link HomeAtaDeviceData}) when callers have already discriminated on
 * {@link HomeDevice.type}; defaults to the full union for the registry.
 * @template TData - Wrapped wire-format payload variant: a connection-type
 * specific shape once discriminated, or the full {@link HomeDeviceData} union
 * by default.
 * @category Entities
 */
export class HomeDevice<TData extends HomeDeviceData = HomeDeviceData> {
  public readonly type: HomeDeviceType

  /**
   * Last-synced wire-format payload for this device.
   * @returns A read-only snapshot of the device data.
   */
  public get data(): Readonly<TData> {
    return this.#data
  }

  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The GUID string assigned by MELCloud Home.
   */
  public get id(): string {
    return this.#data.id
  }

  /**
   * Whether the current account owns this device (sourced from
   * `context.buildings`) rather than being a guest of it (sourced from
   * `context.guestBuildings`). Reports the structural origin only:
   * `false` does not by itself prove a guest is barred from control.
   * @returns `true` when owned, `false` when shared with this account.
   */
  public get isOwner(): boolean {
    return this.#isOwner
  }

  /**
   * User-facing display name set in the MELCloud Home app.
   * @returns The device's display name.
   */
  public get name(): string {
    return this.#data.givenDisplayName
  }

  #data: TData

  #isOwner: boolean

  /**
   * Builds a Home device wrapper from a wire-format {@link HomeDeviceData}
   * entry tagged with its connection type (Ata or Atw) and ownership origin.
   * @param device - Wire-format device payload.
   * @param type - Connection-type discriminator.
   * @param isOwner - `true` when sourced from an owned building, `false`
   * when sourced from a guest one.
   */
  public constructor(device: TData, type: HomeDeviceType, isOwner: boolean) {
    this.#data = device
    this.#isOwner = isOwner
    this.type = type
  }

  /**
   * Type predicate that narrows this wrapper to the ATA variant when its
   * connection-type discriminator is {@link HomeDeviceType.Ata}.
   * @returns `true` when the wrapped payload is an ATA device.
   */
  public isAta(): this is HomeDevice<HomeAtaDeviceData> {
    return this.type === HomeDeviceType.Ata
  }

  /**
   * Type predicate that narrows this wrapper to the ATW variant when its
   * connection-type discriminator is {@link HomeDeviceType.Atw}.
   * @returns `true` when the wrapped payload is an ATW device.
   */
  public isAtw(): this is HomeDevice<HomeAtwDeviceData> {
    return this.type === HomeDeviceType.Atw
  }

  /**
   * Replaces the internal data snapshot with a fresh payload while
   * preserving the wrapper's object identity. Every sync restates the
   * ownership origin, so a share/unshare between syncs is reflected
   * rather than kept from a stale tag.
   * @param device - Fresh wire-format device payload.
   * @param isOwner - Ownership origin from the current sync.
   */
  public sync(device: TData, isOwner: boolean): void {
    this.#data = device
    this.#isOwner = isOwner
  }
}
