# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the plugin source (TypeScript). Core entry points live in `src/core/`, with feature pipelines in `src/live-preview/` and `src/reading-mode/`, and shared utilities in `src/shared/`.
- `views/` and `editor-extensions/` (inside `src/`) hold UI panels and editor behaviors.
- `tests/` is split into `unit/`, `integration/`, and `e2e/` suites; shared Jest mocks live in `__mocks__/`.
- `lua_filter/` contains the Pandoc Lua filter used for custom label lists.
- Root assets/config include `styles.css`, `manifest.json`, `esbuild.config.mjs`, and `tsconfig.json`.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` runs the esbuild dev workflow for local development.
- `npm run build` produces the production build.
- `npm run lint` runs ESLint across the configured repository lint target.
- `npm test` runs Jest unit/integration tests.
- `npm run test:e2e` runs WebdriverIO E2E tests; `npm run test:e2e:dev` increases WDIO logging.
- `npm run test:all` runs unit/integration + E2E.

## Coding Style & Naming Conventions
- TypeScript-first; follow ESLint rules in `eslint.config.mjs`.
- Use 4-space indentation, single quotes, and semicolons as seen in `src/`.
- Import order follows the architecture guide: External → Types → Constants → Patterns → Utils → Internal.
- Keep files ≤400 lines and functions ≤50 lines (see `ARCHITECTURE.md`).
- Naming: `PascalCase` for classes/types, `camelCase` for functions/vars, `UPPER_SNAKE_CASE` for constants.

## Testing Guidelines
- Jest covers unit/integration tests; WDIO + Mocha covers E2E.
- Place tests under `tests/unit/`, `tests/integration/`, and `tests/e2e/specs/`.
- Naming: most tests use `.spec.ts`; some feature tests use `.test.ts`—match the local folder pattern. E2E uses `.e2e.ts`.
- Reuse mocks in `__mocks__/` where possible.

## Fenced Div Citation Notes
- Pandoc fenced divs render ids/classes on the div but do not render class names as titles.
- Pandoc parses `@id` after a fenced div as citation syntax, not as a built-in cross-reference to that div; current preview/reading mode should preserve `@id` text.
- Keep the existing fenced-div citation/autocomplete scaffolding for future custom Lua-filter-backed cross-reference support: `FencedDivReferenceSuggest`, `FencedDivReferenceProcessor`, `FencedDivReferenceInlineProcessor`, `FencedDivReferenceWidget`, and `fencedDivReferenceContentProcessor`.

## Commit & Pull Request Guidelines
- Recent commits are short, imperative, one-line summaries (e.g., “Fix…”, “Add…”, “Address…”); follow that style and avoid scopes unless needed.
- Before every commit, run `npm run lint` and resolve all reported errors.
- PRs should include: a concise summary, testing notes (commands + results), linked issues when applicable, and screenshots/GIFs for UI or CSS changes.
- Update `README.md` and `ARCHITECTURE.md` when behavior or structure changes.
