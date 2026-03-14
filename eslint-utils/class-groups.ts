import { buildGroups } from './build-groups.ts'

const modifiers: string[][] = [
  ['declare', 'override', ''],
  ['static', '', 'abstract'],
  ['decorated', ''],
  ['', 'protected', 'private'],
  ['', 'optional'],
  ['readonly', ''],
]

const modifierIncompatibilities: Record<string, string[]> = {
  abstract: ['decorated', 'private', 'static'],
  declare: ['decorated', 'override'],
}

const selectors: (string | string[])[] = [
  'index-signature',
  'property',
  'function-property',
  'static-block',
  'constructor',
  'accessor-property',
  ['get-method', 'set-method'],
  'event-handler',
  'method',
]

const allModifiers = modifiers.flat().filter(Boolean)
const baseMethodIncompatibilities = ['declare', 'readonly']
const accessorIncompatibilities = [...baseMethodIncompatibilities, 'optional']
const selectorIncompatibilities: Record<string, string[]> = {
  'accessor-property': accessorIncompatibilities,
  constructor: [
    ...baseMethodIncompatibilities,
    'abstract',
    'decorated',
    'optional',
    'override',
    'static',
  ],
  'event-handler': allModifiers,
  'function-property': ['abstract', 'declare'],
  'get-method': accessorIncompatibilities,
  'index-signature': [
    'abstract',
    'declare',
    'decorated',
    'optional',
    'override',
    'private',
    'protected',
  ],
  method: baseMethodIncompatibilities,
  property: [],
  'set-method': accessorIncompatibilities,
  'static-block': allModifiers,
}

export const classGroups = {
  customGroups: [
    {
      elementNamePattern: '^on.+',
      groupName: 'event-handler',
      selector: 'method',
    },
  ],
  groups: buildGroups({
    modifierIncompatibilities,
    modifiers,
    selectorIncompatibilities,
    selectors,
  }),
}
