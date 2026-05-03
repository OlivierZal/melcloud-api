import type { HomeDeviceType } from '../constants.ts'
import type { HomeDeviceData } from '../types/index.ts'

/**
 * Mutable wrapper around a HomeDeviceData, preserving object identity across syncs.
 * @category Entities
 */
export class HomeDevice {
  public readonly type: HomeDeviceType

  /**
   * Last-synced wire-format payload for this device.
   * @returns A read-only snapshot of the device data.
   */
  public get data(): Readonly<HomeDeviceData> {
    return this.#data
  }

  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The device id.
   */
  public get id(): string {
    return this.#data.id
  }

  /**
   * User-facing display name set in the MELCloud Home app.
   * @returns The device's display name.
   */
  public get name(): string {
    return this.#data.givenDisplayName
  }

  #data: HomeDeviceData

  /**
   * Builds a Home device wrapper from a wire-format `HomeDeviceData`
   * entry tagged with its connection type (Ata or Atw).
   * @param device - Wire-format device payload.
   * @param type - Connection-type discriminator.
   */
  public constructor(device: HomeDeviceData, type: HomeDeviceType) {
    this.#data = device
    this.type = type
  }

  /**
   * Replaces the internal data snapshot with a fresh payload while
   * preserving the wrapper's object identity.
   * @param device - Fresh wire-format device payload.
   */
  public sync(device: HomeDeviceData): void {
    this.#data = device
  }
}
