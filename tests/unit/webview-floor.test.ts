import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// The es2023 webview floor must cover exactly the browser-reachable
// closure: the flat modules the root barrel re-exports (each published
// under its own subpath) plus every module they reach through a VALUE
// import — type imports erase at emit, so they pull nothing into a
// bundle. A file the closure reaches but the floor list misses would
// ship API the phone engines lack without any lint saying so; a file
// the list names but the closure no longer reaches would pin the floor
// on dead scope. Both directions fail here.

const FLAT_REEXPORT = /from '\.\/(?<module>[a-z\-]+)\.ts'/gv

const FLOOR_LIST = /const WEBVIEW_FLOOR_FILES = \[(?<entries>[^\]]*)\]/gv

const FLOOR_ENTRY = /'(?<file>[^']+)'/gv

// One statement spans from `import` to its single `from` clause; the
// lazy quantifier stops at the first, so statements never bleed into
// each other even without semicolons.
const IMPORT_STATEMENT =
  /^import(?<typeOnly> type)? (?<clause>[\s\S]*?)from '(?<specifier>[^']+)'/gmv

const RELATIVE_FLAT = /^\.\/(?<module>[a-z\-]+)\.ts$/v

const byName = (left: string, right: string): number =>
  left.localeCompare(right)

const readRepoFile = (relativePath: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
    'utf8',
  )

// The flat modules a source file pulls in through value imports.
const getValueImports = (source: string): string[] =>
  source
    .matchAll(IMPORT_STATEMENT)
    .filter((statement) => statement.groups?.typeOnly === undefined)
    .map(
      (statement) =>
        RELATIVE_FLAT.exec(statement.groups?.specifier ?? '')?.groups?.module,
    )
    .filter((module) => module !== undefined)
    .toArray()

const getEmittedClosure = (seed: readonly string[]): string[] => {
  const closure = new Set<string>()
  const pending = [...seed]
  for (
    let module = pending.pop();
    module !== undefined;
    module = pending.pop()
  ) {
    if (closure.has(module)) {
      continue
    }
    closure.add(module)
    pending.push(...getValueImports(readRepoFile(`src/${module}.ts`)))
  }
  return [...closure].toSorted(byName)
}

describe.concurrent('webview floor closure', () => {
  const barrel = readRepoFile('src/index.ts')
  const seed = [
    ...new Set(
      barrel.matchAll(FLAT_REEXPORT).map((match) => match.groups?.module),
    ),
  ].filter((module) => module !== undefined)
  const floorEntries = readRepoFile('eslint.config.ts')
    .matchAll(FLOOR_LIST)
    .flatMap((match) => (match.groups?.entries ?? '').matchAll(FLOOR_ENTRY))
    .map((match) => match.groups?.file)
    .filter((file) => file !== undefined)
    .toArray()

  // Guards the guard: broken extractors would equal two empty sets.
  it('finds the flat re-exports and the floor list', () => {
    expect(seed.length).toBeGreaterThan(3)
    expect(floorEntries.length).toBeGreaterThan(3)
  })

  it('follows at least one value-import edge beyond the seed', () => {
    expect(getEmittedClosure(seed).length).toBeGreaterThan(seed.length)
  })

  it('floors exactly the browser-reachable closure', () => {
    expect(floorEntries.toSorted(byName)).toStrictEqual(
      getEmittedClosure(seed).map((module) => `src/${module}.ts`),
    )
  })
})
