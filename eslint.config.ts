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
    'index-signature',
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
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  {
    ...jsdoc({
      config: 'flat/recommended-tsdoc-error',
      rules: {
        'jsdoc/check-template-names': 'error',
        'jsdoc/informative-docs': 'error',
        'jsdoc/no-bad-blocks': 'error',
        'jsdoc/no-blank-block-descriptions': 'error',
        'jsdoc/no-blank-blocks': 'error',
        'jsdoc/require-description': 'error',
        'jsdoc/require-hyphen-before-param-description': ['error', 'always'],
        'jsdoc/require-template': 'error',
        'jsdoc/require-throws': 'error',
        'jsdoc/sort-tags': 'error',
      },
    }),
    files: ['src/**/*.ts'],
  },
  {
    extends: [
      js.configs.recommended,
      unicorn.configs.recommended,
      tsConfigs.strictTypeChecked,
      tsConfigs.stylisticTypeChecked,
      importXConfigs.errors,
      importXConfigs.typescript,
      prettier,
    ],
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.ts'],
        },
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    plugins: {
      '@stylistic': stylistic,
      perfectionist,
    },
    rules: {
      '@stylistic/multiline-comment-style': [
        'error',
        'separate-lines',
        {
          checkExclamation: true,
        },
      ],
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
      '@typescript-eslint/class-methods-use-this': 'error',
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
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/max-params': 'error',
      '@typescript-eslint/method-signature-style': 'error',
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
          prefix: [
            'are',
            'can',
            'did',
            'has',
            'have',
            'is',
            'requires',
            'should',
            'was',
            'were',
            'will',
          ],
          selector: ['variable', 'parameter', 'classProperty'],
          types: ['boolean'],
        },
        // ── Parameters ───────────────────────────────────────
        // Unused parameters must wear the underscore (enforced
        // documentation); used parameters must not.
        {
          format: ['camelCase'],
          leadingUnderscore: 'require',
          modifiers: ['unused'],
          selector: 'parameter',
        },
        {
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
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
      '@typescript-eslint/no-base-to-string': [
        'error',
        {
          checkUnknown: true,
        },
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          checkThenables: true,
          // `no-void` bans the `void promise` escape; demand await/.catch.
          ignoreVoid: false,
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          enforceConst: true,
          ignore: [0, 1, 2],
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      '@typescript-eslint/no-shadow': [
        'error',
        {
          // `allow` covers the deliberate polyfill re-exports from
          // `src/temporal.ts`.
          allow: ['Intl', 'Temporal'],
          builtinGlobals: true,
          hoist: 'all',
        },
      ],
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
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/no-unused-private-class-members': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          enableAutofixRemoval: {
            imports: true,
          },
        },
      ],
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allowThrowingAny: false,
          allowThrowingUnknown: false,
        },
      ],
      // Assignment and renamed-property enforcement breeds unreadable
      // destructuring.
      '@typescript-eslint/prefer-destructuring': [
        'error',
        {
          AssignmentExpression: {
            array: false,
            object: false,
          },
          VariableDeclarator: {
            array: true,
            object: true,
          },
        },
        {
          enforceForDeclarationWithTypeAnnotation: true,
          enforceForRenamedProperties: false,
        },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allow: [],
          allowAny: false,
          allowArray: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: false,
          allowRegExp: false,
        },
      ],
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
      ],
      '@typescript-eslint/strict-void-return': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: true,
        },
      ],
      'accessor-pairs': 'error',
      'array-callback-return': [
        'error',
        {
          checkForEach: true,
        },
      ],
      'arrow-body-style': 'error',
      // Measured codebase ceiling.
      complexity: [
        'error',
        {
          max: 10,
        },
      ],
      curly: 'error',
      'default-case-last': 'error',
      eqeqeq: 'error',
      'func-style': 'error',
      'guard-for-in': 'error',
      'id-length': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-absolute-path': 'error',
      'import-x/no-anonymous-default-export': [
        'error',
        {
          allowCallExpression: false,
        },
      ],
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-duplicates': [
        'error',
        {
          'prefer-inline': true,
        },
      ],
      'import-x/no-dynamic-require': [
        'error',
        {
          esmodule: true,
        },
      ],
      'import-x/no-empty-named-blocks': 'error',
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          bundledDependencies: false,
          devDependencies: ['*.config.ts', 'tests/**'],
          includeTypes: true,
          optionalDependencies: false,
          peerDependencies: false,
        },
      ],
      'import-x/no-import-module-exports': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/no-named-as-default': 'error',
      'import-x/no-named-as-default-member': 'error',
      'import-x/no-named-default': 'error',
      'import-x/no-namespace': 'error',
      'import-x/no-relative-packages': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-unassigned-import': 'error',
      'import-x/no-unresolved': [
        'error',
        {
          caseSensitiveStrict: true,
        },
      ],
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
      'max-classes-per-file': 'error',
      // Measured codebase ceiling.
      'max-depth': [
        'error',
        {
          max: 3,
        },
      ],
      'max-lines-per-function': 'error',
      'max-statements': 'error',
      'no-await-in-loop': 'error',
      'no-bitwise': 'error',
      'no-cond-assign': ['error', 'always'],
      'no-console': 'error',
      'no-constructor-return': 'error',
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-extra-boolean-cast': [
        'error',
        {
          enforceForInnerExpressions: true,
        },
      ],
      'no-fallthrough': [
        'error',
        {
          reportUnusedFallthroughComment: true,
        },
      ],
      'no-implicit-coercion': 'error',
      'no-inline-comments': 'error',
      'no-irregular-whitespace': [
        'error',
        {
          skipStrings: false,
        },
      ],
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-lonely-if': 'error',
      'no-multi-assign': 'error',
      'no-multi-str': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-object-constructor': 'error',
      'no-param-reassign': 'error',
      'no-promise-executor-return': 'error',
      // `src/temporal.ts` is the single sanctioned polyfill entry point.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['temporal-polyfill', 'temporal-polyfill/*'],
              message: 'Import Temporal/Intl from src/temporal.ts instead.',
            },
          ],
        },
      ],
      'no-return-assign': ['error', 'always'],
      'no-self-compare': 'error',
      'no-sequences': [
        'error',
        {
          allowInParentheses: false,
        },
      ],
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': 'error',
      'no-unreachable-loop': 'error',
      // Owned by `@typescript-eslint/no-unused-private-class-members`.
      'no-unused-private-class-members': 'off',
      'no-useless-computed-key': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      'perfectionist/sort-array-includes': 'error',
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
      'perfectionist/sort-enums': 'error',
      'perfectionist/sort-export-attributes': 'error',
      'perfectionist/sort-exports': [
        'error',
        {
          groups: [
            'named-type-export',
            'wildcard-type-export',
            'named-value-export',
            'wildcard-value-export',
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
            // Side-effect imports carry no specifiers, so only the bare
            // selectors can match them.
            'side-effect',
            {
              newlinesBetween: 1,
            },
            'side-effect-style',
            ...buildImportGroup('style'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('builtin'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('external'),
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
      'perfectionist/sort-maps': 'error',
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
            'export-default-interface',
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
          partitionByComputedKey: true,
        },
      ],
      'perfectionist/sort-sets': 'error',
      'perfectionist/sort-switch-case': 'error',
      'perfectionist/sort-union-types': ['error', typeSortOptions],
      'prefer-arrow-callback': 'error',
      'prefer-exponentiation-operator': 'error',
      'prefer-named-capture-group': 'error',
      'prefer-numeric-literals': 'error',
      'prefer-object-has-own': 'error',
      'prefer-object-spread': 'error',
      'prefer-regex-literals': [
        'error',
        {
          disallowRedundantWrapping: true,
        },
      ],
      'prefer-template': 'error',
      'require-atomic-updates': 'error',
      'require-unicode-regexp': [
        'error',
        {
          requireFlag: 'v',
        },
      ],
      'symbol-description': 'error',
      'unicode-bom': 'error',
      // Owned by `@typescript-eslint/naming-convention` for variables,
      // parameters and class properties (identical prefix set).
      'unicorn/consistent-boolean-name': 'off',
      // Owned by `perfectionist/sort-classes`.
      'unicorn/consistent-class-member-order': 'off',
      'unicorn/custom-error-definition': 'error',
      // Vocabulary opt-out: the abbreviation renames it forces
      // (`args` -> `arguments_`, ...) fight the domain naming.
      'unicorn/name-replacements': 'off',
      // Owned by `import-x/no-anonymous-default-export`.
      'unicorn/no-anonymous-default-export': 'off',
      // Owned by `import-x/no-named-default` (imports; the export
      // form it also covers is unused here).
      'unicorn/no-named-default': 'off',
      'unicorn/no-non-function-verb-prefix': 'error',
      // Unaware of `Symbol.dispose`.
      'unicorn/no-nonstandard-builtin-properties': 'off',
      'unicorn/no-null': 'off',
      // Owned by `@typescript-eslint/no-unnecessary-boolean-literal-compare`.
      'unicorn/no-unnecessary-boolean-comparison': 'off',
      'unicorn/no-unused-properties': 'error',
      'unicorn/prefer-dispose': 'error',
      'unicorn/prefer-import-meta-properties': 'error',
      // Owned by `@typescript-eslint/prefer-string-starts-ends-with`.
      'unicorn/prefer-string-starts-ends-with': 'off',
      'unicorn/prefer-temporal': 'error',
      // Requires Node.js 24.
      'unicorn/prefer-uint8array-base64': 'off',
      'unicorn/try-complexity': 'error',
      'use-isnan': [
        'error',
        {
          enforceForIndexOf: true,
        },
      ],
      'valid-typeof': [
        'error',
        {
          requireStringLiterals: true,
        },
      ],
      yoda: 'error',
    },
    settings: {
      perfectionist: {
        alphabet: Alphabet.generateRecommendedAlphabet()
          .sortByNaturalSort('en-US')
          .placeCharacterBefore({ characterAfter: '-', characterBefore: '/' })
          .getCharacters(),
        ignoreCase: false,
        locales: 'en-US',
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
    files: ['*.config.ts'],
    rules: {
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
    ignores: ['**/package-lock.json', '**/package.json'],
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
      'json/top-level-interop': 'error',
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
      'markdown/no-missing-atx-heading-space': [
        'error',
        {
          checkClosedHeadings: true,
        },
      ],
      'markdown/no-missing-label-refs': [
        'error',
        {
          allowLabels: ['!CAUTION', '!IMPORTANT', '!NOTE', '!TIP', '!WARNING'],
        },
      ],
      'markdown/no-missing-link-fragments': [
        'error',
        {
          allowPattern: '',
          ignoreCase: false,
        },
      ],
      'markdown/no-space-in-emphasis': [
        'error',
        {
          checkStrikethrough: true,
        },
      ],
      'markdown/table-column-count': [
        'error',
        {
          checkMissingCells: true,
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
    // TC39 decorator protocol: the replacement method receives the
    // instance through `this` (no class body to put it in), and the
    // `context` parameter is what pins the decorator kind at type level
    // even when unused.
    files: ['src/decorators/**/*.ts'],
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
      'unicorn/no-this-outside-of-class': 'off',
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
    files: ['src/temporal.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    extends: [vitest.configs.recommended],
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      // Owned by `vitest/unbound-method`, the mock-aware port.
      '@typescript-eslint/unbound-method': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      // Mock builders nest factories.
      'unicorn/max-nested-calls': [
        'error',
        {
          max: 4,
        },
      ],
      // Without options the rule is a no-op; the suite uses `.each` exclusively.
      'vitest/consistent-each-for': [
        'error',
        {
          describe: 'each',
          it: 'each',
          suite: 'each',
          test: 'each',
        },
      ],
      'vitest/consistent-test-filename': 'error',
      'vitest/consistent-test-it': [
        'error',
        {
          fn: 'it',
        },
      ],
      'vitest/consistent-vitest-vi': 'error',
      'vitest/hoisted-apis-on-top': 'error',
      'vitest/max-nested-describe': [
        'error',
        {
          max: 3,
        },
      ],
      'vitest/no-alias-methods': 'error',
      'vitest/no-conditional-in-test': 'error',
      'vitest/no-conditional-tests': 'error',
      // The recommended preset ships this at 'warn' (zero-warning policy).
      'vitest/no-disabled-tests': 'error',
      'vitest/no-duplicate-hooks': 'error',
      'vitest/no-large-snapshots': 'error',
      'vitest/no-test-return-statement': 'error',
      // Union of the seven per-hook `padding-around-*` rules.
      'vitest/padding-around-all': 'error',
      'vitest/prefer-called-times': 'error',
      'vitest/prefer-called-with': 'error',
      'vitest/prefer-comparison-matcher': 'error',
      'vitest/prefer-describe-function-title': 'error',
      'vitest/prefer-each': 'error',
      'vitest/prefer-equality-matcher': 'error',
      'vitest/prefer-expect-assertions': [
        'error',
        {
          onlyFunctionsWithExpectInCallback: true,
          onlyFunctionsWithExpectInLoop: true,
        },
      ],
      'vitest/prefer-expect-resolves': 'error',
      'vitest/prefer-expect-type-of': 'error',
      'vitest/prefer-hooks-in-order': 'error',
      'vitest/prefer-hooks-on-top': 'error',
      'vitest/prefer-import-in-mock': 'error',
      'vitest/prefer-importing-vitest-globals': 'error',
      'vitest/prefer-lowercase-title': 'error',
      'vitest/prefer-mock-promise-shorthand': 'error',
      'vitest/prefer-snapshot-hint': 'error',
      'vitest/prefer-spy-on': 'error',
      'vitest/prefer-strict-boolean-matchers': 'error',
      'vitest/prefer-strict-equal': 'error',
      'vitest/prefer-to-be': 'error',
      'vitest/prefer-to-contain': 'error',
      'vitest/prefer-to-have-been-called-times': 'error',
      'vitest/prefer-to-have-length': 'error',
      'vitest/prefer-vi-mocked': 'error',
      'vitest/require-awaited-expect-poll': 'error',
      'vitest/require-mock-type-parameters': [
        'error',
        {
          checkImportFunctions: true,
        },
      ],
      'vitest/require-to-throw-message': 'error',
      'vitest/require-top-level-describe': 'error',
      'vitest/unbound-method': 'error',
      'vitest/warn-todo': 'error',
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
      'yml/key-name-casing': [
        'error',
        {
          camelCase: true,
          'kebab-case': true,
          SCREAMING_SNAKE_CASE: true,
          snake_case: true,
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
          order: [
            'id',
            'name',
            'if',
            'continue-on-error',
            'timeout-minutes',
            'uses',
            'with',
            'env',
            'shell',
            'working-directory',
            'run',
          ],
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
  {
    extends: [packageJsonConfigs.recommended, packageJsonConfigs.stylistic],
    files: ['**/package.json'],
    rules: {
      'package-json/require-author': 'error',
      'package-json/require-bugs': 'error',
      'package-json/require-engines': 'error',
      'package-json/require-homepage': 'error',
      'package-json/require-keywords': 'error',
      'package-json/require-types': 'error',
    },
  },
])

export default config
