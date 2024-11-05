import { isAPISetting } from '../services/interfaces.js'

import type { API } from '../services/api.js'

export const setting = <This extends API>(
  target: ClassAccessorDecoratorTarget<This, string>,
  context: ClassAccessorDecoratorContext<This, string>,
): ClassAccessorDecoratorResult<This, string> => ({
  get(this: This): string {
    const key = String(context.name)
    if (!isAPISetting(key)) {
      throw new Error(`Invalid setting: ${key}`)
    }
    return this.settingManager?.get(key) ?? target.get.call(this)
  },
  set(this: This, value: string): void {
    const key = String(context.name)
    if (!isAPISetting(key)) {
      throw new Error(`Invalid setting: ${key}`)
    }
    if (this.settingManager) {
      this.settingManager.set(key, value)
      return
    }
    target.set.call(this, value)
  },
})
