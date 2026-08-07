import { library } from '@olivierzal/configs/eslint/library'
import { type Config, defineConfig } from 'eslint/config'

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
      // Three snake_case vocabularies meet here, none of them ours: the
      // OAuth 2.0/PKCE parameters (`grant_type`, `code_verifier`), the
      // Home wire fields (`outside_temperature`), and the Homey
      // capability enum values the app passes straight through
      // (`very_fast`, `flow_cool`).
      {
        filter: { match: true, regex: '^[a-z][a-z0-9]*(_[a-z0-9]+)+$' },
        format: null,
        selector: ['objectLiteralProperty', 'typeProperty'],
      },
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
])

export default config
