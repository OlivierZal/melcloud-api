import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// The root barrel imports the HTTP stack, so it cannot be bundled for a
// browser: a webview that needs a VALUE has to reach its module directly.
// Every flat module the barrel re-exports is therefore published under its
// own subpath — not to widen the API, which already exposes those symbols,
// but to keep an already-public surface reachable where the barrel cannot
// load. Omitting one costs a release plus an adoption round at every
// consumer, which is what the missing `./protection` cost.
//
// Directory barrels are exempt by verdict, not by oversight: they are
// grouped surfaces rather than leaves, and none has been needed from a
// browser. DIRECTORY_REEXPORTS pins the known set so a new one forces that
// decision instead of inheriting the exemption in silence.

const DIRECTORY_REEXPORT = /from '\.\/(?<directory>[a-z\-]+)\/index\.ts'/gv

const FLAT_REEXPORT = /from '\.\/(?<module>[a-z\-]+)\.ts'/gv

// Answers a tooling contract rather than the barrel: consumers and linters
// read the manifest, and Node hides it once an `exports` map exists.
const MANIFEST_SUBPATH = './package.json'

const DIRECTORY_REEXPORTS = [
  'api',
  'decorators',
  'entities',
  'errors',
  'facades',
  'http',
  'types',
]

const isManifest = (
  value: unknown,
): value is { exports: Record<string, unknown> } =>
  typeof value === 'object' &&
  value !== null &&
  'exports' in value &&
  typeof value.exports === 'object' &&
  value.exports !== null

const readRepoFile = (relativePath: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
    'utf8',
  )

const getGroups = (
  source: string,
  pattern: RegExp,
  group: string,
): string[] => [
  ...new Set(
    source.matchAll(pattern).map((match) => match.groups?.[group] ?? ''),
  ),
]

const getSubpaths = (): string[] => {
  const manifest: unknown = JSON.parse(readRepoFile('package.json'))
  if (!isManifest(manifest)) {
    throw new Error('package.json declares no `exports` map')
  }
  return Object.keys(manifest.exports)
}

describe.concurrent('export map', () => {
  const barrel = readRepoFile('src/index.ts')
  const flatModules = getGroups(barrel, FLAT_REEXPORT, 'module')
  const directories = getGroups(barrel, DIRECTORY_REEXPORT, 'directory')
  const subpaths = getSubpaths()

  // Guards the guard: a broken extractor would make every assertion below
  // pass over an empty set.
  it('finds the flat modules the root barrel re-exports', () => {
    expect(flatModules.length).toBeGreaterThan(3)
    expect(flatModules).toContain('protection')
  })

  it.each(flatModules)('publishes %s under its own subpath', (module) => {
    expect(subpaths).toContain(`./${module}`)
  })

  // A new directory barrel must be weighed, not silently exempted.
  it('exempts only the directory barrels this verdict names', () => {
    expect(
      directories.toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(DIRECTORY_REEXPORTS)
  })

  it.each(subpaths.filter((subpath) => subpath !== MANIFEST_SUBPATH))(
    'points %s at files the build emits',
    (subpath) => {
      const target = subpath === '.' ? 'index' : subpath.slice(2)

      expect(() => readRepoFile(`src/${target}.ts`)).not.toThrow()
    },
  )

  // Tooling that reads the manifest breaks once an `exports` map exists
  // unless the manifest is published explicitly.
  it('publishes the manifest itself', () => {
    expect(subpaths).toContain(MANIFEST_SUBPATH)
  })
})
