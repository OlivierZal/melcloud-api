export const typedKeys = <T extends Record<string, unknown>>(
  object: T,
): (string & keyof T)[] => Object.keys(object) as (string & keyof T)[]
