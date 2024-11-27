import type { DeviceType } from '../enums.ts'
import type { IAPI } from '../services/interfaces.ts'
import type { ListDeviceData, ZoneSettings } from '../types/common.ts'

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
