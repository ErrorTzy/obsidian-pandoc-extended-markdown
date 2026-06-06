# Pandoc Preview Refactor Plan

This document defines the target architecture for modular Pandoc export preview support. It is a planning artifact only; no runtime behavior changes are implied by this document.

## Goals

- Make preview support modular by registering format preview modules instead of editing shared selector and renderer switch statements.
- Keep the current three-layer model intact:
    - `src/pandoc/os/` owns process, filesystem, temp path, and desktop boundaries.
    - `src/pandoc/core/` owns GUI-agnostic preview planning and pipeline execution.
    - `src/pandoc/gui/obsidian/` owns DOM rendering and Obsidian UI integration.
- Keep preview modules easy to locate by format. Adding or removing a format preview should usually mean adding or removing one core format module and one GUI renderer module.
- Preserve current behavior for HTML, text-like outputs, PDF, DOCX, EPUB, PPTX, ODT, and unsupported formats.
- Do not expose a third-party public registration API yet. Registration is internal, but the contracts should be shaped so a public API can be considered later.

## Target Model

Preview support should be split into two internal registries.

The core format preview registry chooses and executes the preview pipeline for a Pandoc output format. It is GUI agnostic and works only with format names, output extensions, temporary artifact paths, export results, conversion services, and generic artifact metadata.

The Obsidian renderer registry maps a GUI renderer id to concrete DOM rendering code. It does not decide how the artifact was produced. For example, the ODT module may produce a direct WebODF artifact or a converted HTML artifact, but the GUI renderer port should only dispatch the final artifact by `rendererId`.

The current ODT special case should move into the ODT preview module. The generic preview workflow should not contain ODT-specific branches.

## Core Preview Registry

Add core preview registry types under `src/pandoc/core/preview/`:

```text
src/pandoc/core/preview/
|-- registry.ts
|-- types.ts
|-- defaultRegistry.ts
`-- formats/
    |-- docx.ts
    |-- epub.ts
    |-- html.ts
    |-- odt.ts
    |-- pdf.ts
    |-- pptx.ts
    |-- text.ts
    `-- unsupported.ts
```

The registry should expose these internal concepts:

- `PandocPreviewFormatRegistry`: ordered module collection with `register(module)` and `select(request)`.
- `PandocPreviewFormatModule`: format-owned preview support unit.
- `PandocPreviewMatchRequest`: normalized `to` format, normalized extension, settings relevant to preview, and optional catalog data later.
- `PandocPreviewPipeline`: ordered stages for producing a renderable artifact.
- `PandocPreviewStage`: a stage that can render an existing artifact, convert to a derived artifact, or continue to the next stage when unavailable or failed.
- `PandocPreviewRendererId`: string identifier consumed by the GUI renderer registry.

The default registry should be built in one place, such as `createDefaultPandocPreviewFormatRegistry(settings.preview)`, and injected into `PandocPreviewWorkflowService` or `PandocPreviewManager`.

## Artifact Contract

Extend `PandocPreviewArtifact` without breaking current callers:

```ts
interface PandocPreviewArtifact {
    kind: PandocPreviewArtifactKind;
    formatId?: string;
    rendererId?: string;
    label: string;
    filePath: string;
    sourcePath?: string;
    addonInstallPath?: string;
    addonVersion?: string;
    pageSize?: PandocPreviewPageSize;
    metadata?: Record<string, unknown>;
}
```

`kind` should remain during the migration as a compatibility alias for existing tests and exports. New dispatch logic should prefer `rendererId`, falling back to `kind` only for compatibility.

Renderer-specific fields that do not belong in the shared artifact should move toward `metadata`. Existing ODT add-on fields can remain during the first migration to keep the change narrow, then be folded into metadata in a later cleanup if worthwhile.

## Format Modules

Each current preview path should become a core format module:

- `html`: matches `html`, `html4`, `html5`, and HTML slide formats, plus `.html`; produces `rendererId: 'html'`.
- `text`: matches text-like extensions such as `.md`, `.tex`, `.typ`, `.rst`, `.rtf`, `.opml`, `.bib`, `.json`, and `.xml`; produces `rendererId: 'text'`.
- `pdf`: matches `pdf` or `.pdf`; produces `rendererId: 'pdf'`.
- `docx`: matches `docx` or `.docx`; produces `rendererId: 'docx'`.
- `epub`: matches `epub*` or `.epub`; produces `rendererId: 'epub'`.
- `pptx`: matches `pptx` or `.pptx`; produces `rendererId: 'pptx'`.
- `odt`: matches `odt` or `.odt`; owns both WebODF and Pandoc HTML fallback.
- `unsupported`: final fallback module; produces `rendererId: 'unsupported'`.

ODT should be modeled as a multi-stage pipeline:

1. If WebODF is enabled, installed, and has an install path, render the generated `.odt` with `rendererId: 'odt-webodf'`.
2. If WebODF is unavailable or rendering fails, convert the generated `.odt` to standalone embedded HTML with Pandoc and render the resulting `.html` with `rendererId: 'html'`.

The ODT fallback artifact should carry the original `.odt` as `sourcePath` for traceability, but the HTML renderer should not need to inspect that value to decide fallback behavior. Any fallback notice should be driven by artifact metadata supplied by the ODT module, not by renderer label/source-path heuristics.

## GUI Renderer Registry

Split the Obsidian renderer layer into a registry and per-renderer files:

```text
src/pandoc/gui/obsidian/renderers/
|-- registry.ts
|-- types.ts
|-- defaultRegistry.ts
|-- shared/
|   |-- flowPreview.ts
|   |-- pageStyle.ts
|   `-- unsupportedPreview.ts
|-- htmlRenderer.ts
|-- textRenderer.ts
|-- pdfRenderer.ts
|-- docxRenderer.ts
|-- epubRenderer.ts
|-- pptxRenderer.ts
|-- odtWebOdfRenderer.ts
`-- previewRendererPort.ts
```

The registry should expose:

- `ObsidianPandocPreviewRendererRegistry` with `register(renderer)` and `get(rendererId)`.
- `ObsidianPandocPreviewRendererModule` with `id`, `label`, and `render(request)`.
- `ObsidianPandocPreviewRenderRequest` containing the container, artifact, and reader functions.

`ObsidianPandocPreviewRendererPort` should receive the registry in its constructor, clear/reset the container once, then dispatch by `artifact.rendererId ?? artifact.kind`. It should render an unsupported message if no renderer is registered.

The existing `previewRenderers.ts` should become a compatibility shim during migration. It may re-export `renderPreviewFile()` and `selectPreviewRenderer()` for current tests/imports, but new code should use the renderer registry.

## Workflow Migration

Implement the refactor in this order:

1. Add core registry/types/default modules while keeping `selectPreviewRendererPlan()` as a wrapper around the default registry.
2. Update `PandocPreviewWorkflowService` so it asks the registry for a pipeline and runs generic stages instead of branching on ODT renderer kinds.
3. Move ODT fallback conversion into the ODT module and remove ODT-specific workflow methods after tests pass.
4. Add the Obsidian renderer registry and move each renderer from `previewRenderers.ts` into its own file.
5. Update `ObsidianPandocPreviewRendererPort` to dispatch through the renderer registry.
6. Keep compatibility exports in `src/pandoc/core/index.ts` and `src/pandoc/gui/obsidian/renderers/index.ts` until internal imports are migrated.
7. Update `docs/pandoc-architecture.md` after implementation to describe the completed registry architecture.

## Compatibility Requirements

- Existing settings shape must remain unchanged.
- Pandoc export and preview must remain optional and desktop-oriented.
- Core preview code must not import Obsidian, DOM, Node, Electron, or concrete OS modules.
- GUI code must not import concrete OS modules.
- Root compatibility wrappers under `src/pandoc/*.ts` have been removed; use the package barrel or concrete `core/`, `gui/obsidian/`, and `os/common/` modules.
- Existing exports should remain available during the first refactor:
    - `selectPreviewRendererPlan`
    - `createPreviewArtifact`
    - `selectPreviewRenderer`
    - `renderPreviewFile`

## Test Plan

Add or update focused unit tests:

- Core registry selects the same preview support as today for HTML, slide HTML, text-like outputs, PDF, DOCX, EPUB, PPTX, ODT, and unknown formats.
- Core registry preserves module ordering and lets the unsupported module act as the final fallback.
- Preview workflow runs a generic single-stage render pipeline.
- Preview workflow runs a generic multi-stage pipeline where the first stage fails and the second stage converts/renders a derived artifact.
- ODT module selects WebODF when installed and enabled.
- ODT module converts to embedded-resource HTML when WebODF is disabled, unavailable, or fails.
- GUI renderer registry dispatches by `rendererId`, falls back by `kind` for compatibility, and renders unsupported output for unknown ids.
- Existing renderer behavior remains covered for HTML, text, PDF, DOCX, EPUB, PPTX, and WebODF.

Run these commands before completing the implementation refactor:

```bash
npm test
npm run lint
npm run build
```

Run targeted preview E2E specs when Pandoc and the preview dependencies are available:

```bash
npm run test:e2e -- --spec tests/e2e/specs/pandocPagePreviewShapes.e2e.ts
npm run test:e2e -- --spec tests/e2e/specs/pandocOdtPreviewImages.e2e.ts
```

## Out Of Scope

- Adding preview support for every format returned by `pandoc --list-output-formats`.
- Adding a documented third-party plugin API for preview renderer registration.
- Changing export profile settings, Pandoc argument construction, or normal Live Preview/Reading mode rendering.
- Reintroducing root compatibility wrappers.
