# Pandoc Module Architecture

This document explains how the optional Pandoc export module is organized, how
the current export and preview paths work, and where to make changes when
developing the module.

The Pandoc module lives under `src/pandoc/`. It is separate from the plugin's
Live Preview and Reading mode processors. Those renderers continue to work when
Pandoc is disabled, missing, or unavailable.

## Design Goals

The module is split into three layers:

```text
GUI layer  ->  core layer  <-  OS layer
```

The core layer does not import either concrete side. GUI code and OS code both
depend on core contracts.

| Layer | Owns | Must not own |
| --- | --- | --- |
| `src/pandoc/core/` | Export profiles, Pandoc argument construction, template variables, validation, catalog parsing, workflow coordination, preview planning, and port interfaces. | Obsidian APIs, DOM rendering, Node/Electron APIs, process spawning, filesystem calls. |
| `src/pandoc/gui/obsidian/` | Obsidian commands, settings UI, modals, notices, workspace/vault adaptation, and DOM preview rendering. | Node/Electron modules, process spawning, direct filesystem access. |
| `src/pandoc/os/common/` | Desktop operations: process execution, shell execution, filesystem access, hashing, temp paths, platform environment defaults, and Electron desktop actions. | Obsidian APIs or DOM UI. |

This gives the module two important properties:

- Core export logic can be reused with another GUI toolkit such as Qt, GTK, web,
  or another Electron shell.
- The current Obsidian integration can swap or mock OS behavior in tests without
  changing export logic.

ESLint enforces these boundaries in `eslint.config.mjs`. If a change needs a
new host capability, add it to a core port and implement it in the GUI or OS
layer instead of importing the host API into core.

## Folder Map

```text
src/pandoc/
|-- core/
|   |-- args/             # Pandoc executable, profile args, preview output args
|   |-- export/           # export planning, variables, execution, workflow
|   |-- ports/            # system, workspace, user, preview renderer contracts
|   |-- preview/          # preview session, format registry, artifact pipeline
|   |-- settings/         # default profiles and settings normalization
|   |-- templates/        # ${name} template rendering
|   `-- utils/            # core-safe path helpers
|-- gui/
|   `-- obsidian/
|       |-- commands/     # command palette and file-menu registration
|       |-- export/       # Obsidian-facing export manager
|       |-- modals/       # export modal and profile editor UI
|       |-- notices/      # user interaction port implementation
|       |-- renderers/    # DOM preview renderer registry and renderers
|       |-- settings/     # settings tab section
|       `-- workspace/    # vault, metadata, resource, and add-on adaptation
|-- os/
|   `-- common/           # desktop process/filesystem/shell/env adapters
|-- metadata/             # bundled Pandoc option metadata
|-- index.ts              # public core barrel
`-- obsidianDependencies.ts
```

Root files should stay small. Most new behavior belongs in one of the three
layer folders. `src/pandoc/obsidianDependencies.ts` is the composition point
that wires Obsidian GUI dependencies to desktop OS dependencies.

## Startup And Registration

`src/core/main.ts` is the plugin entrypoint. During startup it:

1. Releases bundled Lua filters by calling `releaseBundledPandocLuaFilters()`.
2. Builds Obsidian Pandoc dependencies with `createObsidianPandocOsDependencies()`.
3. Registers desktop-only Pandoc commands through `registerPandocExportCommands()`.

`registerPandocExportCommands()` exits early on non-desktop Obsidian. It also
checks the `pandocExport.enabled` setting before opening the export modal or
adding file-menu actions. This keeps the export backend optional and prevents
mobile startup from needing desktop-only process behavior.

Settings UI is registered separately through
`renderPandocExportSettingsSection()`. The settings section is visible in the
normal plugin settings tab, but export controls are desktop-only.

## Core Ports

Core code talks to the outside world through interfaces in
`src/pandoc/core/ports/index.ts`.

| Port | Main purpose | Current implementation |
| --- | --- | --- |
| `PandocSystemPort` | Run Pandoc, run explicit shell commands, read/write/remove files, create temp paths, report platform info, hash/download when available. | `CommonPandocSystemPort` in `os/common/systemPort.ts`. |
| `PandocWorkspacePort` | Read vault/plugin paths, active file, frontmatter, embeds, attachment folder, and settings. | `ObsidianPandocWorkspacePort` in `gui/obsidian/workspace/workspacePort.ts`. |
| `PandocUserInteractionPort` | Choose paths, confirm overwrites, show progress/errors/success, open or reveal output. | `ObsidianPandocUserInteractionPort` in `gui/obsidian/notices/userInteractionPort.ts`. |
| `PandocPreviewRendererPort` | Render a core preview artifact using GUI-specific rendering. | `ObsidianPandocPreviewRendererPort` in `gui/obsidian/renderers/previewRendererPort.ts`. |
| `PandocExportController` | GUI-facing controller contract for loading catalogs, editing draft profiles, previewing, exporting, and canceling. | `PandocCoreExportController` in `core/export/exportController.ts`. |

When adding a new workflow that needs host state, prefer adding a narrow method
to one of these ports or passing a smaller `Pick<...>` into the service that
needs it. Avoid making every service depend on the full port.

## Export Flow

The normal command path is:

```text
Obsidian command or file menu
  -> PandocExportModal
  -> PandocExportManager
  -> PandocExportWorkflowService
  -> PandocExportExecutionService
  -> PandocSystemPort.runProcess()
```

The important responsibilities are:

1. `PandocExportModal` owns Obsidian UI state: selected profile, output controls,
   editor rows, preview container, buttons, and modal lifecycle.
2. `PandocExportManager` adapts Obsidian data into core workflow inputs. It
   builds export variables through the workspace adapter, combines user env
   overrides with platform/runtime defaults, and creates the core workflow
   service.
3. `PandocExportWorkflowService` owns export behavior: profile selection, output
   path resolution, overwrite confirmation, execution, last-export settings, and
   post-export open/reveal actions.
4. `PandocExportExecutionService` converts profiles into process requests. It
   builds argument arrays for normal Pandoc profiles and runs custom shell
   profiles only when `type: "custom"` and `shell: true` are both set.
5. `CommonPandocSystemPort` delegates to desktop adapters that actually run
   processes and touch the filesystem.

Normal Pandoc profiles are executed as an executable plus argument array, not a
shell string. Shell execution is only for explicit advanced custom profiles.

## Profiles, Arguments, And Variables

Export profiles are persisted in `PandocExportSettings.profiles`. Built-in
defaults are defined in `core/settings/defaultProfiles.ts`, and persisted
settings are normalized by `normalizePandocExportSettings()`.

Profile editing uses draft objects:

- `profileDraft.ts` creates, edits, renders, and compiles profile drafts.
- `presetManager.ts` manages built-in and user presets.
- `validation.ts` reports profile and draft errors.
- `args/profileArgs.ts` turns a compiled Pandoc profile into an argument array.
- `templates/template.ts` renders simple `${name}` placeholders.

Variables come from `core/export/variables.ts` and the Obsidian workspace
adapter. The main variables include current file paths, output paths, vault and
plugin paths, attachment folder, embed directories, frontmatter metadata, and
the selected input format.

Environment construction is separate:

- User overrides live in `settings.pandocExport.env` and are edited from
  **Advanced Pandoc settings** as key/value rows rather than raw JSON.
- Platform defaults come from `os/common/environment.ts`.
- Runtime env can be exposed to template suggestions only when
  `suggestRuntimeEnvVariables` is enabled in the same Advanced modal.

Unknown template variables are preserved literally. JavaScript expressions are
not evaluated.

## Catalog And Command Builder

The command builder needs Pandoc option metadata for search, labels, value
widgets, and format extension editing.

Core catalog code lives in:

- `core/catalog.ts`
- `core/catalogHelpParser.ts`
- `core/optionsMetadata.ts`
- `core/formatExtensions.ts`
- `core/search.ts`
- `core/valueWidgets.ts`

The catalog service can use a real Pandoc process when available and fallback
metadata when it is not. GUI code should treat catalog loading as optional and
show a useful editor even when local Pandoc is missing.

The Obsidian profile editor lives in
`gui/obsidian/modals/PandocProfileEditorModal.ts`. It should remain an Obsidian
view/controller. Pure profile transformations belong in core.

## Preview Architecture

Preview support is intentionally modular and registration based. It has two
registries:

```text
Core format registry
  chooses preview pipeline and renderer plan
  -> creates PandocPreviewArtifact objects

Obsidian renderer registry
  chooses DOM renderer by artifact.rendererId
  -> renders into the export modal container
```

### Core Format Registry

`PandocPreviewFormatRegistry` lives in `core/preview/registry.ts`. The default
registry is created by `createDefaultPandocPreviewFormatRegistry()` and registers
modules from `core/preview/formats/` in priority order:

1. ODT
2. chunked HTML
3. HTML
4. text-like formats
5. PDF
6. DOCX
7. EPUB
8. PPTX
9. unsupported fallback

A format module implements `PandocPreviewFormatModule`:

- `match()` decides whether it owns a Pandoc target format/extension.
- `createPipeline()` returns one or more artifact creation stages.
- `createRendererPlan()` returns the intended renderer kind, label, renderer ID,
  add-on metadata, and optional preview metadata.

The preview workflow in `core/preview/previewWorkflow.ts` works like this:

1. `PandocPreviewSession.beginRun()` creates a temp output path and marks the
   run as current.
2. The format registry selects a pipeline and renderer plan.
3. `exportManager.previewFile()` runs Pandoc into the temp output path.
4. Stale runs are discarded and their temp files are removed.
5. Pipeline stages create artifacts. Some stages may convert the output to
   another format before rendering.
6. The selected `PandocPreviewRendererPort` renders the first successful
   artifact.

ODT is the main multi-stage example. It can use the optional WebODF add-on when
installed and fall back to Pandoc-generated HTML when the add-on is missing or
rendering fails.

### Obsidian Renderer Registry

`ObsidianPandocPreviewRendererRegistry` lives in
`gui/obsidian/renderers/registry.ts`. The default registry registers renderers
for HTML, text, PDF, DOCX, EPUB, PPTX, ODT/WebODF, and unsupported previews.

`ObsidianPandocPreviewRendererPort` receives a core `PandocPreviewArtifact`,
looks up `artifact.rendererId` with a fallback to `artifact.kind`, resets the
preview container, and delegates to the renderer module.

Renderer modules are allowed to use DOM APIs and browser-side libraries because
they live in the GUI layer. They should not run Pandoc, touch the filesystem
directly, or import Node/Electron APIs. Read preview output through the
`readText` and `readBinary` callbacks supplied by the renderer port.

## Adding Preview Support For A Format

Most preview extensions need both a core format module and an Obsidian renderer.

1. Add or update a module in `core/preview/formats/`.
2. Register it in `core/preview/defaultRegistry.ts` before broader fallbacks.
3. Return a stable `rendererId` from the module's renderer plan/artifact.
4. Add a renderer module under `gui/obsidian/renderers/`.
5. Register the renderer in `gui/obsidian/renderers/defaultRegistry.ts`.
6. Add focused tests for registry selection, artifact creation, renderer
   dispatch, and stale-run cleanup when relevant.

If the format can reuse an existing renderer, only the core module may be
needed. For example, many Pandoc writers can use the text renderer or HTML
renderer after conversion.

Keep conversion planning in core. Keep DOM details in the GUI renderer.

## OS Layer

`src/pandoc/os/common/` is the concrete desktop adapter layer used by the
Obsidian integration.

Important files:

- `PandocService.ts` runs Pandoc commands and catalog/version requests.
- `systemPort.ts` implements `PandocSystemPort`.
- `fileSystem.ts` wraps filesystem reads/writes/removals.
- `shellRunner.ts` runs explicit custom shell commands.
- `desktopAdapter.ts` wraps Electron open/reveal/dialog behavior.
- `environment.ts` provides platform environment defaults.
- `tempPath.ts` creates preview temp paths.
- `hash.ts` supports add-on checksum verification.
- `nodeModule.ts` handles dynamic desktop module loading.

Platform-specific behavior should live here unless it is purely GUI behavior.
Do not add `src/pandoc/os/linux`, `mac`, or `win` folders for constants only;
use separate folders only when platform-specific behavior grows enough to
justify them.

## Lua Filters And Resources

Source Lua filters live in `lua_filter/`. The build embeds them into the plugin
bundle, and `releaseBundledPandocLuaFilters()` writes them into the installed
plugin directory on startup.

Default profiles reference `${luaFilterDir}` so users do not need to download
filters separately. The two current bundled filters are:

- `FencedDivExtendedSyntax.lua`
- `CustomLabelList.lua`

Resource release and Obsidian plugin path handling belong in
`gui/obsidian/workspace/resources.ts`. Filter source and Pandoc behavior belong
in `lua_filter/`.

## Development Rules

Use these rules when changing the Pandoc module:

- Put pure behavior in `core/`.
- Put Obsidian, DOM, modal, notice, and workspace behavior in
  `gui/obsidian/`.
- Put Node, Electron, process, shell, filesystem, hash, download, and platform
  behavior in `os/common/`.
- Add host capabilities through ports instead of importing host APIs into core.
- Use argument arrays for Pandoc execution. Do not build shell command strings
  except for explicit custom shell profiles.
- Keep preview extensibility registration based. Avoid large `if/else` chains
  in the preview manager.
- Keep root-level Pandoc files limited to barrels, dependency composition,
  declarations, and metadata.
- Update `README.md` or user docs when a behavior visible to users changes.

## Testing Guide

Focused unit tests for the Pandoc module live under `tests/unit/pandoc/`.

Useful tests by area:

| Area | Test files |
| --- | --- |
| Export planning/workflow | `exportPlan.spec.ts`, `exportWorkflow.spec.ts`, `exportService.spec.ts`, `PandocExportManager.spec.ts` |
| Profiles and command rows | `exportProfiles.spec.ts`, `presetManager.spec.ts`, `PandocCommandRows.spec.ts`, `exportDraftController.spec.ts`, `exportController.spec.ts` |
| Variables and args | `exportVariables.spec.ts`, `pandocArgs.spec.ts`, `previewOutput.spec.ts`, `pandocPath.spec.ts` |
| Catalog and service behavior | `PandocService.spec.ts`, `pandocCore.spec.ts` |
| Ports and OS behavior | `obsidianPandocPorts.spec.ts`, `systemPort.spec.ts`, `resources.spec.ts`, `odtPreviewAddon.spec.ts` |
| Preview planning/rendering | `previewWorkflow.spec.ts`, `previewSession.spec.ts`, `previewArtifact.spec.ts`, `previewManager.spec.ts`, `previewRenderers.spec.ts`, `previewControls.spec.ts`, `previewSizing.spec.ts`, `previewPageMetadata.spec.ts` |
| Obsidian registration/settings | `registerPandocCommands.spec.ts`, `pandocExportSettingsSection.spec.ts` |

E2E coverage for UI and conversion behavior lives under `tests/e2e/specs/`,
including Pandoc profile editor layout, export modal close behavior, ODT preview
images, page preview shapes, extended syntax export parity, and conversion.

Before committing Pandoc changes, run:

```bash
npm run lint
npm test -- tests/unit/pandoc
```

Run `npm run test:e2e` when changing export modal layout, renderer behavior, or
end-to-end Pandoc conversion paths.
