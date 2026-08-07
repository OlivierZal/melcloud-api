import { namingConventionEntries } from '@olivierzal/configs/eslint'
import { library } from '@olivierzal/configs/eslint/library'
import { type Config, defineConfig } from 'eslint/config'

// The layers that speak to MELCloud: the wire types and their zod
// mirror, the HTTP clients, the facades that read and write those
// fields, and the maps that translate them. The rest of the library —
// entities, errors, observability, resilience, the time helpers — is
// ours alone and takes the strict core.
const wireSpeakingFiles = [
  'src/api/**/*.ts',
  'src/constants.ts',
  'src/decorators/**/*.ts',
  'src/enum-mappings.ts',
  'src/facades/**/*.ts',
  'src/http/**/*.ts',
  'src/types/**/*.ts',
  'src/utils.ts',
  'src/validation/**/*.ts',
]

const config: Config[] = defineConfig([
  {
    // `scripts/` holds gitignored one-shot wire probes, not shipped
    // code — outside the lint scope by decision, like the build outputs.
    ignores: ['coverage/', 'dist/', 'docs/', 'scripts/'],
  },
  ...library(),
  {
    // These vocabularies are what the protocols impose on the modules
    // that speak them, so they are granted there and nowhere else: a
    // name of our own invention outside this list meets the core and
    // is caught, instead of being waved through by a shape it merely
    // resembles.
    files: wireSpeakingFiles,
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...namingConventionEntries({
          // Mirrors the library preset's own filter: `device` types
          // include `false` as a sentinel without being a flag.
          booleanFilter: { match: false, regex: '^device$' },
          extraEntries: [
            // Branded types use __brand as a phantom sentinel —
            // universal TS convention.
            {
              filter: { match: true, regex: '^__brand$' },
              format: null,
              selector: 'typeProperty',
            },
            // MELCloud Classic names every field in PascalCase, and the
            // Home report keys its series in UPPER_SNAKE (`HOT_WATER`);
            // both are read and written verbatim. Header names carry
            // hyphens and stay with the quoted-key exemption instead.
            {
              filter: { match: true, regex: '^[A-Z][A-Za-z0-9_]*$' },
              format: ['PascalCase', 'UPPER_CASE'],
              selector: ['objectLiteralProperty', 'typeProperty'],
            },
            // Three snake_case vocabularies meet here, none of them
            // ours: the OAuth 2.0/PKCE parameters (`grant_type`,
            // `code_verifier`), the Home wire fields
            // (`outside_temperature`), and the Homey capability enum
            // values the app passes straight through (`very_fast`,
            // `flow_cool`).
            {
              filter: { match: true, regex: '^[a-z][a-z0-9]*(_[a-z0-9]+)+$' },
              format: null,
              selector: ['objectLiteralProperty', 'typeProperty'],
            },
          ],
        }),
      ],
    },
  },
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
