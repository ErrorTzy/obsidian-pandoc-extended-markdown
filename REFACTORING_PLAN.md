# Refactoring Plan: Two-Phase Processing Pipeline

## Overview
This document outlines the specific steps to refactor the current codebase to implement the proposed two-phase processing pipeline architecture.

## Current State Analysis

### Files That Need Modification
1. **Core orchestrator**: `src/decorations/pandocExtendedMarkdownExtension.ts`
2. **List processors**: `src/decorations/processors/listProcessors.ts`
3. **Custom label processor**: `src/decorations/processors/customLabelProcessor.ts`
4. **Definition processor**: `src/decorations/processors/definitionProcessor.ts`
5. **Inline format processor**: `src/decorations/processors/inlineFormatProcessor.ts`

### Code Duplication Locations
Current duplication of inline processing logic:
- `listProcessors.ts:348-366` (hash lists)
- `listProcessors.ts:463-481` (fancy lists)
- `listProcessors.ts:578-596` (example lists)
- `customLabelProcessor.ts:213-245` (custom label lists)

## Step-by-Step Refactoring Plan

### Step 1: Create Core Infrastructure (Non-Breaking)

#### 1.1 Create new type definitions
Create `src/decorations/pipeline/types.ts`:
```typescript
export interface ContentRegion {
    from: number;
    to: number;
    type: 'list-content' | 'definition-content' | 'paragraph' | 'normal';
    parentStructure?: string;
    metadata?: any;
}

export interface ProcessingContext {
    // All existing context data plus:
    contentRegions: ContentRegion[];
    structuralDecorations: Array<{from: number, to: number, decoration: Decoration}>;
    inlineDecorations: Array<{from: number, to: number, decoration: Decoration}>;
}

export interface StructuralProcessor {
    name: string;
    priority: number;
    canProcess(line: any, context: ProcessingContext): boolean;
    process(line: any, context: ProcessingContext): StructuralResult;
}

export interface InlineProcessor {
    name: string;
    priority: number;
    supportedRegions: Set<string>;
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[];
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration;
}
```

#### 1.2 Create Pipeline Orchestrator
Create `src/decorations/pipeline/ProcessingPipeline.ts`:
```typescript
export class ProcessingPipeline {
    private structuralProcessors: StructuralProcessor[] = [];
    private inlineProcessors: InlineProcessor[] = [];
    
    // Implementation as designed
}
```

### Step 2: Create Adapter Layer (Non-Breaking)

#### 2.1 Create processor adapters
Create adapters that wrap existing processors to work with new interface:

`src/decorations/pipeline/adapters/HashListAdapter.ts`:
```typescript
import { processHashList } from '../../processors/listProcessors';

export class HashListAdapter implements StructuralProcessor {
    name = 'hash-list';
    priority = 10;
    
    canProcess(line: any, context: ProcessingContext): boolean {
        return ListPatterns.isHashList(line.text);
    }
    
    process(line: any, context: ProcessingContext): StructuralResult {
        // Call existing processor but extract only structural decorations
        const decorations = processHashList(/* existing context */);
        
        // Identify content region
        const contentRegion = this.extractContentRegion(line, decorations);
        
        // Return only structural decorations
        return {
            decorations: this.filterStructuralDecorations(decorations),
            contentRegion,
            skipFurtherProcessing: true
        };
    }
}
```

### Step 3: Migrate Inline Processors (Non-Breaking)

#### 3.1 Extract inline processors
Create new inline processor implementations:

`src/decorations/pipeline/inline/ExampleReferenceProcessor.ts`:
```typescript
export class ExampleReferenceProcessor implements InlineProcessor {
    name = 'example-reference';
    priority = 10;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph']);
    
    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        // Extract logic from processExampleReferences
    }
    
    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        // Create widget decoration
    }
}
```

### Step 4: Parallel Implementation (Testing Phase)

#### 4.1 Add feature flag
In `src/settings.ts`:
```typescript
export interface PandocExtendedMarkdownSettings {
    // ... existing settings
    useNewPipeline: boolean; // Default: false
}
```

#### 4.2 Conditional processing
In `pandocExtendedMarkdownExtension.ts`:
```typescript
buildDecorations(view: EditorView): DecorationSet {
    const settings = getSettings();
    
    if (settings.useNewPipeline) {
        return this.buildDecorationsWithPipeline(view);
    } else {
        return this.buildDecorationsLegacy(view);
    }
}
```

### Step 5: Incremental Migration

#### 5.1 Migration order (by complexity)
1. **Superscript/Subscript** (simplest, no state)
2. **Example references** (simple state lookup)
3. **Hash lists** (simple counter)
4. **Fancy lists** (pattern variations)
5. **Example lists** (label tracking)
6. **Definition lists** (multi-line handling)
7. **Custom label lists** (most complex, placeholders)

#### 5.2 Testing strategy for each migration
1. Create comprehensive test suite for processor
2. Implement new processor
3. Run parallel validation (compare outputs)
4. Enable in feature flag
5. Monitor for issues
6. Remove old implementation

### Step 6: Remove Old Code

#### 6.1 Cleanup checklist
- [ ] Remove inline processing from `listProcessors.ts`
- [ ] Remove inline processing from `customLabelProcessor.ts`
- [ ] Remove inline processing from `definitionProcessor.ts`
- [ ] Delete old processor files
- [ ] Remove feature flag
- [ ] Update documentation

## Risk Assessment & Mitigation

### Risks
1. **Breaking existing functionality**: Mitigated by parallel implementation
2. **Performance regression**: Mitigated by benchmarking
3. **Edge case bugs**: Mitigated by comprehensive testing
4. **User confusion**: Mitigated by gradual rollout

### Rollback Plan
1. Keep old implementation during migration
2. Feature flag allows instant rollback
3. Version control for each migration step
4. Automated tests to detect regressions

## Testing Strategy

### Unit Tests
Create tests for each new component:
```typescript
// tests/pipeline/ProcessingPipeline.spec.ts
describe('ProcessingPipeline', () => {
    it('should process structural elements first', () => {
        // Test phase 1
    });
    
    it('should process inline elements in content regions', () => {
        // Test phase 2
    });
    
    it('should respect processor priorities', () => {
        // Test ordering
    });
});
```

## Success Metrics

1. **Code reduction**: >30% less code duplication
2. **Performance**: No regression (±10%)
3. **Test coverage**: >90% for new code
4. **Bug reduction**: Fewer cross-reference related issues
5. **Developer experience**: Easier to add new features

## Notes for Implementation

### Preserving Existing Behavior
When migrating, ensure these behaviors are preserved:
1. Cursor-aware rendering (hiding decorations when cursor is inside)
2. Strict mode validation
3. Line-by-line processing order
4. State management across modes

### Extension Points
Design for future extensions:
1. Plugin system for custom processors
2. Configuration for processor priorities
3. Dynamic processor registration
4. Custom content region types

### Documentation Updates Needed
1. Update ARCHITECTURE.md with new pipeline
2. Create developer guide for adding processors
3. Update inline comments in code
4. Create migration guide for plugin developers