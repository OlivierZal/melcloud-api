import type { DeviceType } from '../enums.js'
import type { IAPI } from '../services/interfaces.js'
import type { ListDevice, ZoneSettings } from '../types/index.js'

export const fetchDevices = <
  T extends ListDevice[keyof typeof DeviceType]['Device'] | ZoneSettings,
>(
  target: (...args: unknown[]) => Promise<T>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(this: { api: IAPI }, ...args: unknown[]) {
    await this.api.fetch()
    return target.call(this, ...args)
  }
