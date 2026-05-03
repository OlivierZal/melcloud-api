import type { HomeDeviceType } from '../constants.ts'
import type { HomeDeviceData } from '../types/index.ts'

/** Mutable wrapper around a HomeDeviceData, preserving object identity across syncs. */
export class HomeDevice {
  public readonly type: HomeDeviceType

  public get data(): Readonly<HomeDeviceData> {
    return this.#data
  }

  public get id(): string {
    return this.#data.id
  }

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
