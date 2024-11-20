import type { DeviceType } from '../enums.js'
import type { IAPI } from '../services/interfaces.js'
import type { ListDeviceData, ZoneSettings } from '../types/index.js'

export const fetchDevices = <
  T extends ListDeviceData<DeviceType> | ZoneSettings,
>(
  target: (...args: unknown[]) => Promise<T>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(this: { api: IAPI }, ...args: unknown[]) {
    await this.api.fetch()
    return target.call(this, ...args)
  }
