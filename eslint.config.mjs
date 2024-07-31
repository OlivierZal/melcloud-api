import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import perfectionist from 'eslint-plugin-perfectionist'
import tsEslint from 'typescript-eslint'

const naturalSortOptions = {
  ignoreCase: false,
  order: 'asc',
  type: 'natural',
}

const naturalSortTypeOptions = {
  ...naturalSortOptions,
  groups: [
    'conditional',
    'function',
    'import',
    'intersection',
    'keyword',
    'literal',
    'named',
    'object',
    'operator',
    'tuple',
    'union',
    'nullish',
    'unknown',
  ],
}

const naturalSortNamedExportImportOptions = {
  ...naturalSortOptions,
  groupKind: 'types-first',
}

export default tsEslint.config(
  {
    ignores: ['dist/'],
  },
  {
    extends: [
      eslint.configs.all,
      ...tsEslint.configs.all,
      ...tsEslint.configs.strictTypeChecked,
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      // @ts-expect-error: incorrect type
      '@stylistic': stylistic,
      // @ts-expect-error: incorrect type
      perfectionist,
    },
    rules: {
      '@stylistic/line-comment-position': 'error',
      '@stylistic/lines-around-comment': 'error',
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/padding-line-between-statements': 'error',
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
            exceptions: ['*'],
            markers: ['!'],
          },
          line: {
            exceptions: ['/', '#'],
            markers: ['/'],
          },
        },
      ],
      '@typescript-eslint/consistent-return': 'off',
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: {
            memberTypes: [
              // Index signature
              'signature',
              'readonly-signature',
              'call-signature',

              // Fields
              'public-static-field',
              'public-static-readonly-field',
              'protected-static-field',
              'protected-static-readonly-field',
              'private-static-field',
              'private-static-readonly-field',
              '#private-static-field',
              '#private-static-readonly-field',

              'public-decorated-field',
              'public-decorated-readonly-field',
              'protected-decorated-field',
              'protected-decorated-readonly-field',
              'private-decorated-field',
              'private-decorated-readonly-field',

              'public-instance-field',
              'public-instance-readonly-field',
              'protected-instance-field',
              'protected-instance-readonly-field',
              'private-instance-field',
              'private-instance-readonly-field',
              '#private-instance-field',
              '#private-instance-readonly-field',

              'public-abstract-field',
              'public-abstract-readonly-field',
              'protected-abstract-field',
              'protected-abstract-readonly-field',

              'public-field',
              'public-readonly-field',
              'protected-field',
              'protected-readonly-field',
              'private-field',
              'private-readonly-field',
              '#private-field',
              '#private-readonly-field',

              'static-field',
              'static-readonly-field',
              'instance-field',
              'instance-readonly-field',
              'abstract-field',
              'abstract-readonly-field',

              'decorated-field',
              'decorated-readonly-field',

              'field',
              'readonly-field',

              // Static initialization
              'static-initialization',

              // Constructors
              'public-constructor',
              'protected-constructor',
              'private-constructor',

              'constructor',

              // Accessors
              'public-static-accessor',
              'protected-static-accessor',
              'private-static-accessor',
              '#private-static-accessor',

              'public-decorated-accessor',
              'protected-decorated-accessor',
              'private-decorated-accessor',

              'public-instance-accessor',
              'protected-instance-accessor',
              'private-instance-accessor',
              '#private-instance-accessor',

              'public-abstract-accessor',
              'protected-abstract-accessor',

              'public-accessor',
              'protected-accessor',
              'private-accessor',
              '#private-accessor',

              'static-accessor',
              'instance-accessor',
              'abstract-accessor',

              'decorated-accessor',

              'accessor',

              // Getters and setters
              ['public-static-get', 'public-static-set'],
              ['protected-static-get', 'protected-static-set'],
              ['private-static-get', 'private-static-set'],
              ['#private-static-get', '#private-static-set'],

              ['public-decorated-get', 'public-decorated-set'],
              ['protected-decorated-get', 'protected-decorated-set'],
              ['private-decorated-get', 'private-decorated-set'],

              ['public-instance-get', 'public-instance-set'],
              ['protected-instance-get', 'protected-instance-set'],
              ['private-instance-get', 'private-instance-set'],
              ['#private-instance-get', '#private-instance-set'],

              ['public-abstract-get', 'public-abstract-set'],
              ['protected-abstract-get', 'protected-abstract-set'],

              ['public-get', 'public-set'],
              ['protected-get', 'protected-set'],
              ['private-get', 'private-set'],
              ['#private-get', '#private-set'],

              ['static-get', 'static-set'],
              ['instance-get', 'instance-set'],
              ['abstract-get', 'abstract-set'],

              ['decorated-get', 'decorated-set'],

              ['get', 'set'],

              // Methods
              'public-static-method',
              'protected-static-method',
              'private-static-method',
              '#private-static-method',

              'public-decorated-method',
              'protected-decorated-method',
              'private-decorated-method',

              'public-instance-method',
              'protected-instance-method',
              'private-instance-method',
              '#private-instance-method',

              'public-abstract-method',
              'protected-abstract-method',

              'public-method',
              'protected-method',
              'private-method',
              '#private-method',

              'static-method',
              'instance-method',
              'abstract-method',

              'decorated-method',

              'method',
            ],
            optionalityOrder: 'optional-first',
            order: 'natural',
          },
        },
      ],
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
          format: ['camelCase'],
          modifiers: ['global'],
          selector: 'variable',
          types: ['function'],
        },
        {
          format: ['camelCase', 'UPPER_CASE'],
          modifiers: ['global'],
          selector: 'variable',
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/typedef': 'off',
      camelcase: 'off',
      'max-lines': 'off',
      'no-bitwise': 'off',
      'no-empty': [
        'error',
        {
          allowEmptyCatch: true,
        },
      ],
      'no-ternary': 'off',
      'no-undefined': 'off',
      'one-var': ['error', 'never'],
      'perfectionist/sort-array-includes': ['error', naturalSortOptions],
      'perfectionist/sort-enums': ['error', naturalSortOptions],
      'perfectionist/sort-exports': ['error', naturalSortOptions],
      'perfectionist/sort-imports': ['error', naturalSortOptions],
      'perfectionist/sort-intersection-types': [
        'error',
        naturalSortTypeOptions,
      ],
      'perfectionist/sort-maps': ['error', naturalSortOptions],
      'perfectionist/sort-named-exports': [
        'error',
        naturalSortNamedExportImportOptions,
      ],
      'perfectionist/sort-named-imports': [
        'error',
        naturalSortNamedExportImportOptions,
      ],
      'perfectionist/sort-switch-case': ['error', naturalSortOptions],
      'perfectionist/sort-union-types': ['error', naturalSortTypeOptions],
      'perfectionist/sort-variable-declarations': ['error', naturalSortOptions],
      'sort-imports': 'off',
      'sort-keys': [
        'error',
        'asc',
        {
          natural: true,
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    ...tsEslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.checkjs.json',
      },
    },
  },
)
