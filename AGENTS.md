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
- Try to keep typescript files in src ≤500 lines and functions ≤50 lines (this is not a hard constraint)
- Naming: `PascalCase` for classes/types, `camelCase` for functions/vars, `UPPER_SNAKE_CASE` for constants.

## Testing Guidelines
- Jest covers unit/integration tests; WDIO + Mocha covers E2E.
- Place tests under `tests/unit/`, `tests/integration/`, and `tests/e2e/specs/`.
- Naming: most tests use `.spec.ts`; some feature tests use `.test.ts`—match the local folder pattern. E2E uses `.e2e.ts`.
- Reuse mocks in `__mocks__/` where possible.

## Fenced Div Cross-Reference Notes
- Pandoc fenced divs render ids/classes on the div but do not render class names as titles by default.
- Live Preview and Reading mode resolve known fenced-div citations such as `@id` into generated reference text; unknown citations remain raw/preserved for other citation processors.
- Fenced-div block titles render when a `title` attribute is present or when at least one class is present. If neither `title` nor class is present, the block has no visible title, though an id-only reference still uses `Div` as its reference type.
- `lua_filter/ReadableFencedDiv.lua` normalizes readable fenced-div shorthand for Pandoc export, and `lua_filter/FencedDivCrossRef.lua` wires fenced-div titles and cross-references in exported output.
- Keep fenced-div citation/autocomplete support aligned across `FencedDivReferenceSuggest`, `FencedDivReferenceProcessor`, `FencedDivReferenceInlineProcessor`, `FencedDivReferenceWidget`, and `fencedDivReferenceContentProcessor`.

## Optional Pandoc Integration Notes
- Pandoc export/rendering support belongs in an isolated optional module under `src/pandoc/`.
- Keep Pandoc as an optional desktop-only dependency. Do not require Pandoc, Node process APIs, or Electron APIs during normal plugin startup or existing Live Preview/Reading mode rendering.
- The core rendering features must continue to work when Pandoc is missing, disabled, or unavailable on mobile.
- Develop the Pandoc module in three layers: keep pure export/profile/preview logic in `src/pandoc/core/`, Obsidian UI/workspace/rendering code in `src/pandoc/gui/obsidian/`, and process/filesystem/Electron/platform behavior in `src/pandoc/os/common/`.
- Add new host capabilities through core ports instead of importing Obsidian, DOM, Node, or Electron APIs into core; keep preview support registration-based with core format modules and GUI renderer modules.
- Prefer service boundaries that accept argument arrays and injectable process runners; avoid shell-string command construction except for explicit custom shell profiles with `type: "custom"` and `shell: true`.
- UI should be task-oriented around export profiles, output paths, bundled Lua filters, extra args, and output preview rather than exposing raw command templates as the primary workflow.

## Commit & Pull Request Guidelines
- Recent commits are short, imperative, one-line summaries (e.g., “Fix…”, “Add…”, “Address…”); follow that style and avoid scopes unless needed.
- Before every commit, run `npm run lint` and resolve all reported errors.
- PRs should include: a concise summary, testing notes (commands + results), linked issues when applicable, and screenshots/GIFs for UI or CSS changes.
- Update `README.md` and docs in `docs/` when behavior or structure changes.
