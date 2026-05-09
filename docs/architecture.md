# Pandoc Extended Markdown Plugin Architecture

> Comprehensive technical documentation for the pandoc-extended-markdown plugin. This document helps developers understand existing implementations, debug issues, and extend functionality without duplicating code.

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [Component Inventory](#component-inventory)
4. [Processing Pipeline Details](#processing-pipeline-details)
5. [Implementation Patterns](#implementation-patterns)
6. [Extension Guide](#extension-guide)

## Overview

This plugin extends Obsidian's markdown rendering to support Pandoc's extended syntax. It operates in two distinct modes with shared state management:

- **Live Preview Mode**: Real-time syntax transformation using CodeMirror 6 decorations
- **Reading Mode**: Post-processing of rendered HTML using DOM manipulation

### Supported Syntax

| Syntax Type | Examples | Implementation |
|-------------|----------|----------------|
| **Fancy Lists** | `A.`, `i.`, `(a)` | FancyListProcessor |
| **Hash Lists** | `#.` auto-numbering | HashListProcessor |
| **Example Lists** | `(@label)` with references | ExampleListProcessor |
| **Custom Labels** | `{::LABEL}` with placeholders | CustomLabelProcessor |
| **Definition Lists** | `: definition`, `~ definition` | DefinitionProcessor |
| **Fenced Divs** | `::: {.theorem #id title="Theorem &"}` or readable `::: Theorem & #id` renders `Theorem 1`; `@id` → `Theorem 1` | FencedDivProcessor + FencedDivReferenceProcessor |
| **Superscript** | `^text^` with escaped spaces | SuperscriptProcessor |
| **Subscript** | `~text~` with escaped spaces | SubscriptProcessor |

## Core Architecture

### Design Principles

1. **Two-Phase Processing Pipeline**
   - Phase 1: Structural (block-level) processing
   - Phase 2: Inline (content) processing
   - Clean separation prevents interference between processors

2. **Base Class Hierarchy**
   - `BaseWidget`: Common widget functionality (DOM creation, events, lifecycle)
   - `BaseStructuralProcessor`: Shared structural processor logic (cursor detection, decorations, context)
   - `BasePanelModule`: Shared panel logic (state, updates, rendering)
   - Reduces duplication, ensures consistency

3. **Centralized Configuration**
   - Constants organized in modular structure:
     - `/core/constants.ts`: Main constants and re-export surface
     - `/core/constants/listConstants.ts`: LIST_MARKERS, LIST_TYPES, INDENTATION
     - `/core/constants/cssConstants.ts`: CSS_CLASSES, COMPOSITE_CSS, DECORATION_STYLES
   - All patterns in `ListPatterns` class (`/shared/patterns.ts`)
   - All types in `/shared/types/` directory

4. **State Management**
   - Document-specific: PluginStateManager
   - Processing artifacts: ProcessingContext
   - User preferences: Settings

5. **Feature Flags**
   - Syntax enable/disable state is centralized in `shared/types/settingsTypes.ts`
   - `normalizeSettings()` keeps persisted settings consistent and preserves legacy `moreExtendedSyntax` compatibility
   - `isSyntaxFeatureEnabled()` is the shared gate for live preview, reading mode, editor suggestions, autocompletion, and panel visibility
   - Settings UI groups syntax toggles separately from list auto-completion controls and sidebar panel controls
   - Unordered list marker cycling and source-aware marker rendering are separate settings so keyboard behavior and visual styling can be enabled independently
   - Unordered list marker cycling has a configurable nesting-depth order for `-`, `+`, and `*`
   - Ordered list marker cycling is a keyboard-only setting with a configurable nesting-depth order for supported non-auto ordered markers: decimal, alpha, and roman variants using `.` or `)`

6. **Error Handling**
   - Centralized error handling with `errorHandler.ts`
   - `withErrorBoundary()` for synchronous operations
   - `withAsyncErrorBoundary()` for async operations
   - Consistent error context and recovery patterns

7. **Code Quality Standards**
   - Maximum 400 lines per file
   - Maximum 50 lines per function
   - Import order: External → Types → Constants → Patterns → Utils → Internal
   - All hardcoded values in constants
   - Proper TypeScript types (no `any` without justification)

### Architectural Patterns

| Pattern | Purpose | Implementation |
|---------|---------|----------------|
| **Template Method** | Standardize widget lifecycle | BaseWidget.toDOM() |
| **Strategy** | Select processor per syntax | Processor.canProcess() |
| **Observer** | React to mode changes | StateManager.onModeChange() |
| **Registry** | Extensible content processing | ContentProcessorRegistry |
| **Chain of Responsibility** | Process lines or DOM features sequentially | ProcessingPipeline, ReadingModePipeline |

## Component Inventory

### Live Preview Components

#### Structural Processors (`/live-preview/pipeline/structural/`)

All structural processors extend `BaseStructuralProcessor` which provides:
- `isCursorInMarker()`: Check if cursor is within marker range
- `isInvalidInStrictMode()`: Validate strict mode compliance
- `createLineDecoration()`: Create standard line decorations
- `createContentMarkDecoration()`: Create content area decorations
- `createMarkerReplacement()`: Create marker replacement widgets
- `createContentRegion()`: Define regions for inline processing
- `setListContext()`: Update list context for continuation detection
- `processStandardList()`: Template method for standard list processing

| Processor | Priority | Purpose | Triggers On | Extends |
|-----------|----------|---------|-------------|---------|

* CustomLabelProcessor is modularized into `/customLabel/` subdirectory for better organization
| **HashListProcessor** | 10 | Auto-number `#.` lists | `^\s*#\.` | BaseStructuralProcessor |
| **CustomLabelProcessor*** | 15 | Process `{::LABEL}` markers | `^\s*\{::` | StructuralProcessor |
| **FencedDivProcessor** | 18 | Render fenced div open/content/close lines | unindented `:::` with Pandoc-recognized attributes, plus readable shorthand when strict mode is off, at block boundaries | BaseStructuralProcessor |
| **FancyListProcessor** | 20 | Letter/Roman lists | `^\s*[A-Za-z0-9]+[.)]` | BaseStructuralProcessor |
| **DefinitionProcessor** | 20 | Definition list items | `^:\s` or `^~\s` | StructuralProcessor |
| **ExampleListProcessor** | 30 | Example lists `(@label)` | `^\s*\(@` | BaseStructuralProcessor |
| **StandardListProcessor** | 25 | Adds source-marker classes to standard unordered lists when distinct marker rendering is enabled while preserving native rendering | `^\s*[-*+]\s+` | StructuralProcessor |
| **ListContinuationProcessor** | 100 | Indented continuations | Indented non-empty lines | StructuralProcessor |

#### Inline Processors (`/live-preview/pipeline/inline/`)

| Processor | Priority | Processes | Regions |
|-----------|----------|-----------|---------|
| **ExampleReferenceProcessor** | 10 | `(@ref)` → `(number)` | list-content, definition-content |
| **FencedDivReferenceProcessor** | 12 | `@id` → fenced-div `referenceText` such as `Proposition 1` or `Warning` | normal, fenced-div-content, list-content, definition-content |
| **SuperscriptProcessor** | 20 | `^text^` → superscript | list-content, definition-content |
| **SubscriptProcessor** | 20 | `~text~` → subscript | list-content, definition-content |
| **CustomLabelReferenceProcessor** | 40 | `{::ref}` → processed | list-content, definition-content |

#### Widgets (`/live-preview/widgets/`)

All widgets extend `BaseWidget` which provides:
- `toDOM()`: Template method for rendering
- `applyStyles()`: CSS class application
- `setContent()`: Content insertion
- `setupClickHandler()`: Cursor positioning
- `destroy()`: Cleanup with AbortController

| Widget | Extends | Renders |
|--------|---------|---------|
| **FancyListMarkerWidget** | BaseWidget | `A.`, `i.`, `(a)` markers |
| **HashListMarkerWidget** | BaseWidget | Auto-numbered markers |
| **ExampleListMarkerWidget** | BaseWidget | `(@label)` → `(n)` with tooltip |
| **DuplicateExampleLabelWidget** | BaseWidget | Error styling for duplicates |
| **CustomLabelMarkerWidget** | BaseWidget | `{::LABEL}` processed markers |
| **CustomLabelPartialWidget** | BaseWidget | Partial label rendering |
| **CustomLabelPlaceholderWidget** | BaseWidget | `#a` → number |
| **CustomLabelProcessedWidget** | BaseWidget | Fully processed labels |
| **CustomLabelInlineNumberWidget** | BaseWidget | Inline number replacements |
| **CustomLabelReferenceWidget** | BaseWidget | `{::ref}` with hover preview |
| **DuplicateCustomLabelWidget** | BaseWidget | Error styling for duplicates |
| **DefinitionBulletWidget** | BaseWidget | Definition list bullets |
| **FencedDivHeaderWidget** | BaseWidget | Fenced div opener placeholder with generated theorem-style title text and optional id tooltip |
| **FencedDivClosingWidget** | BaseWidget | Hidden closing fence placeholder |
| **FencedDivReferenceWidget** | BaseWidget | `@id` → rendered fenced-div reference with hover preview |
| **ExampleReferenceWidget** | BaseWidget | `(@ref)` → `(n)` with hover |
| **SuperscriptWidget** | BaseWidget | Superscript formatting |
| **SubscriptWidget** | BaseWidget | Subscript formatting |

### Reading Mode Components

Reading mode uses a small processor pipeline around rendered preview DOM. The public entrypoint remains `processReadingMode(element, context, config, app?)`; it builds a `ReadingModeContext` and runs the default registry from `/reading-mode/pipeline/registry.ts`.

#### Pipeline Core (`/reading-mode/pipeline/`)

| File | Purpose |
|------|---------|
| **ReadingModePipeline.ts** | Registers processors and runs enabled processors in priority order |
| **types.ts** | Defines `ReadingModeContext`, `ReadingModeProcessor`, `BlockDomProcessor`, `InlineTextProcessor`, and Obsidian app adapter types |
| **registry.ts** | Builds the default processor set and shared context |

`ReadingModeContext` contains the rendered root element, Obsidian post-processor context, preview section and section info, source path, optional full source, processor config, render context, document counters, app adapter, and strict-mode validation lines.

#### Block/DOM Processors (`/reading-mode/pipeline/processors/`)

| Processor | Priority | Purpose |
|-----------|----------|---------|
| **UnorderedListMarkerProcessor** | 20 | Adds or clears source-marker classes on rendered unordered list items |
| **DefinitionListNormalizationProcessor** | 40 | Schedules delayed normalization/rebuild of rendered definition lists, using full source when available |
| **FencedDivBlockProcessor** | 60 | Schedules section-scoped fenced div block rendering |
| **ExtendedListBlockProcessor** | 120 | Preserves existing rendered behavior for hash, fancy, example, and source-backed definition list paragraphs |
| **InlineTextEngineProcessor** | 300 | Runs registered inline processors through the shared text-node replacement engine |
| **CustomLabelListProcessor** | 400 | Runs the existing two-pass custom label list processor after other replacements |

#### Inline Text Processors (`/reading-mode/pipeline/inline/`)

Inline processors report text-node matches and create replacement nodes. They do not walk the DOM themselves; `textReplacementEngine.ts` collects text nodes once, applies shared skip rules, sorts matches, drops overlaps deterministically, and replaces each text node once.

| Processor | Purpose |
|-----------|---------|
| **ExampleReferenceInlineProcessor** | `(@ref)` → resolved example number with tooltip |
| **FencedDivReferenceInlineProcessor** | `@id` → numbered fenced-div reference with tooltip |
| **SuperscriptInlineProcessor** | `^text^` → `<sup class="pem-superscript">` |
| **SubscriptInlineProcessor** | `~text~` → `<sub class="pem-subscript">` |
| **CustomLabelReferenceInlineProcessor** | `{::ref}` → processed custom label reference |

The shared inline walker skips code, preformatted blocks, headings, math containers, already rendered spans, fenced div headers, and plugin-rendered references/markers.

#### Feature Implementations (`/reading-mode/features/`)

Pipeline processors should orchestrate work only. Feature-specific parsing, rendering, DOM repair, and source matching live under `/reading-mode/features/`, grouped by the syntax they own. New reading-mode behavior should be added as a pipeline processor and registered in `registry.ts`; reusable feature logic belongs in the matching feature folder.

| Feature Folder | Purpose |
|----------------|---------|
| **extended-lists/** | Parses and renders hash, fancy, example, and parsed-line definition-list content |
| **definition-lists/** | Owns source-backed Pandoc definition-list parsing, rendering, parsed-line adaptation, and DOM normalization |
| **fenced-divs/** | Owns fenced-div scheduling, source-opening validation, DOM candidate splitting, block rendering, label hydration, and reference hydration |
| **custom-labels/** | Owns custom-label list parsing, marker rendering, definition paragraph rendering, and reference replacement |
| **super-sub/** | Provides the legacy whole-element superscript/subscript processor used by focused tests and compatibility paths |
| **unordered-lists/** | Maps source unordered-list markers to rendered reading-mode list item classes |

Definition-list file names describe their data flow:

| File | Purpose |
|------|---------|
| **sourceParser.ts** | Parses markdown source text into Pandoc definition-list blocks |
| **sourceRenderer.ts** | Renders parsed source blocks and surrounding paragraph content |
| **parsedLineAdapter.ts** | Adapts `ParsedLine[]` blocks into the canonical source-backed renderer |
| **normalizer.ts** | Rebuilds malformed rendered definition-list DOM from source when needed |

Fenced-div file names describe their ownership:

| File | Purpose |
|------|---------|
| **processor.ts** | Coordinates scheduling and block processing |
| **candidateDom.ts** | Splits and replaces rendered paragraph/list-item DOM candidates |
| **sourceOpenings.ts** | Validates which rendered openers are allowed by source block boundaries |
| **rendering.ts** | Creates fenced-div DOM, hydrates labels, and hydrates references |
| **types.ts** | Shares fenced-div reading-mode implementation types |

### Panel Modules (`/views/panels/modules/`)

All panels extend `BasePanelModule` which provides:
- Lifecycle management (activate/deactivate/update)
- State management (containerEl, activeView, abortController)
- Context building (example labels, custom labels)
- Base update flow

| Module | ID | Displays |
|--------|----|---------|
| **ExampleListPanelModule** | example-lists | Three columns: number, label, content |
| **CustomLabelPanelModule** | custom-labels | Two columns: processed label, content |
| **DefinitionListPanelModule** | definition-lists | Two columns: term, definitions |
| **FencedDivPanelModule** | fenced-divs | Three columns: title metadata, citation label, content |
| **FootnotePanelModule** | footnotes | Two columns: footnote label, rendered content |

### Editor Extensions

#### List Autocompletion (`/editor-extensions/listAutocompletion/`)

**Modular architecture for keyboard handling:**

```
listAutocompletion/
├── index.ts               # Main export, combines all handlers
├── types.ts               # All interfaces and types
├── handlers/
│   ├── enterHandler.ts    # Enter key logic
│   ├── tabHandler.ts      # Tab/Shift+Tab logic
│   ├── shiftHandlers.ts   # Shift+Enter logic
│   ├── emptyListHandler.ts    # Empty list handling
│   ├── listItemHandler.ts     # New list item creation
│   └── continuationHandler.ts # Continuation lines
└── utils/
    ├── lineInfo.ts        # Line information utilities
    ├── markerDetection.ts # List marker detection
    ├── indentation.ts     # Indentation utilities
    ├── orderedMarkers.ts  # Ordered marker depth cycling
    ├── unorderedMarkers.ts # Unordered marker depth cycling
    └── continuationUtils.ts # Continuation helpers
```

| Component | Purpose | Max Lines |
|-----------|---------|----------|
| **handlers/** | Event-specific keyboard handlers | 135 |
| **utils/** | Reusable utility functions | 83 |
| **types.ts** | All TypeScript interfaces | 52 |
| **index.ts** | Factory function and exports | 23 |

### Shared Components

#### Extractors (`/shared/extractors/`)

| Extractor | Returns | Used By |
|-----------|---------|---------|
| **exampleListExtractor** | ExampleListItem[] | Panels, context building |
| **customLabelExtractor** | CustomLabel[] | Panels, processing |
| **definitionListExtractor** | DefinitionListItem[] | Definition panel |
| **fencedDivExtractor** | FencedDivPanelItem[] | Fenced div panel, scanner context |
| **footnoteExtractor** | FootnotePanelItem[] | Footnote panel, cursor positioning |

#### Utilities (`/shared/utils/`)

| Utility | Purpose | Used For |
|---------|---------|----------|
| **errorHandler** | Centralized error handling | All try-catch blocks |
| **mathRenderer** | LaTeX → Unicode conversion | Panel displays |
| **hoverPopovers** | Hover preview creation | References, tooltips |
| **contentTruncator** | Smart content truncation | Panel displays |
| **fencedDivReferenceMetadata** | Fenced-div title, numbering, and reference metadata | Live Preview, Reading mode, panels, export parity tests |
| **listHelpers** | List manipulation | Autocompletion |
| **placeholderProcessor** | Process `#a`, `#b` | Custom labels |
| **cursorUtils** | Cursor position calculations | Inline processors |
| **contextUtils** | Reference context building | Inline processors, widgets |

#### Reading Mode Utilities (`/reading-mode/utils/`)

| Utility | Purpose | Used For |
|---------|---------|----------|
| **domUtils** | DOM traversal helpers | Reading mode processors and feature implementations |

## Processing Pipeline Details

### Live Preview Processing Flow

#### Phase 0: Context Building
```typescript
1. Code Region Detection
   - Identify code blocks: ```...```
   - Identify inline code: `...`
   - Mark regions to skip

2. Document Scanning
   - Extract example labels → Map<label, number>
   - Extract custom labels → Map<label, processed>
   - Extract labeled fenced divs, including non-strict readable shorthand title templates → Map<label, reference metadata>
   - Skip code regions

3. Validation (Strict Mode)
   - Check Pandoc compliance
   - Mark invalid lines

4. State Retrieval
   - Get hash counter
   - Get definition state
   - Get placeholder context
```

#### Phase 1: Structural Processing
```typescript
For each line (top to bottom):
  1. Skip if in code block
  2. Try processors by priority:
     - HashListProcessor (10)
     - CustomLabelProcessor (15)
     - FencedDivProcessor (18)
     - FancyListProcessor (20)
     - DefinitionProcessor (20)
     - StandardListProcessor (25)
     - ExampleListProcessor (30)
     - ListContinuationProcessor (100)
  3. First matching processor:
     - Creates structural decorations
     - Marks content regions
     - Updates state/counters
     - Can skip further processing
```

#### Phase 2: Inline Processing
```typescript
For each content region from Phase 1:
  1. All processors find matches:
     - ExampleReferenceProcessor
     - FencedDivReferenceProcessor
     - SuperscriptProcessor
     - SubscriptProcessor
     - CustomLabelReferenceProcessor
  2. Filter overlapping matches
  3. Skip matches in code regions
  4. Create decorations for valid matches
  5. Check cursor position (avoid replacing during edit)
```

#### Decoration Assembly
```typescript
1. Combine structural + inline decorations
2. Sort by position
3. Validate document bounds
4. Build RangeSet
5. Return to CodeMirror
```

### Reading Mode Processing Flow

```typescript
1. Obsidian calls processReadingMode(element, context, config, app?)
2. createReadingModeContext() builds one shared context:
   - rendered root element and preview section
   - source path and section info
   - ProcessorConfig and RenderContext
   - document counters and label maps from PluginStateManager
   - strict-mode validation lines
3. createDefaultReadingModePipeline() registers block and inline processors
4. ReadingModePipeline runs enabled processors by priority:
   - source-aware marker classes
   - delayed definition list normalization
   - section-scoped fenced div rendering
   - extended list paragraph rendering
   - shared inline text replacement
   - custom label list post-pass
5. Processors own any required scheduling or source lookup
6. Idempotency is enforced with processed-element state and inline skip rules
```

### State Management Flow

```mermaid
graph TB
    Doc[Document Change] --> Scanner[Scanner]
    Scanner --> SM[StateManager]

    SM --> |Counters| LP[Live Preview]
    SM --> |Counters| RM[Reading Mode]
    SM --> |References| Panels[Panel Views]

    LP --> Decorations
    RM --> DOM
    Panels --> Display

    Mode[Mode Change] --> SM
    SM --> |Clear States| Reset[Reset Counters]
```

## Implementation Patterns

### Pattern 1: Adding a Live Preview List Type

**Already Implemented**: FancyListProcessor, ExampleListProcessor, CustomLabelProcessor

```typescript
// 1. Create processor extending BaseStructuralProcessor
class NewListProcessor extends BaseStructuralProcessor {
    name = 'new-list';
    priority = 25;

    canProcess(line: Line, context: ProcessingContext): boolean {
        // Check your pattern
        return /your-pattern/.test(line.text);
    }

    process(line: Line, context: ProcessingContext): StructuralResult {
        // Option A: Use the template method for standard lists
        const widget = new YourWidget(/* params */);
        return this.processStandardList(
            line, context, markerStart, markerEnd,
            contentStart, widget, 'new-list', listLevel
        );

        // Option B: Custom processing with base methods
        const decorations = [];
        decorations.push(this.createLineDecoration(line));
        if (!this.isCursorInMarker(start, end, context)) {
            decorations.push(this.createMarkerReplacement(start, end, widget));
        }
        // ... etc
    }
}

// 2. Create widget extending BaseWidget
class NewListWidget extends BaseWidget {
    protected applyStyles(element: HTMLElement): void {
        element.className = 'your-classes';
    }

    protected setContent(element: HTMLElement): void {
        // Set your content
    }
}

// 3. Register in extension.ts
pipeline.registerStructuralProcessor(new NewListProcessor());
```

### Pattern 2: Adding Live Preview Inline Syntax

**Already Implemented**: ExampleReferenceProcessor, SuperscriptProcessor

```typescript
// 1. Create inline processor
class NewInlineProcessor implements InlineProcessor {
    supportedRegions = new Set(['list-content', 'definition-content']);

    findMatches(text: string, region: ContentRegion, context: ProcessingContext) {
        // Find your syntax
        // Check cursor position to avoid edit interference
        // See ExampleReferenceProcessor for pattern
    }
}

// 2. Register in extension.ts
pipeline.registerInlineProcessor(new NewInlineProcessor());
```

### Pattern 2b: Adding Reading Mode Syntax

Reading mode has its own processor interface because it works against rendered DOM and partially available source text, not CodeMirror document offsets.

```typescript
// 1. Create a block/DOM processor when the syntax changes structure
class NewReadingBlockProcessor implements BlockDomProcessor {
    name = 'new-reading-block';
    phase = 'block';
    priority = 150;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableYourFeature !== false;
    }

    process(context: ReadingModeContext): void {
        // Read context.element, context.sectionInfo, context.counters, etc.
        // Own any delayed scheduling here if Obsidian rendering is not settled.
    }
}

// 2. Or create an inline text processor when the syntax replaces text nodes
class NewReadingInlineProcessor implements InlineTextProcessor {
    name = 'new-reading-inline';
    phase = 'inline';
    priority = 350;

    findMatches(text: string, node: Text, context: ReadingModeContext): InlineTextMatch[] {
        // Return non-overlapping candidate ranges relative to this text node.
    }

    createReplacement(match: InlineTextMatch, context: ReadingModeContext): Node {
        // Return a DOM node or nodes. The shared engine handles replacement.
    }
}

// 3. Register in /reading-mode/pipeline/registry.ts
pipeline.registerProcessor(new NewReadingBlockProcessor());

const inlineProcessors = [
    // ...
    new NewReadingInlineProcessor()
];
```

Keep reading-mode processors DOM/source-oriented. Do not port CodeMirror decorations, document offsets, or cursor editing behavior into reading mode.

### Pattern 3: Adding a Panel Module

**Already Implemented**: ExampleListPanelModule, CustomLabelPanelModule

```typescript
// 1. Extend BasePanelModule
class NewPanelModule extends BasePanelModule {
    id = 'new-panel';
    displayName = 'New Panel';
    icon = ICONS.NEW_ICON;

    private data: YourDataType[] = [];

    protected extractData(content: string): void {
        this.data = extractYourData(content);
    }

    protected renderContent(activeView: MarkdownView): void {
        // Render your content
        // See ExampleListPanelModule for pattern
    }

    protected cleanupModuleData(): void {
        this.data = [];
    }
}

// 2. Register in ListPanelView.ts
const module = new NewPanelModule(this.plugin);
availablePanels.push({...});
```

### Pattern 4: Cross-Reference Processing

**Already Implemented**: Example references, Custom label references

```typescript
// Pattern: Build context → Process references → Update display
1. Extract labels during scanning
2. Build Map<label, value> in context
3. Processors use context to resolve references
4. Panels use context for hover previews
```

### Pattern 5: Modular File Organization

**Already Implemented**: listAutocompletion module, CustomLabelProcessor, reading-mode feature folders

**Pattern for breaking down large files (>400 lines):**

```typescript
// Example 1: listAutocompletion refactoring
// Original: single file with all handlers
// Refactored:
listAutocompletion/
├── index.ts        # Main export
├── types.ts        # Interfaces
├── handlers/       # Event handlers
│   └── *.ts
└── utils/          # Utilities
    └── *.ts

// Example 2: CustomLabelProcessor refactoring
// Original: one large processor
// Refactored:
CustomLabelProcessor.ts  # Main processor
customLabel/
├── types.ts        # Interfaces
├── parser.ts       # Parsing logic
└── decorations.ts  # Decoration creation

// Example 3: reading-mode feature refactoring
// Original: mixed parser/renderer/normalizer files
// Refactored:
reading-mode/
├── pipeline/       # Orchestration and inline engine
├── features/       # Feature-owned implementation modules
└── utils/          # Shared DOM utilities
```

**Refactoring Techniques Applied:**
- **Extract Method**: Break large functions into smaller focused ones
- **Extract Module**: Move related functions to separate files
- **Single Responsibility**: Each file has one clear purpose
- **Preserve Behavior**: All tests pass after refactoring

### Pattern 6: Error Handling

**Standard Pattern**: Use centralized error handling utilities

```typescript
// For synchronous operations
import { withErrorBoundary } from '../shared/utils/errorHandler';

function myFunction() {
    return withErrorBoundary(() => {
        // Your code here
        return result;
    }, fallbackValue, 'operation context');
}

// For asynchronous operations
import { withAsyncErrorBoundary } from '../shared/utils/errorHandler';

async function myAsyncFunction() {
    return await withAsyncErrorBoundary(async () => {
        // Your async code here
        return await result;
    }, fallbackValue, 'async operation context');
}
```

## Extension Guide

### Where to Add Features

| Feature Type | Location | Extend/Implement | Register In |
|--------------|----------|------------------|-------------|
| Live preview list syntax | `/live-preview/pipeline/structural/` | StructuralProcessor | extension.ts |
| Live preview inline formatting | `/live-preview/pipeline/inline/` | InlineProcessor | extension.ts |
| Live preview reference type | `/live-preview/pipeline/inline/` | InlineProcessor | extension.ts |
| Widget display | `/live-preview/widgets/` | BaseWidget | Used by processor |
| Panel content | `/views/panels/modules/` | BasePanelModule | ListPanelView.ts |
| Data extraction | `/shared/extractors/` | Function | Used by panels |
| Reading mode block behavior | `/reading-mode/pipeline/processors/` | BlockDomProcessor | reading-mode/pipeline/registry.ts |
| Reading mode inline behavior | `/reading-mode/pipeline/inline/` | InlineTextProcessor | reading-mode/pipeline/registry.ts |

### Common Tasks

#### Task: Support a New List Marker Style
1. Check `FancyListProcessor` - it likely already handles it
2. If not, add pattern to `ListPatterns.FANCY_LIST`
3. Gate it through `isSyntaxFeatureEnabled()` if it should be user-toggleable
4. Test with `tests/unit/processors/structural/FancyListProcessor.spec.ts`

#### Task: Add Hover Preview to Something
1. Use `setupRenderedHoverPreview()` from `hoverPopovers.ts`
2. Pass context with label maps
3. See `CustomLabelReferenceWidget` for example

#### Task: Process Content with Math
1. Use `renderContentWithMath()` from `views/panels/utils/viewInteractions.ts`
2. It handles markdown, math, and references
3. See panel modules for examples

#### Task: Add New Panel Tab
1. Extend `BasePanelModule`
2. Implement `extractData()` and `renderContent()`
3. Register in `ListPanelView.initializePanels()`
4. Add icon to `constants.ts`

---

## Quick Reference

### File Map
```
/core/main.ts           → Plugin entry, lifecycle
/core/settings.ts       → User preferences
/core/state/            → State management
/core/constants.ts      → Constants aggregate and re-export surface
/core/constants/        → Split constant modules
  listConstants.ts      → List markers, types, indentation
  cssConstants.ts       → CSS classes, styles
/editor-extensions/     → Editor enhancements
  /listAutocompletion/  → Modular keyboard handlers
    /handlers/          → Event-specific handlers
    /utils/             → Shared utilities
  /suggestions/         → Autocomplete suggestions
/live-preview/          → CodeMirror integration
  /pipeline/            → Two-phase processing
    /structural/        → Structural processors
      customLabel/      → CustomLabelProcessor modules
    /inline/           → Inline processors
  /widgets/             → DOM decorations
/reading-mode/          → Post-processing
  /pipeline/            → DOM/source processor pipeline
    /processors/        → Block and orchestration processors
    /inline/            → Inline text processors and replacement engine
  /features/            → Feature-owned parsing, rendering, DOM repair, and source matching
  /utils/               → DOM utilities
/views/panels/          → Sidebar panels
/shared/                → Cross-mode utilities
  /utils/               → Shared utilities
  /patterns.ts          → All regex patterns
```

### Key Interfaces
```typescript
interface StructuralProcessor {
    canProcess(line: Line, context: ProcessingContext): boolean;
    process(line: Line, context: ProcessingContext): StructuralResult;
}

interface InlineProcessor {
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[];
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration;
}

interface PanelModule {
    onActivate(containerEl: HTMLElement, activeView: MarkdownView | null): void;
    onUpdate(activeView: MarkdownView | null): void;
}

interface ReadingModeProcessor {
    name: string;
    phase: 'setup' | 'block' | 'inline' | 'cleanup';
    priority: number;
    isEnabled?(context: ReadingModeContext): boolean;
    process(context: ReadingModeContext): void;
}

interface InlineTextProcessor extends ReadingModeProcessor {
    phase: 'inline';
    findMatches(text: string, node: Text, context: ReadingModeContext): InlineTextMatch[];
    createReplacement(match: InlineTextMatch, context: ReadingModeContext): Node | Node[];
}
```

### Testing
- **Unit tests**: `/tests/unit/` - Mock dependencies
- **Integration tests**: `/tests/integration/` - Component interaction
- **E2E tests**: `/tests/e2e/` - Real Obsidian environment

### Code Standards Summary
- **File Size**: Maximum 400 lines (split larger files into modules)
- **Function Size**: Maximum 50 lines (use Extract Method pattern)
- **Import Order**: External → Types → Constants → Patterns → Utils → Internal
- **Constants**: All hardcoded values must be in constants files
- **Type Safety**: Avoid `any` type; use proper TypeScript interfaces
- **Naming**: PascalCase for classes/interfaces, camelCase for functions/variables, UPPER_SNAKE_CASE for constants

---

*This is a living document. Update it when adding significant features or changing architecture.*
