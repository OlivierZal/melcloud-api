/**
 * Fully-resolved counterpart of an undefined-tolerant input shape:
 * every property present and defined (defaults applied). Under
 * `exactOptionalPropertyTypes`, `Required<T>` removes `?` but keeps an
 * explicit `| undefined` in the property type; this also strips it.
 * `null` is preserved — in this domain it is a sentinel, not an
 * absence marker.
 * @template T - Input shape whose optional properties admit `undefined`.
 * @category Types
 */
export type Resolved<T> = {
  [K in keyof T]-?: Exclude<T[K], undefined>
}

/**
 * Optional form of `T` whose properties may also be explicitly
 * `undefined` — the input-side counterpart of `Partial<T>` under
 * `exactOptionalPropertyTypes` (whose mapped `?` does not admit a
 * present-`undefined` key). For inputs whose runtime treats a
 * present-`undefined` key exactly like an absent one.
 * @template T - Exact shape being widened into a tolerant input.
 * @category Types
 */
export type UndefinedTolerant<T> = {
  [K in keyof T]?: T[K] | undefined
}
