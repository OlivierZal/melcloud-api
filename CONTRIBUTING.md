# Contributing

Thanks for considering a contribution. This document describes the local workflow expected before opening a pull request.

## Prerequisites

- Node.js `>= 22` (matches `engines.node` in `package.json`)
- npm 10+
- A GitHub personal access token with the `read:packages` scope, exported as `GITHUB_TOKEN` (the `.npmrc` reads from this env var to fetch `@olivierzal` scoped dependencies)

## Setup

```sh title="setup"
git clone https://github.com/OlivierZal/melcloud-api.git
cd melcloud-api
npm ci
```

## Local checks

Run the same suite that CI runs on every pull request:

```sh title="checks"
npm run typecheck       # tsgo --noEmit
npm run lint            # ESLint with the all + strict-type-checked configs
npm run format          # prettier --check (run npm run format:fix to write)
npm test                # vitest run
npm run test:coverage   # vitest run --coverage (must remain at 100%)
```

The `prepublishOnly` script chains tests + typecheck + lint + format — publishing locally without these passing is impossible.

## Coverage

Branches, functions, lines, and statements are all enforced at **100%** in [`vitest.config.ts`](vitest.config.ts). New code must come with the tests that keep these thresholds green; review will request changes otherwise.

## Commits & pull requests

- Commit messages: short, imperative, present tense (`Add HomeFacade error mapping`). No conventional-commits prefix is required.
- Keep PRs focused — a single concern per PR makes review and bisecting easier.
- Update [`CHANGELOG.md`](CHANGELOG.md) under the `## [Unreleased]` heading describing user-visible changes.
- Breaking changes: call them out explicitly in the PR description and the changelog entry.

## Releases

Releases are cut by the maintainer via GitHub Releases; the `publish.yml` workflow then publishes to GitHub Packages. The version follows [SemVer](https://semver.org).
