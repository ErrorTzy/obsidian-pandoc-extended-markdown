# Pandoc Module Architecture Status

This document records the current architecture of the optional Pandoc export module and the remaining gaps toward a portable, GUI-agnostic design.

Status date: 2026-06-05.

The implementation has moved well past the original proposal. `src/pandoc/core/` now contains most profile, catalog, argument, validation, export, preview-planning, and port contracts. `src/pandoc/gui/obsidian/` contains the Obsidian command, modal, settings, workspace, notice, and DOM preview code. `src/pandoc/os/common/` contains the desktop filesystem, process, shell, Electron desktop adapter, hashing, temp-path, and system-port implementations.

The runtime guarantee is unchanged: Pandoc export remains optional, desktop-oriented, and outside normal Live Preview and Reading mode startup.

## Current Folder Layout

```text
src/pandoc/
|-- core/
|   |-- args/
|   |-- export/
|   |-- preview/
|   |-- settings/
|   |-- templates/
|   |-- utils/
|   `-- ports/
|-- gui/
|   `-- obsidian/
|       |-- commands/
|       |-- export/
|       |-- modals/
|       |-- notices/
|       |-- renderers/
|       |-- settings/
|       `-- workspace/
|-- os/
|   `-- common/
`-- index.ts and dependency/declaration files
```

Root compatibility wrappers have been removed. Obsidian-facing functionality lives under `src/pandoc/gui/obsidian/`, OS dependency composition lives in `src/pandoc/obsidianDependencies.ts`, and the public Pandoc barrel remains in `src/pandoc/index.ts`.

## Dependency Rule

The intended dependency flow is mostly implemented:

```text
src/pandoc/gui/*  ->  src/pandoc/core/*
src/pandoc/os/*   ->  src/pandoc/core/*
src/pandoc/core/* ->  no GUI or concrete OS imports
```

Current boundary status:

| Boundary | Status |
| --- | --- |
| Core avoids Obsidian imports | Implemented. Obsidian imports are in `gui/obsidian/*`. |
| Core avoids DOM rendering | Implemented. `HTMLElement` rendering lives in `gui/obsidian/renderers/*`; preview workflow hands artifacts to a renderer port. |
| Core avoids Node/Electron imports | Implemented. Core does not import Node or Electron modules, and runtime environment values are injected from the OS dependency bundle. |
| GUI imports core contracts | Implemented. Obsidian workspace/user adapters and UI controllers consume core contracts. |
| OS imports core contracts | Implemented. `CommonPandocSystemPort`, filesystem, process, shell, hash, and temp-path adapters consume core types/utilities. |
| Automated boundary enforcement | Implemented through `eslint.config.mjs` rules for `src/pandoc/core`, `src/pandoc/gui`, and `src/pandoc/os`. |

## Implemented Core Contracts

`src/pandoc/core/ports/index.ts` now defines the proposed contracts:

- `PandocSystemPort`
- `PandocWorkspacePort`
- `PandocUserInteractionPort`
- `PandocPreviewRendererPort`
- `PandocExportController`

The system port is implemented by `src/pandoc/os/common/systemPort.ts` as `CommonPandocSystemPort`.

The Obsidian workspace port is implemented by `src/pandoc/gui/obsidian/workspace/workspacePort.ts`.

The Obsidian user-interaction port is implemented by `src/pandoc/gui/obsidian/notices/userInteractionPort.ts`.

`PandocPreviewRendererPort` is the active preview integration point. Core preview workflow hands a `PandocPreviewArtifact` to the GUI-supplied port, and the Obsidian implementation dispatches that artifact through an internal renderer registry to concrete `HTMLElement` rendering.

## Current Implementation Map

| Area | Current implementation | Status |
| --- | --- | --- |
| Profile/catalog logic | `core/catalog.ts`, `core/catalogHelpParser.ts`, `core/profileDraft.ts`, `core/presetManager.ts`, `core/search.ts`, `core/validation.ts`, option metadata files | Implemented in core. The old `gui-core` concept is gone. |
| Argument construction | `core/args/*`, `core/export/environment.ts`, `core/templates/*` | Implemented in core. Argument arrays are used for Pandoc profiles. Custom shell profiles remain explicit opt-in. |
| Export execution | `core/export/exportService.ts` | Implemented in core through `PandocSystemPort` subsets. No direct process or filesystem imports. |
| Export workflow | `core/export/exportWorkflow.ts` | Implemented in core for profile selection, output path resolution, overwrite handling, process execution, post-export settings, open/reveal actions, and preview conversion. |
| Export draft/controller | `core/export/exportDraftController.ts`, `core/export/exportController.ts` | Implemented in core. The controller exists, but the Obsidian modal still owns substantial UI state and binds runtime callbacks around it. |
| Obsidian export manager | `gui/obsidian/export/PandocExportManager.ts` | Partially extracted. It now composes workspace/user/system adapters and core workflow services, but still adapts Obsidian `App`, `PluginManifest`, and `TFile` concepts. |
| Obsidian modals/settings/commands | `gui/obsidian/modals/*`, `gui/obsidian/settings/*`, `gui/obsidian/commands/*` | Moved to GUI layer. `ExportModal.ts` and `PandocProfileEditorModal.ts` are still sizeable but under the correct ownership boundary. |
| Workspace adaptation | `gui/obsidian/workspace/*` | Implemented. Vault paths, plugin paths, frontmatter, embeds, attachment paths, Lua filter resources, and ODT add-on file handling are Obsidian-owned. |
| User interaction | `gui/obsidian/notices/*`, `os/common/desktopAdapter.ts` | Implemented through a GUI user port plus an Electron desktop adapter. |
| Preview planning | `core/preview/*` | Implemented through an internal format registry. Format modules select preview pipelines for every format reported by Pandoc's output format list. HTML and `chunkedhtml` use HTML previews, text-like writers use text previews, PDF/DOCX/EPUB/PPTX use bundled renderers, and ODT owns WebODF plus Pandoc HTML fallback stages. |
| Preview rendering | `gui/obsidian/renderers/*`, `gui/obsidian/previewManager.ts` | Implemented through an internal Obsidian renderer registry. The active path dispatches by `artifact.rendererId`, falls back to `artifact.kind` for compatibility, and keeps DOM rendering in per-renderer modules. |
| OS adapters | `os/common/*` | Implemented for dynamic desktop module loading, process execution, shell execution, filesystem, hashing, temp paths, desktop dialogs, and system-port composition. |
| Platform defaults | `os/common/environment.ts` | Implemented. Defaults are used by Obsidian dependency composition and injected into export environment construction. |

## OS Layer Assessment

The `src/pandoc/os/common/` layer is useful and should remain. It owns the real desktop boundary: dynamic imports for Node/Electron modules, process spawning, shell execution, filesystem access, hashing, temp paths, and Electron open/reveal/dialog behavior.

The environment-default constants are used. `createObsidianPandocOsDependencies()` calls `getPandocPlatformEnvDefaults(system.platform())`, and the Obsidian export manager passes those defaults into `buildPandocEnv()` for Pandoc process execution.

The old `src/pandoc/os/linux`, `src/pandoc/os/mac`, and `src/pandoc/os/win` files were not pulling their weight. They contained only environment-default constants:

- Linux: an empty defaults object.
- macOS: GUI-app PATH defaults for Homebrew and TeX.
- Windows: Pandoc and TeX-related environment defaults.

Because the cross-platform behavior is already wrapped by TypeScript in `os/common`, these platform folders are not needed for the current implementation. The constants now live directly in `os/common/environment.ts`.

Recommended direction:

- Keep `os/common/` as the concrete desktop adapter layer.
- Keep the public function `getPandocPlatformEnvDefaults(platform)` unchanged so callers and tests do not need to care where constants live.
- Reintroduce per-OS folders only when platform modules contain behavior, not just one-record constants.

The constants-only per-OS files have been removed. Git does not preserve empty directories, so those folders should reappear only when there is real platform-specific behavior to place in them.

## Remaining Gaps

1. Keep root-level Pandoc files limited to the barrel, dependency composition, declarations, and metadata.

## Migration Status

| Original step | Status |
| --- | --- |
| Move pure modules from `gui-core/*` into `core/*` | Complete. |
| Introduce core port interfaces for system, workspace, user interaction, and preview rendering | Complete. |
| Extract core export services from `PandocExportManager.ts` | Mostly complete. Core services own execution and workflow; the Obsidian manager now composes adapters. |
| Move Obsidian commands, settings, modals, notices, menus, current-file selection, vault adaptation, and metadata adaptation into `gui/obsidian/` | Complete. |
| Split preview planning from DOM rendering | Complete. Core owns registry-selected preview pipelines, stale-run cleanup, conversion stages, and renderer-port handoff; Obsidian owns registry-selected DOM rendering. |
| Move OS implementations into `os/{common,linux,mac,win}/` | Adjusted. `os/common` is the concrete desktop adapter layer; constants-only per-OS files were removed. |
| Add import-boundary enforcement | Complete through ESLint rules in `eslint.config.mjs`. |

## Acceptance Scenarios

These scenarios should continue to be preserved by tests:

- Active-file export uses the selected profile and writes to the chosen output target.
- Repeat previous export reuses the last request accurately.
- Overwrite confirmation can cancel, choose a new path, or proceed.
- Missing Pandoc reports a clear error without breaking plugin startup.
- Disabled export and mobile startup do not load desktop-only Pandoc dependencies.
- Preview cleanup removes stale temporary files and ignores stale render results.
- ODT preview uses the add-on when installed and falls back through Pandoc conversion when unavailable or failed.
- Preview format and renderer registries preserve current dispatch behavior while allowing format-specific preview modules.
- WebODF add-on install and remove update settings and files correctly.
- Custom shell profiles run only when explicitly opted in.
- Windows paths, environment variables, and path delimiters are handled correctly.
- macOS PATH defaults support common GUI app launch environments.
- Linux defaults work without platform-specific assumptions leaking into core.

## Test Coverage

Current focused coverage includes:

- Core export planning and workflow tests under `tests/unit/pandoc/exportPlan.spec.ts` and `tests/unit/pandoc/exportWorkflow.spec.ts`.
- Core catalog, profile, argument, preview-artifact, preview-workflow, output, and variable tests under `tests/unit/pandoc/`.
- `CommonPandocSystemPort` and platform environment default tests in `tests/unit/pandoc/systemPort.spec.ts`.
- Obsidian workspace and user port tests in `tests/unit/pandoc/obsidianPandocPorts.spec.ts`.
- Obsidian command, modal row, settings UI, export manager, preview manager, preview renderer registry, ODT add-on, and E2E preview/layout tests across `tests/unit/pandoc/` and `tests/e2e/specs/`.

Future tests should focus on any source change that adds real platform-specific OS modules.
