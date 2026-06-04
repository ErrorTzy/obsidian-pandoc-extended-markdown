# Pandoc Module GUI-Agnostic Architecture

This document proposes a target architecture for the optional Pandoc export module. It is a design proposal only: it does not describe completed source moves, and it must not change the current runtime guarantees that Pandoc export is desktop-only, optional, and absent from normal Live Preview and Reading mode startup.

The goal is to make the Pandoc export feature portable across host UIs while preserving the shipped Obsidian GUI. Future Qt, GTK, Electron, web, or other hosts should be able to reuse the same export/profile/preview planning core and supply their own GUI, workspace, and OS adapters.

## Current Coupling Map

The current `src/pandoc/` module already keeps Pandoc export separate from the Live Preview and Reading mode pipelines, but the export implementation still mixes domain logic, Obsidian host logic, desktop adapters, and DOM preview rendering.

| Area | Current files | Coupling to untangle |
| --- | --- | --- |
| Export orchestration | `PandocExportManager.ts` | Combines profile lookup, output path resolution, overwrite confirmation, Obsidian vault/metadata variable creation, filesystem preparation, process execution, settings persistence, and open/reveal post-actions. |
| Export modal | `ExportModal.ts`, `ExportModalContext.ts` | Builds Obsidian modal state, compiles profile drafts, reads current file data, constructs export requests, persists last export settings, and directly instantiates the export manager. |
| Preview pipeline | `previewManager.ts`, `previewRenderers.ts` | Mixes artifact planning, temp file lifecycle, ODT fallback conversion, stale-run cleanup, and DOM rendering through `HTMLElement`. |
| Desktop integration | `desktopAdapter.ts`, `fileSystem.ts`, `shellRunner.ts`, `resources.ts` | Wraps Electron dialogs/shell, Node filesystem, child process shell execution, and Obsidian vault writes for bundled Lua filters. |
| Settings and commands | `core/pandocExportSettingsSection.ts`, `registerPandocCommands.ts` | Uses Obsidian `Setting`, `Notice`, `Platform`, command registration, file menus, profile modals, and desktop checks directly. |
| Profile/catalog logic | `gui-core/*` | Mostly pure profile/catalog/search/validation helpers, but the folder name implies GUI ownership. Treat this as misnamed core domain code during migration. |

## Dependency Rule

The target dependency flow is strict:

```text
src/pandoc/gui/*  ->  src/pandoc/core/*
src/pandoc/os/*   ->  src/pandoc/core/*
src/pandoc/core/* ->  no GUI or concrete OS imports
```

`src/pandoc/core/*` must be completely GUI-agnostic and OS-agnostic. It should contain portable domain and application logic only. Core code may decide that it needs a file read, a process run, a dialog choice, progress reporting, or preview rendering, but it must request that behavior through an injected port interface. It must never call a system function or GUI-dependent function directly.

This also means core must not depend on concrete implementations in `gui/*` or `os/*`. The dependency is inverted: `gui/*` and `os/*` import core contracts, implement those contracts, and pass implementations into core services/controllers at composition time.

`src/pandoc/core/*` must not import:

- `obsidian`
- DOM types such as `HTMLElement`, `Document`, `Node`, or `window`
- Node or Electron modules
- Concrete filesystem, process, network, or desktop-dialog implementations
- Any implementation module from `src/pandoc/gui/*` or `src/pandoc/os/*`

Core code may define data contracts and ports. GUI and OS layers implement those ports and own all calls to host APIs, system APIs, and GUI APIs.

## Target Folder Layout

```text
src/pandoc/
|-- core/
|   |-- profiles/
|   |-- catalog/
|   |-- args/
|   |-- templates/
|   |-- validation/
|   |-- export/
|   |-- preview/
|   |-- settings/
|   `-- ports/
|-- gui/
|   `-- obsidian/
|       |-- commands/
|       |-- settings/
|       |-- modals/
|       |-- renderers/
|       |-- notices/
|       `-- workspace/
`-- os/
    |-- common/
    |-- linux/
    |-- mac/
    `-- win/
```

`core/` owns profile models, catalog parsing, argument construction, template substitution, validation, export sessions, preview artifact planning, settings normalization, and port types.

`gui/obsidian/` owns command registration, settings sections, modals, DOM preview renderers, notices, menus, current-file selection, vault adaptation, metadata/frontmatter adaptation, and the user-interaction/workspace port implementations supplied to core.

`os/` owns process runners, filesystem access, temp directories, platform environment defaults, path delimiter rules, open/reveal behavior, hashing, download helpers, and the system port implementations supplied to core.

## Core Contracts

These contracts are illustrative. Future implementation should adapt names and details to the codebase, but the ownership boundaries should remain stable.

### `PandocSystemPort`

```typescript
interface PandocSystemPort {
    runProcess(request: PandocProcessRequest): Promise<PandocRunResult>;
    runShell?(request: PandocShellRequest): Promise<PandocRunResult>;
    exists(path: string): Promise<boolean>;
    ensureDir(path: string): Promise<void>;
    readText(path: string): Promise<string>;
    readBinary(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: Uint8Array | string): Promise<void>;
    removeFile(path: string): Promise<void>;
    makeTempPath(extension: string): Promise<string>;
    platform(): PandocPlatformInfo;
    pathDelimiter(): string;
    hash?(data: Uint8Array | string): Promise<string>;
    download?(url: string): Promise<Uint8Array>;
}
```

This port replaces direct Node/Electron access in core. Shell execution remains optional and should only be available for explicitly opted-in custom shell profiles.

### `PandocWorkspacePort`

```typescript
interface PandocWorkspacePort {
    vaultPath(): Promise<string>;
    pluginPath(): Promise<string>;
    currentFile(): Promise<PandocCurrentFile | undefined>;
    readFrontmatter(filePath: string): Promise<Record<string, unknown>>;
    resolveEmbeds(filePath: string): Promise<PandocEmbed[]>;
    attachmentFolder(filePath: string): Promise<string>;
    loadSettings(): Promise<PandocExportSettings>;
    saveSettings(settings: PandocExportSettings): Promise<void>;
}
```

The Obsidian implementation adapts vault paths, plugin paths, current file descriptors, metadata cache/frontmatter, embeds, attachment-folder behavior, and settings persistence.

### `PandocUserInteractionPort`

```typescript
interface PandocUserInteractionPort {
    chooseFile(request: PandocChooseFileRequest): Promise<string | undefined>;
    chooseFolder(request: PandocChooseFolderRequest): Promise<string | undefined>;
    confirmOverwrite(path: string): Promise<string | undefined>;
    showProgress(message: string): PandocProgressHandle;
    showError(message: string): void;
    showSuccess(message: string): void;
    openOutput(path: string): Promise<void>;
    revealOutput(path: string): Promise<void>;
}
```

The GUI layer owns interactive decisions, status display, and host-specific open/reveal behavior. Core may ask for these operations through the port but must not display Obsidian notices, create modals, touch DOM, or invoke Electron dialogs directly.

### `PandocExportController`

```typescript
interface PandocExportController {
    loadCatalog(): Promise<PandocOptionCatalog>;
    selectProfile(profileId: string): Promise<PandocProfileDraft>;
    editOptionRow(rowId: string, patch: PandocOptionRowPatch): Promise<PandocProfileDraft>;
    setOutputTarget(target: PandocOutputTarget): Promise<void>;
    refreshPreview(): Promise<PandocPreviewPlan>;
    export(): Promise<PandocExportResult>;
    cancel(): Promise<void>;
}
```

The controller is the GUI-facing core facade. It coordinates settings, profile drafts, validation, preview planning, export execution, cancellation, and last-export persistence through ports. Obsidian modals should bind UI controls to this controller instead of rebuilding export orchestration locally.

### `PandocPreviewRendererPort`

```typescript
interface PandocPreviewRendererPort {
    render(request: {
        artifact: PandocPreviewArtifact;
        readText: (path: string) => Promise<string>;
        readBinary: (path: string) => Promise<Uint8Array>;
    }): Promise<void>;
}

interface PandocPreviewArtifact {
    kind: 'html' | 'text' | 'pdf' | 'docx' | 'epub' | 'pptx' | 'paged-html' | 'odt-addon' | 'unsupported';
    label: string;
    filePath: string;
    pageSize?: PandocPreviewPageSize;
}
```

Core decides which artifact should exist and how stale preview runs are cleaned up. GUI renderers decide how to display an artifact in a concrete host. `HTMLElement` must not enter core.

## Conceptual Splits

### Export Manager

Split the current `PandocExportManager` responsibilities into:

- Core export service: profile selection, variable model assembly from workspace data, output target resolution, argument generation, environment construction, validation, process execution, result modeling, cancellation, and last-export state.
- Workspace adapter: Obsidian vault paths, current file descriptors, metadata/frontmatter, plugin directory, Lua filter directory, and settings persistence.
- User interaction adapter: overwrite confirmation, progress, success/error notices, output open/reveal.
- OS adapter: file existence, output directory creation, process execution, shell execution, platform environment defaults, and path rules.

### Preview

Split preview into:

- Core preview planner: select renderer kind, create temp artifact path, run export into temp output, handle stale-run cleanup, plan ODT fallback conversion, expose artifact metadata.
- GUI preview renderer: render HTML, text, PDF, DOCX, EPUB, PPTX, paged HTML, ODT add-on output, and unsupported states for the active host.

`previewRenderers.ts` should move under the Obsidian GUI layer or split into host-specific renderer modules. `previewManager.ts` should lose direct `HTMLElement` dependencies when core preview planning is extracted.

### Profile And Catalog Helpers

Treat current `src/pandoc/gui-core/` as domain core. Most of the catalog parsing, option metadata, profile drafts, preview strings, search, validation, and preset management logic should move under `src/pandoc/core/`. Rename during migration so pure code is not hidden under a GUI-oriented folder name.

## Migration Sequence

1. Move pure modules from `gui-core/*` into `core/*` without changing behavior.
2. Introduce core port interfaces for system, workspace, user interaction, and preview rendering.
3. Extract core export services from `PandocExportManager.ts`, leaving Obsidian-specific wiring in `gui/obsidian/`.
4. Move Obsidian commands, settings sections, modals, notices, menus, current-file selection, vault adaptation, and metadata adaptation into `gui/obsidian/`.
5. Split preview planning from DOM rendering. Keep artifact selection and temp cleanup in core; move `HTMLElement` rendering into GUI renderers.
6. Move OS implementations from `desktopAdapter.ts`, `fileSystem.ts`, `shellRunner.ts`, environment defaults, path delimiter helpers, hashing, and download support into `os/{common,linux,mac,win}/`.
7. Add import-boundary enforcement through lint rules or dependency-cruiser-style checks so `core/*` cannot import Obsidian, DOM, Node, Electron, or concrete OS modules.

Each step should be mechanically verifiable and should preserve the existing settings schema and user-facing behavior.

## Non-Goals

- Do not build or ship a second GUI implementation as part of this architecture work.
- Do not change current export behavior, settings schema, profile semantics, or preview behavior during documentation-only planning.
- Do not remove custom shell profiles. Keep shell execution explicitly opt-in and advanced.
- Do not require Pandoc, Node process APIs, Electron APIs, or desktop filesystem APIs during normal plugin startup or on mobile.

## Maintainability Risks

Several current files exceed or approach the repository's preferred size limits and should be split during implementation:

| File | Current concern | Future split |
| --- | --- | --- |
| `previewRenderers.ts` | Large DOM renderer surface for many output types. | Separate renderer modules by artifact kind plus shared controls/sizing helpers. |
| `ExportModal.ts` | Modal state, controls, validation, preview refresh, and export actions in one file. | Split state/controller binding, profile controls, output controls, preview panel, and action footer. |
| `previewSizing.ts` | Page sizing and fit behavior is broad enough to stand alone by output family. | Split generic fit utilities from DOCX/ODT/PPTX-specific sizing. |

The migration should avoid broad rewrites. Extract small seams around ports and controllers, then move files once behavior is covered by focused tests.

## Acceptance Scenarios

Future implementation should preserve and test these scenarios:

- Active-file export uses the selected profile and writes to the chosen output target.
- Repeat previous export reuses the last request accurately.
- Overwrite confirmation can cancel, choose a new path, or proceed.
- Missing Pandoc reports a clear error without breaking plugin startup.
- Disabled export and mobile startup do not load desktop-only Pandoc dependencies.
- Preview cleanup removes stale temporary files and ignores stale render results.
- ODT preview uses the add-on when installed and falls back through Pandoc conversion when unavailable or failed.
- WebODF add-on install and remove update settings and files correctly.
- Custom shell profiles run only when explicitly opted in.
- Windows paths, environment variables, and path delimiters are handled correctly.
- macOS PATH defaults support common GUI app launch environments.
- Linux defaults work without platform-specific assumptions leaking into core.

## Test Strategy

Core services should be unit-tested with fake ports for process execution, filesystem, workspace, settings persistence, user interaction, and preview rendering. These tests should cover argument generation, output resolution, overwrite decisions, settings normalization, preview artifact planning, stale cleanup, ODT fallback decisions, missing Pandoc, and shell opt-in.

The Obsidian layer should keep E2E coverage for command registration, modal workflows, settings UI, export UX, overwrite confirmation, preview rendering, and desktop/mobile gating. OS adapters should have small integration tests where practical, with platform-specific behavior isolated behind the port contracts.
