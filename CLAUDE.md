# CLAUDE.md

Typed Node.js client for the MELCloud (Classic) and MELCloud Home APIs.
ESM only, Node >= 22.19, published to GitHub Packages. `erasableSyntaxOnly`
is on: no runtime enums, no parameter properties, no runtime namespaces.

## Commands

- `npm run lint` / `npm run lint:fix` — ESLint (runs with an 8 GB heap).
- `npm test` / `npm run test:coverage` — vitest; coverage must stay at 100%.
- `npm run typecheck` — `tsc` from `@typescript/native` (TypeScript 7);
  does not cover `*.config.ts` (the lint does). The tooling (typedoc,
  typescript-eslint) still resolves the separate `typescript` 6.x install.
- `npm run format` / `npm run format:fix` — prettier.
- `npm run docs` — typedoc. The config is `typedoc.config.js` (JSDoc-typed
  with `@ts-check`: typedoc cannot load `.ts` configs and silently ignores
  them); validation warnings fail the build.

## Domain gotchas

- Classic auth failure is NOT a 401: `/Login/ClientLogin3` answers HTTP 201
  with `{ LoginData: null }` on rejected credentials. `doAuthenticate`
  throws `AuthenticationError` on that shape; the 401 wrapping in
  `toAuthFailure` exists for the Home API's OIDC/token-expiry flows. Never
  assume all auth failures surface as 401 `HttpError`.
- Wire-format types mirror the MELCloud APIs verbatim (PascalCase fields,
  one-letter report keys); do not rename them to satisfy style rules.
- `EffectiveFlags` bitfields (`src/facades/classic-flags.ts`) are the one
  sanctioned home of hex magic numbers and bitwise operators.

## Lint doctrine

- Code adapts to the rules, never the reverse. Fix violations in code;
  never loosen a rule, restate defaults, or add options to accommodate
  existing code. Order of preference: refactor > `files`-scoped block for a
  protocol-imposed shape > documented inline disable.
- Inline disables need a `-- reason` and a widely-accepted use case
  (bitfields, branded-type casts, parse-boundary casts, fire-and-forget
  `.catch()`, namespace merging). Never a bare disable.
- Zero-warning policy: every enabled rule is at `error`.
- Metric caps (`complexity`, `max-depth`, `vitest/max-nested-describe`) are
  pinned to measured codebase ceilings: exceeding one means refactor, not
  bump. Prove any stricter option with an instrumented run (zero violations)
  before adopting it.
- `no-unused-vars` is never loosened globally; the decorator-protocol
  `_context` parameter is the only exception, scoped in the
  `src/decorators/**` block.
- Config comments are sober: one short line, only for non-obvious
  constraints (ownership by another tool, ordering, Node-version gates,
  measured ceilings).

## TypeScript & docs conventions

- Tool ownership: prettier = formatting, perfectionist = all sorting,
  `@typescript-eslint/naming-convention` = naming, import-x = imports,
  jsdoc plugin = doc comments on `src/**`.
- `readonly` on array parameters only when omitting it causes a type error
  — lean signatures over defensive typing for internal code.
- TSDoc (`flat/recommended-tsdoc-error`): documented functions need
  `@param name - Description.` for every parameter, `@returns` for
  non-void, `@template` per generic, `@throws` where relevant; no blank
  line between the description and the first tag. One-liner `/** … */` is
  fine for consts, types, and schemas.
- `src/temporal.ts` is the only sanctioned `temporal-polyfill` entry point
  (enforced by `no-restricted-imports`).
- Tests import vitest APIs explicitly (no globals) and use `it` inside
  `describe`, `.each` for tables, `describe(fn)` function titles.
  Boolean names take a semantic prefix (`is`, `has`, `should`…); `device`
  is the one sanctioned exception (its `false` is a sentinel, not a flag).

## Repo process

- GitHub merge queue is impossible here: the repo is user-owned and the
  feature is org-only (verified via API — no ruleset payload enables it).
  Dependabot PRs auto-merge via `gh pr merge --auto`; the `merge_group`
  triggers in the workflows are inert but harmless.
- The docs site deploys only on release or `gh workflow run docs.yml`.
- CI: `Test (Node latest)` is `continue-on-error` by design — keep it out
  of required status checks. Sonar coverage runs on the `lts/*` leg only.

## Releasing

- Publishing is release-triggered (`publish.yml`): a **published GitHub
  Release** packs and `npm publish`es to GitHub Packages. A release marked
  **prerelease** publishes under the `next` dist-tag; a normal one under
  `latest`. The version comes from `package.json` at the released commit,
  so bump it before tagging.
- Prerelease/alpha flow keeps `main` on the target stable version (no
  `-alpha` suffix): branch from `main`, bump, push the branch, then cut a
  prerelease release off it — which publishes under `next`:

  ```sh
  npm version 41.0.0-alpha.0 --no-git-tag-version
  gh release create v41.0.0-alpha.0 --target <branch> --prerelease
  ```

  Consumers install it with `@olivierzal/melcloud-api@next` (GitHub
  Packages needs `NODE_AUTH_TOKEN`).

- Downstream `com.melcloud` (sibling repo, uses `/classic` + `/home`)
  upgrades by pinning the dep to the new version (exact for a prerelease)
  then running its `typecheck`/`lint`/`test`/`build`; open the PR from that
  repo. A major bump's breaking surface is the CHANGELOG `[Unreleased]`
  section.
