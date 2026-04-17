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

  public constructor(device: HomeDeviceData, type: HomeDeviceType) {
    /*
     * Defensive deep copy on ingress so a caller who keeps the original
     * reference around cannot mutate our internal snapshot behind our
     * back. Same rationale for `sync` below.
     */
    this.#data = structuredClone(device)
    this.type = type
  }

  public sync(device: HomeDeviceData): void {
    this.#data = structuredClone(device)
  }
}
