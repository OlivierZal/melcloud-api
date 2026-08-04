// Re-export of `temporal-polyfill` as the single Temporal entry point
// for the rest of the codebase. Node 22 (the minimum supported runtime)
// does not yet ship native `Temporal`; the polyfill stays bundled
// until Node 22 reaches EOL (April 2027), at which point this module
// and the dependency can be replaced with `globalThis.Temporal`.
// The polyfill's default entrypoint delegates to the native `Temporal`
// when the runtime provides one, so newer runtimes get the native
// implementation through this same import.
//
// The polyfill's `Intl` export is re-exported too: it is the
// Temporal-aware `Intl.DateTimeFormat` that formats Temporal objects
// (e.g. `PlainDate`) directly, which the runtime's own `Intl` cannot do
// until it ships the ECMA-402 Temporal integration.
//
// Re-exporting via `export { ... }` preserves both the value and the
// type namespace, so consumers can write `Temporal.Instant.from(...)`
// and `function f(x: Temporal.Instant)` from a single import.

export { Intl, Temporal } from 'temporal-polyfill'
