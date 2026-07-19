import type { SettingManager } from '../api/types.ts'

interface HasSettingManager {
  settingManager?: SettingManager | undefined
}

/**
 * Accessor decorator that delegates storage to an external `SettingManager`
 * (e.g. persistent settings), falling back to the in-memory field when none
 * is configured. The setting key is resolved once at decoration time rather
 * than on every get/set.
 * @param target - The underlying accessor descriptor provided by the runtime.
 * @param context - The accessor decoration context carrying the property name.
 * @returns The replacement accessor that routes through `settingManager` when present.
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
      const { settingManager } = this
      if (settingManager !== undefined) {
        // An empty string is the cleared sentinel for every persisted
        // field (credentials, tokens, context key, expiry): delete the
        // key outright when the host delegates `unset`, so a logout
        // leaves no empty leftovers. `get` falls back to the accessor's
        // own `''` default when the key is absent, so this reads back
        // identically.
        if (value === '' && settingManager.unset !== undefined) {
          settingManager.unset(key)
        } else {
          settingManager.set(key, value)
        }
        return
      }
      target.set.call(this, value)
    },
  }
}

export { setting }
