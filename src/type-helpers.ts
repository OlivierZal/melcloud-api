/** Type-safe `Object.keys` that preserves the key type of the input object. */
export const typedKeys = <T extends Record<string, unknown>>(
  object: T,
): (string & keyof T)[] => Object.keys(object) as (string & keyof T)[]
