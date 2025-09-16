# Lightweight Refactoring Plan for Pandoc Lists Plugin

## Executive Summary
The codebase has good architectural patterns with base classes and clear separation of concerns, but violates several coding protocols around file/function sizes and has opportunities for reducing duplication. This plan prioritizes high-impact, low-risk refactoring that can be done incrementally.

## Critical Issues to Fix (Priority 1 - Week 1-2)

### 1.1 Break Down listAutocompletion.ts (764 lines → ~200 lines per module)
**File:** `src/editor-extensions/listAutocompletion.ts`
**Issue:** 91% over 400-line limit, making it hard to maintain and test
**Solution:**
```
listAutocompletion/
├── index.ts                    # Main export, keybinding registration
├── handlers/
│   ├── enterHandler.ts         # handleListEnter logic (~150 lines)
│   ├── tabHandler.ts           # handleListTab logic (~150 lines)
│   └── shiftHandlers.ts        # Shift+Tab, Shift+Enter (~100 lines)
├── utils/
│   ├── lineInfo.ts            # CurrentLineInfo and related functions
│   ├── markerDetection.ts     # List marker detection logic
│   └── listItemCreation.ts    # New list item creation logic
└── types.ts                    # All interfaces
```

### 1.2 Refactor Long Functions (>50 lines)
**Files with violations:**
- `reading-mode/parsers/parser.ts:58` - parseLine() [92 lines]
  - Split into: `detectListType()`, `applyListParsing()`, `handleSpecialCases()`
- `live-preview/pipeline/structural/DefinitionProcessor.ts:66` - processDefinitionItem() [82 lines]
  - Extract: `createDefinitionDecorations()`, `handleDefinitionContent()`, `updateDefinitionState()`
- `core/main.ts:131` - registerCommands() [81 lines]
  - Split by command groups: `registerListCommands()`, `registerPanelCommands()`, `registerDebugCommands()`

## High Priority Refactoring (Priority 2 - Week 2-3)

### 2.1 Eliminate Duplication: Super/Subscript Processors
**Files:** `SuperscriptProcessor.ts`, `SubscriptProcessor.ts`
**Solution:** Create `BaseInlineFormatProcessor.ts`
```typescript
abstract class BaseInlineFormatProcessor implements InlineProcessor {
    abstract pattern: RegExp;
    abstract widgetClass: typeof BaseWidget;
    abstract escapedSpace: string;

    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        // Shared implementation
    }

    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        // Shared implementation
    }
}
```

### 2.2 Split Large Structural Processors
**Files to refactor:**
- `CustomLabelProcessor.ts` (512 lines)
  - Extract: `CustomLabelParser`, `CustomLabelValidator`, `CustomLabelDecorator`
- `ProcessingPipeline.ts` (490 lines)
  - Split: `StructuralPipeline`, `InlinePipeline`, `PipelineCoordinator`

## Medium Priority Improvements (Priority 3 - Week 3-4)

### 3.1 Centralize All Patterns
**Current violations:** Inline regex patterns in multiple files
**Solution:** Extend `ListPatterns` class
```typescript
// shared/patterns.ts
export class ListPatterns {
    // ... existing patterns ...

    // Add missing patterns
    static readonly LEADING_SPACES = /^(\s*)/;
    static readonly CONTINUATION_INDENT = /^\s{3,}/;
    static readonly CODE_FENCE = /^```/;
    // ... etc
}
```

### 3.2 Fix Style Manipulation Protocol Violations
**Files:** `viewInteractions.ts`, `hoverPopovers.ts`
**Solution:** Create positioning utilities in constants
```typescript
// core/constants.ts
export const POSITION_CLASSES = {
    HOVER_TOP: 'pandoc-hover-top',
    HOVER_BOTTOM: 'pandoc-hover-bottom',
    HOVER_LEFT: 'pandoc-hover-left',
    HOVER_RIGHT: 'pandoc-hover-right',
} as const;

// Use data attributes for dynamic positioning
element.dataset.offsetX = String(offsetX);
element.dataset.offsetY = String(offsetY);
```

### 3.3 Extract Common Panel Row Rendering
**Files:** All panel modules have similar `renderXXXRow()` methods
**Solution:** Create `BasePanelRowRenderer`
```typescript
abstract class BasePanelRowRenderer<T> {
    abstract getColumns(item: T): ColumnData[];
    abstract handleClick(item: T, column: number): void;

    renderRow(item: T, container: HTMLElement): void {
        // Shared row rendering logic
    }
}
```

## Low Priority Enhancements (Priority 4 - Ongoing)

### 4.1 Improve JSDoc Coverage
- Add JSDoc to all public methods
- Document complex algorithms
- Add @example tags for utility functions

### 4.2 Create Integration Test Suite
- Test processor interactions
- Test state management across mode switches
- Test panel updates with document changes

## Implementation Strategy

### Phase 1: Critical File Splitting (Week 1)
1. Create feature branch `refactor/file-splitting`
2. Start with `listAutocompletion.ts` - highest impact
3. Ensure all tests pass after each extraction
4. Create unit tests for extracted modules

### Phase 2: Function Decomposition (Week 2)
1. Branch `refactor/function-decomposition`
2. Use Extract Method refactoring
3. Add unit tests for extracted functions
4. Update existing tests

### Phase 3: Pattern Extraction (Week 3)
1. Branch `refactor/pattern-consolidation`
2. Move all patterns to `ListPatterns` class
3. Update all references
4. Run full test suite

### Phase 4: Base Class Optimization (Week 4)
1. Branch `refactor/base-classes`
2. Create missing base classes
3. Migrate duplicated code
4. Verify no functionality changes

## Success Metrics
- [ ] No files exceed 400 lines
- [ ] No functions exceed 50 lines
- [ ] Code duplication reduced by 30%
- [ ] All patterns centralized in `ListPatterns`
- [ ] All styles use CSS classes from constants
- [ ] Test coverage maintained or improved
- [ ] No performance regressions

## Risk Mitigation
1. **Test Coverage First**: Write tests for existing behavior before refactoring
2. **Incremental Changes**: Small, reviewable PRs
3. **Feature Flags**: Use settings to toggle between old/new implementations during transition
4. **Parallel Development**: Refactoring branches separate from feature development
5. **Code Reviews**: Each refactoring PR reviewed for adherence to protocols

## Automation Opportunities
Create pre-commit hooks or CI checks for:
- File size validation (max 400 lines)
- Function size validation (max 50 lines)
- Pattern location check (must be in patterns.ts)
- Style manipulation check (no direct .style usage)
- JSDoc coverage reporting

## Next Steps
1. Review and approve this plan
2. Set up automated checks
3. Create refactoring branches
4. Begin with Priority 1 tasks
5. Weekly progress reviews

---

*This plan focuses on maintainability improvements without changing functionality. Each phase can be completed independently, allowing for continuous delivery alongside refactoring efforts.*