/**
 * Symbol key for the internal sync method on model classes.
 * Only code that imports this symbol can call the sync method,
 * keeping it invisible to library consumers.
 */
export const syncModel = Symbol('syncModel')
