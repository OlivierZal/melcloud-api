import type { SettingManager } from '../services/interfaces.ts'

interface HasSettingManager {
  settingManager?: SettingManager
}

/*
 * Accessor decorator that delegates storage to an external SettingManager
 * (e.g., persistent settings), falling back to the in-memory field when none is configured.
 * Validates the setting key once at decoration time rather than on every get/set.
 */
const setting = (
  target: ClassAccessorDecoratorTarget<HasSettingManager, string>,
  context: ClassAccessorDecoratorContext,
): ClassAccessorDecoratorResult<HasSettingManager, string> => {
  const key = String(context.name)
  return {
    get(this: HasSettingManager): string {
      return this.settingManager?.get(key) ?? target.get.call(this)
    },
    set(this: HasSettingManager, value: string): void {
      if (this.settingManager) {
        this.settingManager.set(key, value)
        return
      }
      target.set.call(this, value)
    },
  }
}

export { setting }
