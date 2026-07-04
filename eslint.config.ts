import { defineConfig } from 'eslint/config'
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x'
import { jsdoc } from 'eslint-plugin-jsdoc'
import { configs as packageJsonConfigs } from 'eslint-plugin-package-json'
import { Alphabet } from 'eslint-plugin-perfectionist/alphabet'
import { configs as ymlConfigs } from 'eslint-plugin-yml'
import { configs as tsConfigs } from 'typescript-eslint'
import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import stylistic from '@stylistic/eslint-plugin'
import vitest from '@vitest/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import perfectionist from 'eslint-plugin-perfectionist'
import unicorn from 'eslint-plugin-unicorn'

const buildImportGroup = (selector: string): string[] =>
  ['type', 'named', 'default', 'wildcard', 'require', 'ts-equals'].map(
    (modifier) => `${modifier}-${selector}`,
  )

const arrayLikeSortOptions = {
  groups: ['literal'],
}

const typeSortOptions = {
  groups: [
    'keyword',
    'import',
    'literal',
    'named',
    'function',
    'object',
    'tuple',
    'union',
    'intersection',
    'conditional',
    'operator',
    'unknown',
    'nullish',
  ],
}

const typeLikeSortOptions = {
  groups: [
    'required-index-signature',
    'optional-index-signature',
    'required-property',
    'optional-property',
    'required-method',
    'optional-method',
  ],
}

const config = defineConfig([
  {
    ignores: ['coverage/', 'dist/', 'docs/', 'scripts/'],
  },
  {
    ...jsdoc({ config: 'flat/recommended-tsdoc-error' }),
    files: ['src/**/*.ts'],
  },
  {
    extends: [
      js.configs.all,
      unicorn.configs.all,
      tsConfigs.all,
      tsConfigs.strictTypeChecked,
      importXConfigs.errors,
      importXConfigs.typescript,
      prettier,
    ],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.ts'],
        },
        warnOnUnsupportedTypeScriptVersion: false,
      },
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      '@stylistic': stylistic,
      perfectionist,
    },
    rules: {
      '@stylistic/multiline-comment-style': ['error', 'separate-lines'],
      '@stylistic/quotes': [
        'error',
        'single',
        {
          allowTemplateLiterals: 'never',
          avoidEscape: true,
        },
      ],
      '@stylistic/spaced-comment': [
        'error',
        'always',
        {
          block: {
            balanced: true,
          },
        },
      ],
      '@typescript-eslint/consistent-return': 'off',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          arrayLiteralTypeAssertions: 'never',
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        // ── Catch-all ────────────────────────────────────────
        {
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          selector: 'default',
          trailingUnderscore: 'forbid',
        },
        // ── Variables ────────────────────────────────────────
        // PascalCase: `as const` enum-like objects.
        // UPPER_CASE: scalar constants.
        {
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          selector: 'variable',
        },
        // Destructured — we don't control external shapes (API responses, libs).
        {
          format: null,
          modifiers: ['destructured'],
          selector: 'variable',
        },
        // ── Booleans (variables, parameters, class properties) ──
        // Semantic prefixes make intent obvious at the call site.
        // `device` is excluded: its type includes `false` as a sentinel but it is not a boolean flag.
        {
          filter: { match: false, regex: '^device$' },
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should'],
          selector: ['variable', 'parameter', 'classProperty'],
          types: ['boolean'],
        },
        // ── Parameters ───────────────────────────────────────
        // Leading underscore for intentionally unused params.
        {
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          selector: 'parameter',
        },
        // ── Functions & methods ──────────────────────────────
        {
          format: ['camelCase'],
          selector: [
            'function',
            'classMethod',
            'objectLiteralMethod',
            'typeMethod',
          ],
        },
        // ── Properties ───────────────────────────────────────
        // Permissive: DTOs, API contracts, and serialization use mixed conventions.
        {
          format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
          selector: ['objectLiteralProperty', 'typeProperty'],
        },
        // Branded types use __brand as a phantom sentinel — universal TS convention.
        {
          filter: { match: true, regex: '^__brand$' },
          format: null,
          selector: 'typeProperty',
        },
        // Quoted keys ('Content-Type', 'x-api-key', '@scope/pkg') — skip entirely.
        {
          format: null,
          modifiers: ['requiresQuotes'],
          selector: ['objectLiteralProperty', 'typeProperty'],
        },
        {
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          selector: 'classProperty',
        },
        // ── Imports ──────────────────────────────────────────
        {
          format: ['camelCase', 'PascalCase'],
          selector: 'import',
        },
        // ── Types, interfaces, classes, enums ────────────────
        {
          format: ['PascalCase'],
          selector: 'typeLike',
        },
        // ── Type parameters (generics) ───────────────────────
        // T-prefix: T, TKey, TValue, TResult — universal TS convention.
        {
          format: ['PascalCase'],
          prefix: ['T'],
          selector: 'typeParameter',
        },
      ],
      '@typescript-eslint/no-dupe-class-members': 'off',
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          ignoreRestArgs: true,
        },
      ],
      '@typescript-eslint/no-invalid-this': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, 2],
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          checkTypePredicates: true,
        },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': [
        'error',
        {
          checkLiteralConstAssertions: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          enableAutofixRemoval: {
            imports: true,
          },
        },
      ],
      '@typescript-eslint/prefer-destructuring': [
        'error',
        {
          array: true,
          object: true,
        },
        {
          enforceForDeclarationWithTypeAnnotation: true,
          enforceForRenamedProperties: true,
        },
      ],
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: true,
        },
      ],
      '@typescript-eslint/typedef': 'off',
      camelcase: 'off',
      'capitalized-comments': 'off',
      curly: 'error',
      'default-case': 'off',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-absolute-path': 'error',
      'import-x/no-anonymous-default-export': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-deprecated': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-dynamic-require': 'error',
      'import-x/no-empty-named-blocks': 'error',
      'import-x/no-extraneous-dependencies': 'error',
      'import-x/no-import-module-exports': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/no-named-as-default': 'error',
      'import-x/no-named-as-default-member': 'error',
      'import-x/no-named-default': 'error',
      'import-x/no-relative-packages': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-unassigned-import': 'error',
      'import-x/no-unused-modules': [
        'error',
        {
          missingExports: true,
          suppressMissingFileEnumeratorAPIWarning: true,
          unusedExports: true,
        },
      ],
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-webpack-loader-syntax': 'error',
      'import-x/unambiguous': 'error',
      'max-lines': 'off',
      'no-bitwise': 'off',
      'no-continue': 'off',
      'no-else-return': [
        'error',
        {
          allowElseIf: false,
        },
      ],
      'no-ternary': 'off',
      'no-undefined': 'off',
      'one-var': ['error', 'never'],
      'perfectionist/sort-array-includes': ['error', arrayLikeSortOptions],
      'perfectionist/sort-classes': [
        'error',
        {
          groups: [
            // ── Signatures ────────────────────────────────────────
            'index-signature',
            // ── Static fields ─────────────────────────────────────
            'static-decorated-property',
            'static-property',
            'static-accessor-property',
            ['static-get-method', 'static-set-method'],
            'protected-static-decorated-property',
            'protected-static-property',
            'protected-static-accessor-property',
            ['protected-static-get-method', 'protected-static-set-method'],
            'private-static-decorated-property',
            'private-static-property',
            'private-static-accessor-property',
            ['private-static-get-method', 'private-static-set-method'],
            'static-block',
            // ── Instance fields ───────────────────────────────────
            'declare-property',
            'abstract-property',
            'abstract-accessor-property',
            ['abstract-get-method', 'abstract-set-method'],
            'decorated-property',
            'property',
            'accessor-property',
            ['get-method', 'set-method'],
            'protected-decorated-property',
            'protected-property',
            'protected-accessor-property',
            ['protected-get-method', 'protected-set-method'],
            'private-decorated-property',
            'private-property',
            'private-accessor-property',
            ['private-get-method', 'private-set-method'],
            // ── Constructor ───────────────────────────────────────
            'constructor',
            // ── Static methods ────────────────────────────────────
            'static-decorated-method',
            'static-function-property',
            'static-method',
            'protected-static-decorated-method',
            'protected-static-function-property',
            'protected-static-method',
            'private-static-decorated-method',
            'private-static-function-property',
            'private-static-method',
            // ── Instance methods ──────────────────────────────────
            'abstract-method',
            'decorated-method',
            'function-property',
            'method',
            'protected-decorated-method',
            'protected-function-property',
            'protected-method',
            'private-decorated-method',
            'private-function-property',
            'private-method',
            // ── Unknown (catch-all) ───────────────────────────────
            'unknown',
          ],
          newlinesBetween: 1,
          newlinesInside: 1,
        },
      ],
      'perfectionist/sort-enums': [
        'error',
        {
          groups: ['unknown'],
        },
      ],
      'perfectionist/sort-export-attributes': 'error',
      'perfectionist/sort-exports': [
        'error',
        {
          groups: [
            'type-export',
            'named-export',
            'wildcard-export',
            'value-export',
          ],
          newlinesBetween: 1,
        },
      ],
      'perfectionist/sort-heritage-clauses': 'error',
      'perfectionist/sort-import-attributes': 'error',
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            ...buildImportGroup('side-effect'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('side-effect-style'),
            ...buildImportGroup('style'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('builtin'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('external'),
            ...buildImportGroup('tsconfig-path'),
            ...buildImportGroup('subpath'),
            ...buildImportGroup('internal'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('parent'),
            ...buildImportGroup('sibling'),
            ...buildImportGroup('index'),
          ],
        },
      ],
      'perfectionist/sort-interfaces': ['error', typeLikeSortOptions],
      'perfectionist/sort-intersection-types': ['error', typeSortOptions],
      'perfectionist/sort-maps': [
        'error',
        {
          groups: ['unknown'],
        },
      ],
      'perfectionist/sort-modules': [
        'error',
        {
          groups: [
            'declare-enum',
            ['declare-interface', 'declare-type'],
            'declare-function',
            'declare-class',
            'enum',
            ['interface', 'type'],
            'function',
            'class',
            'export-enum',
            ['export-interface', 'export-type'],
            'export-function',
            'export-class',
            'export-default-enum',
            ['export-default-interface', 'export-default-type'],
            'export-default-function',
            'export-default-class',
          ],
          newlinesBetween: 1,
          newlinesInside: 1,
        },
      ],
      'perfectionist/sort-named-exports': [
        'error',
        {
          groups: ['type-export', 'value-export'],
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          groups: ['type-import', 'value-import'],
        },
      ],
      'perfectionist/sort-object-types': ['error', typeLikeSortOptions],
      'perfectionist/sort-objects': [
        'error',
        {
          groups: ['property', 'method'],
        },
      ],
      'perfectionist/sort-sets': ['error', arrayLikeSortOptions],
      'perfectionist/sort-switch-case': 'error',
      'perfectionist/sort-union-types': ['error', typeSortOptions],
      'sort-imports': 'off',
      'sort-keys': 'off',
      // Autofix rewrites `@param url` into `@param URL`, breaking the
      // JSDoc/TSDoc param-name matching.
      'unicorn/comment-content': 'off',
      // Boolean naming is already governed by
      // `@typescript-eslint/naming-convention` (tuned prefixes, documented
      // `device` exception); also flags UPPER_CASE boolean constants.
      'unicorn/consistent-boolean-name': 'off',
      // Class member order is owned by `perfectionist/sort-classes`.
      'unicorn/consistent-class-member-order': 'off',
      // Zod schemas and test fixtures nest calls by design.
      'unicorn/max-nested-calls': 'off',
      // Renamed successor of `prevent-abbreviations`; its suggestions
      // (`error_`) also conflict with `naming-convention`'s
      // `trailingUnderscore: 'forbid'`.
      'unicorn/name-replacements': 'off',
      // The project keeps standard JSDoc/TSDoc formatting (per-line `*`
      // prefixes) consumed by eslint-plugin-jsdoc and typedoc.
      'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
      // `key in obj` filters on zod-parsed plain objects are type-safe;
      // switching to Map/Set is not warranted here.
      'unicorn/no-computed-property-existence-check': 'off',
      'unicorn/no-keyword-prefix': 'off',
      // Prose comments are hand-wrapped deliberately.
      'unicorn/no-manually-wrapped-comments': 'off',
      // False-positives on `setCookie`, the value of the HTTP `Set-Cookie`
      // header.
      'unicorn/no-non-function-verb-prefix': 'off',
      // `Symbol.dispose` is standard (ES2026, available in Node 22) but
      // unknown to this rule.
      'unicorn/no-nonstandard-builtin-properties': 'off',
      'unicorn/no-null': 'off',
      // Decorators use explicitly typed `this`, checked by TypeScript —
      // same rationale as `@typescript-eslint/no-invalid-this: off`.
      'unicorn/no-this-outside-of-class': 'off',
      // `new URL(x, base).href` is idiomatic.
      'unicorn/no-unreadable-new-expression': 'off',
      // Destructuring into `this.*` is required by
      // `@typescript-eslint/prefer-destructuring`
      // (`enforceForRenamedProperties`).
      'unicorn/no-unreadable-object-destructuring': 'off',
      'unicorn/no-useless-switch-case': 'off',
      // Fire-and-forget `.catch()` in timer callbacks is the observability
      // pattern; `await` is not available in those synchronous callbacks.
      'unicorn/prefer-await': 'off',
      // `Error.isError()` requires Node 24+; re-enable when `engines.node`
      // ≥ 24.
      'unicorn/prefer-error-is-error': 'off',
      // `Uint8Array#toBase64()` requires Node 24+; re-enable when
      // `engines.node` ≥ 24.
      'unicorn/prefer-uint8array-base64': 'off',
      // The default `max: 1` is stricter than the project's deliberate
      // try blocks of complexity 2.
      'unicorn/try-complexity': 'off',
    },
    settings: {
      perfectionist: {
        alphabet: Alphabet.generateRecommendedAlphabet()
          .sortByNaturalSort()
          .placeCharacterBefore({ characterAfter: '-', characterBefore: '/' })
          .getCharacters(),
        ignoreCase: false,
        locales: 'en_US',
        newlinesBetween: 0,
        newlinesInside: 0,
        order: 'asc',
        partitionByComment: false,
        partitionByNewLine: false,
        type: 'custom',
      },
    },
  },
  {
    files: ['**/decorators/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_context$',
          enableAutofixRemoval: {
            imports: true,
          },
        },
      ],
    },
  },
  {
    files: ['**/*.config.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      'import-x/no-default-export': 'off',
      'import-x/prefer-default-export': [
        'error',
        {
          target: 'any',
        },
      ],
    },
  },
  {
    extends: [json.configs.recommended],
    files: ['**/*.json'],
    ignores: [
      '**/package-lock.json',
      '**/package.json',
      'app.json',
      'locales/*.json',
    ],
    language: 'json/json',
    rules: {
      'json/sort-keys': [
        'error',
        'asc',
        {
          caseSensitive: true,
          natural: true,
        },
      ],
    },
  },
  {
    extends: [markdown.configs.recommended],
    files: ['**/*.md'],
    language: 'markdown/gfm',
    rules: {
      'markdown/fenced-code-meta': 'error',
      'markdown/no-bare-urls': 'error',
      'markdown/no-duplicate-headings': 'error',
      'markdown/no-html': 'error',
      // Allow GitHub alert syntax (`> [!IMPORTANT]`, `> [!CAUTION]`, …).
      // It's a GitHub UI extension to GFM, not part of the GFM spec, so
      // the rule's parser sees the bracketed marker as a missing
      // reference label. The plugin exposes `allowLabels` for exactly
      // this case (see eslint/markdown PR #256).
      'markdown/no-missing-label-refs': [
        'error',
        {
          allowLabels: ['!CAUTION', '!IMPORTANT', '!NOTE', '!TIP', '!WARNING'],
        },
      ],
    },
  },
  {
    files: ['CHANGELOG.md'],
    rules: {
      'markdown/no-duplicate-headings': [
        'error',
        {
          checkSiblingsOnly: true,
        },
      ],
    },
  },
  {
    // Bitfield enumeration: `EffectiveFlags` hex values are the file's
    // entire purpose. `no-magic-numbers` would flag every entry, and
    // `ignoreNumericLiteralTypes` does not cover literal types nested
    // inside object type annotations (typescript-eslint rule limitation).
    files: ['src/facades/classic-flags.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
  {
    extends: [vitest.configs.all, vitest.configs.recommended],
    files: ['tests/**/*.test.ts', 'tests/*fixtures.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'vitest/max-expects': 'off',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-hooks': 'off',
      'vitest/prefer-expect-assertions': 'off',
      'vitest/prefer-hooks-in-order': 'error',
      'vitest/require-hook': 'off',
      'vitest/require-mock-type-parameters': 'error',
    },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
  },
  {
    extends: [ymlConfigs.standard, ymlConfigs.prettier],
    rules: {
      'yml/file-extension': [
        'error',
        {
          extension: 'yml',
        },
      ],
      'yml/require-string-key': 'error',
      'yml/sort-keys': [
        'error',
        {
          order: {
            caseSensitive: true,
            natural: true,
            type: 'asc',
          },
          pathPattern: String.raw`^(?!jobs\.\w+\.steps\[\d+\]).*$`,
        },
        {
          order: ['id', 'name', 'if', 'uses', 'with', 'env', 'run'],
          pathPattern: String.raw`^jobs\.\w+\.steps\[\d+\]$`,
        },
      ],
      'yml/sort-sequence-values': [
        'error',
        {
          order: {
            caseSensitive: true,
            natural: true,
            type: 'asc',
          },
          pathPattern: '^.*$',
        },
      ],
    },
  },
  packageJsonConfigs.recommended,
  packageJsonConfigs.stylistic,
])

export default config
