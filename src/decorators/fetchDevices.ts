import type { DeviceType } from '../enums.js'
import type { BaseFacade } from '../facades/base.js'
import type { BuildingModel } from '../models/index.js'
import type { DeviceModelAny } from '../models/interfaces.js'
import type { ListDevice, ZoneSettings } from '../types/index.js'

export const fetchDevices = <
  T extends ListDevice[keyof typeof DeviceType]['Device'] | ZoneSettings,
>(
  target: (...args: any[]) => Promise<T>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(
    this: BaseFacade<BuildingModel | DeviceModelAny>,
    ...args: unknown[]
  ) {
    await this.api.fetchAndSync()
    return target.call(this, ...args)
  }
