// Re-export of `temporal-polyfill` as the single Temporal entry point
// for the rest of the codebase. Node 22 (the minimum supported runtime)
// does not yet ship native `Temporal`; the polyfill stays bundled
// until Node 22 reaches EOL (April 2027), at which point this module
// and the dependency can be replaced with `globalThis.Temporal`.
// Since v1, the polyfill's default entrypoint delegates to the native
// `Temporal` when the runtime provides one (0.x never did), so newer
// runtimes get the native implementation through this same import.
//
// Re-exporting via `export { ... }` preserves both the value and the
// type namespace, so consumers can write `Temporal.Instant.from(...)`
// and `function f(x: Temporal.Instant)` from a single import.
export { Temporal } from 'temporal-polyfill'
