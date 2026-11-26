# ADR 002: Split tool runtime and UI

- **Status:** Proposed (owner approved the approach on 2026-11-26)
- **Date:** 2026-11-26
- **Supersedes:** the single `ImageTool` contract from Phase 0

## Context

Phase 0 defined one `ImageTool` interface holding both worker logic (`run`, `validate`) and UI (`Panel`, `labelKey`, `icon`). The image worker looks tools up by id, so it imported the registry, and through it every tool's `Panel` (`React.lazy`). Even with the Panel lazy, the worker bundle pulled in React: `image.worker` grew from 10.4 kB to 20.7 kB (about 3 kB gzip of React, 8.2 kB gzip in total). Nothing broke, but any tool that imports a UI module at the top of its entry point can silently drag UI code into every worker.

## Decision

Split the contract in two, with one registry for each side:

| Side        | Type          | Registry             | Imported by         |
| ----------- | ------------- | -------------------- | ------------------- |
| Worker      | `ToolRuntime` | `runtimeRegistry.ts` | `image.worker`      |
| Main thread | `ToolUI`      | `uiRegistry.ts`      | the app (`src/app`) |

Both carry the same `id`. Options types, defaults and `validate` live in a React-free `options.ts` that both sides (and the app's validation) can import.

Enforcement, so this does not depend on remembering:

- ESLint `no-restricted-imports` bans `react`, `react-dom`, `*.tsx`, `ui.ts` and `uiRegistry.ts` in `src/core`, `src/codecs`, `runtimeRegistry.ts`, and each tool's `runtime.ts` and `options.ts`.
- `size-limit` caps `image.worker-*.js` at 10 kB gzip (currently 5.1 kB).
- `registry.test.ts` checks that both registries list the same ids in the same order.

## Consequences

- Worker bundle: 20.7 kB → 12.3 kB raw (8.2 kB → 5.1 kB gzip), with no React inside.
- A new tool adds two small files (`runtime.ts`, `ui.ts`) instead of one `index.ts`, and a line in each registry.
- The `ImageTool` type and `registry.ts` are removed. Nothing outside this repo depends on them.
- The 10 kB worker cap is a backstop, not a precise measure: the ESLint rule is the real guard. Raise the cap deliberately when tools legitimately grow the worker.
