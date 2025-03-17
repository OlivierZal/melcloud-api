import js from '@eslint/js'
import markdown from '@eslint/markdown'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import importX from 'eslint-plugin-import-x'
import { configs as packageJsonConfigs } from 'eslint-plugin-package-json'
import perfectionist from 'eslint-plugin-perfectionist'
import yml from 'eslint-plugin-yml'
import { defineConfig } from 'eslint/config'
import { configs as tsConfigs } from 'typescript-eslint'

import { classGroups } from './eslint-utils/class-groups.js'

const arrayLikeSortOptions = {
  groups: ['literal', 'spread'],
  newlinesBetween: 'never',
}

const classSortOptions = {
  ...classGroups,
  newlinesBetween: 'ignore',
}

const decoratorSortOptions = {
  customGroups: {
    'fetch-decorator': '^fetchDevices$',
    'sync-decorator': '^syncDevices$',
    'update-decorator': '^updateDevice(s)?$',
  },
  groups: ['sync-decorator', 'update-decorator', 'unknown', 'fetch-decorator'],
}

const enumSortOptions = {
  groups: ['unknown'],
  newlinesBetween: 'never',
}

const exportGroupKind = {
  groupKind: 'values-first',
}

const importSortOptions = {
  groups: [
    'side-effect',
    'side-effect-style',
    'builtin',
    'external',
    'internal',
    'parent',
    'sibling',
    'index',
    'object',
    'style',
    'unknown',
    'builtin-type',
    'external-type',
    'internal-type',
    'parent-type',
    'sibling-type',
    'index-type',
    'type',
  ],
  newlinesBetween: 'always',
}

const mapSortOptions = {
  groups: ['unknown'],
  newlinesBetween: 'never',
}

const moduleSortOptions = {
  groups: [
    'declare-enum',
    'declare-interface',
    'declare-type',
    'declare-class',
    'declare-function',
    'enum',
    'interface',
    'type',
    'class',
    'function',
    'export-enum',
    'export-interface',
    'export-type',
    'export-class',
    'export-function',
    'export-default-interface',
    'export-default-class',
    'export-default-function',
  ],
  newlinesBetween: 'ignore',
}

const namedSortOptions = {
  ...exportGroupKind,
  ignoreAlias: true,
}

const objectSortOptions = {
  groups: ['property', 'method'],
  newlinesBetween: 'never',
}

const typeGroups = {
  groups: [
    'import',
    'keyword',
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
  newlinesBetween: 'never',
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
  newlinesBetween: 'never',
}

const config = defineConfig([
  {
    ignores: ['dist/'],
  },
  {
    extends: [
      js.configs.all,
      tsConfigs.all,
      tsConfigs.strictTypeChecked,
      importX.flatConfigs.errors,
      importX.flatConfigs.typescript,
      prettier,
    ],
    files: ['**/*.{ts,js}'],
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
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
      '@stylistic/line-comment-position': 'error',
      '@stylistic/lines-around-comment': 'error',
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/multiline-comment-style': 'error',
      '@stylistic/quotes': [
        'error',
        'single',
        {
          allowTemplateLiterals: false,
          avoidEscape: true,
          ignoreStringLiterals: false,
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
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          filter: {
            match: true,
            regex: '^(Ata|Atw|Erv)$',
          },
          format: null,
          selector: 'enumMember',
        },
        {
          format: ['snake_case'],
          selector: 'enumMember',
        },
        {
          format: ['camelCase', 'PascalCase', 'snake_case'],
          selector: ['objectLiteralProperty', 'typeProperty'],
        },
        {
          format: ['camelCase', 'PascalCase'],
          selector: 'import',
        },
        {
          format: ['PascalCase'],
          prefix: ['can', 'did', 'has', 'is', 'should', 'will'],
          selector: 'variable',
          types: ['boolean'],
        },
        {
          format: ['UPPER_CASE'],
          modifiers: ['const', 'global'],
          selector: 'variable',
          types: ['boolean', 'number', 'string'],
        },
        {
          format: ['PascalCase'],
          selector: 'typeLike',
        },
        {
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          selector: 'default',
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
          ignoreEnums: true,
        },
      ],
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          checkTypePredicates: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_context$',
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
      '@typescript-eslint/typedef': 'off',
      camelcase: 'off',
      curly: 'error',
      'import-x/first': 'error',
      'import-x/max-dependencies': [
        'error',
        {
          ignoreTypeImports: true,
        },
      ],
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
      'import-x/no-unassigned-import': [
        'error',
        {
          allow: ['source-map-support/register.js'],
        },
      ],
      'import-x/no-unused-modules': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-webpack-loader-syntax': 'error',
      'import-x/unambiguous': 'error',
      'max-lines': 'off',
      'no-bitwise': 'off',
      'no-else-return': [
        'error',
        {
          allowElseIf: false,
        },
      ],
      'no-empty': [
        'error',
        {
          allowEmptyCatch: true,
        },
      ],
      'no-ternary': 'off',
      'no-undefined': 'off',
      'one-var': ['error', 'never'],
      'perfectionist/sort-array-includes': ['error', arrayLikeSortOptions],
      'perfectionist/sort-classes': ['error', classSortOptions],
      'perfectionist/sort-decorators': ['error', decoratorSortOptions],
      'perfectionist/sort-enums': ['error', enumSortOptions],
      'perfectionist/sort-exports': ['error', exportGroupKind],
      'perfectionist/sort-heritage-clauses': 'error',
      'perfectionist/sort-imports': ['error', importSortOptions],
      'perfectionist/sort-interfaces': ['error', typeLikeSortOptions],
      'perfectionist/sort-intersection-types': ['error', typeGroups],
      'perfectionist/sort-maps': ['error', mapSortOptions],
      'perfectionist/sort-modules': ['error', moduleSortOptions],
      'perfectionist/sort-named-exports': ['error', namedSortOptions],
      'perfectionist/sort-named-imports': ['error', namedSortOptions],
      'perfectionist/sort-object-types': ['error', typeLikeSortOptions],
      'perfectionist/sort-objects': ['error', objectSortOptions],
      'perfectionist/sort-sets': ['error', arrayLikeSortOptions],
      'perfectionist/sort-switch-case': 'error',
      'perfectionist/sort-union-types': ['error', typeGroups],
      'sort-imports': 'off',
      'sort-keys': 'off',
    },
    settings: {
      perfectionist: {
        ignoreCase: false,
        locales: 'en_US',
        order: 'asc',
        partitionByComment: true,
        partitionByNewLine: false,
        type: 'natural',
      },
    },
  },
  {
    extends: [tsConfigs.disableTypeChecked],
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'import-x/named': 'off',
    },
  },
  {
    files: ['**/*.config.{ts,js}'],
    rules: {
      'import-x/max-dependencies': 'off',
      'import-x/no-default-export': 'off',
      'import-x/prefer-default-export': [
        'error',
        {
          target: 'any',
        },
      ],
    },
  },
  ...markdown.configs.recommended,
  {
    extends: [yml.configs['flat/standard'], yml.configs['flat/prettier']],
    rules: {
      'yml/block-mapping-colon-indicator-newline': 'error',
      'yml/file-extension': [
        'error',
        {
          extension: 'yml',
        },
      ],
      'yml/no-multiple-empty-lines': 'error',
      'yml/no-trailing-zeros': 'error',
      'yml/require-string-key': 'error',
    },
  },
  {
    ...packageJsonConfigs.recommended,
    rules: {
      ...packageJsonConfigs.recommended.rules,
      'package-json/no-redundant-files': 'error',
      'package-json/require-author': 'error',
      'package-json/require-files': 'error',
      'package-json/require-keywords': 'error',
    },
  },
])

export default config
