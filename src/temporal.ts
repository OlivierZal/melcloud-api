// Re-export of `temporal-polyfill` as the single Temporal entry point
// for the rest of the codebase. Node 22 (the minimum supported runtime)
// does not yet ship native `Temporal`; the polyfill stays bundled
// until Node 22 reaches EOL (April 2027), at which point this module
// and the dependency can be replaced with `globalThis.Temporal`.
// Since v1, the polyfill's default entrypoint delegates to the native
// `Temporal` when the runtime provides one (0.x never did), so newer
// runtimes get the native implementation through this same import.
//
// The polyfill's `Intl` export is re-exported too: it is the
// Temporal-aware `Intl.DateTimeFormat` that formats Temporal objects
// (e.g. `PlainDate`) directly, which the runtime's own `Intl` cannot do
// until it ships the ECMA-402 Temporal integration.
//
// Re-exporting via `export { ... }` preserves both the value and the
// type namespace, so consumers can write `Temporal.Instant.from(...)`
// and `function f(x: Temporal.Instant)` from a single import.
// `temporal-polyfill` exports the Temporal-aware `Intl` VALUE at
// runtime, but `temporal-spec` only declares the namespace's types —
// merge the missing constructor declaration so the value import
// type-checks. Drop this augmentation once upstream types the export.
declare module 'temporal-spec' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- namespace merging is the only way to add the missing value declaration to temporal-spec's type-only `Intl` namespace
  namespace Intl {
    const DateTimeFormat: Pick<
      typeof globalThis.Intl.DateTimeFormat,
      'supportedLocalesOf'
    > &
      (new (
        locales?: string | string[],
        options?: globalThis.Intl.DateTimeFormatOptions,
      ) => DateTimeFormat)
  }
}

export { Intl, Temporal } from 'temporal-polyfill'
