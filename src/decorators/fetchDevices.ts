import type { BaseFacade } from '../facades'
import type { BuildingModel, DeviceModelAny } from '../models'
import type { DeviceType, ListDevice, ZoneSettings } from '../types'

export default <
  T extends ListDevice[keyof typeof DeviceType]['Device'] | ZoneSettings,
>(
  target: (...args: any[]) => Promise<T>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(
    this: BaseFacade<BuildingModel | DeviceModelAny>,
    ...args: unknown[]
  ) {
    await this.api.fetch()
    return target.call(this, ...args)
  }
