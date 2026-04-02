import type { DeviceType } from '../constants.ts'
import type { HomeDevice } from '../types/index.ts'

/** Mutable wrapper around a HomeDevice, preserving object identity across syncs. */
export class HomeDeviceModel {
  #data: HomeDevice

  public readonly type: DeviceType

  public get data(): HomeDevice {
    return this.#data
  }

  public get id(): string {
    return this.#data.id
  }

  public get name(): string {
    return this.#data.givenDisplayName
  }

  public constructor(device: HomeDevice, type: DeviceType) {
    this.#data = device
    this.type = type
  }

  public sync(device: HomeDevice): void {
    this.#data = device
  }
}
