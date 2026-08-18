import { webviewFloorBlock } from '@olivierzal/configs/eslint'
import { library } from '@olivierzal/configs/eslint/library'
import { type Config, defineConfig } from 'eslint/config'

// The browser-reachable closure: the flat subpath modules of the
// export map plus their value-import closure (`utils.ts`, reached via
// `enum-mappings.ts`). These are the modules the consuming apps bundle
// into phone webviews, so the full es2023 API floor applies — not just
// the `u`-flag step-down below. `tests/unit/webview-floor.test.ts`
// recomputes the closure and fails when this list drifts from it.
const WEBVIEW_FLOOR_FILES = [
  'src/constants.ts',
  'src/enum-mappings.ts',
  'src/error-log.ts',
  'src/holiday-mode.ts',
  'src/protection.ts',
  'src/temperature-range.ts',
  'src/temporal.ts',
  'src/utils.ts',
]

const config: Config[] = defineConfig([
  {
    // `scripts/` holds gitignored one-shot wire probes, not shipped
    // code — outside the lint scope by decision, like the build outputs.
    ignores: ['coverage/', 'dist/', 'docs/', 'scripts/'],
  },
  ...library({
    wireNamingEntries: [
      // Branded types use __brand as a phantom sentinel — universal TS
      // convention.
      {
        filter: { match: true, regex: '^__brand$' },
        format: null,
        selector: 'typeProperty',
      },
      // MELCloud Classic names every field in PascalCase, and the Home
      // report keys its series in UPPER_SNAKE (`HOT_WATER`); both are
      // read and written verbatim. Header names carry hyphens and stay
      // with the quoted-key exemption instead.
      {
        filter: { match: true, regex: '^[A-Z][A-Za-z0-9_]*$' },
        format: ['PascalCase', 'UPPER_CASE'],
        selector: ['objectLiteralProperty', 'typeProperty'],
      },
      // Three snake_case vocabularies meet here, none of them ours:
      // the OAuth 2.0/PKCE parameters (`grant_type`, `code_verifier`),
      // the Home wire fields (`outside_temperature`), and the Homey
      // capability enum values the app passes straight through
      // (`very_fast`, `flow_cool`).
      {
        filter: { match: true, regex: '^[a-z][a-z0-9]*(_[a-z0-9]+)+$' },
        format: null,
        selector: ['objectLiteralProperty', 'typeProperty'],
      },
    ],
    // The layers that speak to MELCloud: the wire types and their zod
    // mirror, the HTTP clients, the facades that read and write those
    // fields, and the maps that translate them. The rest of the
    // library — entities, errors, observability, resilience, the time
    // helpers — is ours alone and takes the strict core, so a name of
    // our own invention there is caught instead of being waved through
    // by a shape it merely resembles.
    wireNamingFiles: [
      'src/api/**/*.ts',
      'src/constants.ts',
      'src/decorators/**/*.ts',
      'src/enum-mappings.ts',
      'src/facades/**/*.ts',
      'src/http/**/*.ts',
      'src/temperature-range.ts',
      'src/types/**/*.ts',
      'src/utils.ts',
      'src/validation/**/*.ts',
    ],
  }),
  {
    // Bitfield enumeration: `EffectiveFlags` hex values are the file's
    // entire purpose. `no-magic-numbers` would flag every entry, and
    // `ignoreNumericLiteralTypes` does not cover literal types nested
    // inside object type annotations (typescript-eslint rule limitation).
    files: ['src/facades/classic-flags.ts'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
  webviewFloorBlock(WEBVIEW_FLOOR_FILES),
  {
    // Shipped regexes stay on the `u` flag: the consuming apps bundle
    // this package INTO their phone webviews — `/constants` is imported
    // for values, and esbuild inlines them (`coolingMin:16` is in the
    // shipped widget bundle) — and the worst engine the Homey app
    // admits, iOS 16.4's WebKit (App Store minimum, 2026-08-11),
    // predates the `v` flag: an escapee ships as `new RegExp` under
    // the apps' esbuild target and throws at runtime. Scoping to the
    // reachable subset is unmaintainable, so all of `src` holds the
    // floor until the App Store minimum reaches 17.4.
    files: ['src/**/*.ts'],
    rules: { 'require-unicode-regexp': ['error', { requireFlag: 'u' }] },
  },
])

export default config
