import type { HomeDeviceType } from '../constants.ts'
import type { HomeDeviceData } from '../types/index.ts'

/** Mutable wrapper around a HomeDeviceData, preserving object identity across syncs. */
export class HomeDevice {
  public readonly type: HomeDeviceType

  public get data(): HomeDeviceData {
    return this.#data
  }

  public get id(): string {
    return this.#data.id
  }

  public get name(): string {
    return this.#data.givenDisplayName
  }

  #data: HomeDeviceData

  public constructor(device: HomeDeviceData, type: HomeDeviceType) {
    this.#data = device
    this.type = type
  }

  public sync(device: HomeDeviceData): void {
    this.#data = device
  }
}
