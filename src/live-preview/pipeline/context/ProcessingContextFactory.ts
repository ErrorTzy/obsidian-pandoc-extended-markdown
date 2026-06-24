// External libraries
import { EditorView } from '@codemirror/view';
import { App, Component } from 'obsidian';

// Types
import { CodeRegion } from '../../../shared/types/codeTypes';
import type { FencedDivReference } from '../../../shared/types/fencedDivTypes';
import type { ResolvedOrderedListItem } from '../../../shared/utils/orderedListMarkers';
import { PandocExtendedMarkdownSettings } from '../../../core/settings';
import { ProcessingContext, ProcessingRange } from '../types';
import { CustomLabelScanResult } from '../../scanners/customLabelScanner';

// Utils
import { PlaceholderContext } from '../../../shared/utils/placeholderProcessor';
import { isCustomLabelListsEnabled } from '../../../shared/types/settingsTypes';
import {
    detectInlineCodeAndMathRegionsInRange,
    detectMarkdownCodeBlockRegions
} from '../utils/codeDetection';

// Internal modules
import { PluginStateManager } from '../../../core/state/pluginStateManager';
import { scanCustomLabels } from '../../scanners/customLabelScanner';
import { scanFencedDivs } from '../../scanners/fencedDivScanner';
import { validateListBlocks } from '../../validators/listBlockValidator';
import { createExampleScanResult, scanExampleLabelsFromDoc } from './exampleLabelScan';
import { primeContextBeforeRange } from './contextPriming';
import { getProcessingRange } from './processingRange';
import { resolveOrderedListItemsByLine } from './orderedListContext';

export class ProcessingContextFactory {
    constructor(
        private readonly stateManager: PluginStateManager,
        private readonly app?: App,
        private readonly component?: Component
    ) {}

    create(view: EditorView, settings: PandocExtendedMarkdownSettings): ProcessingContext {
        const doc = view.state.doc;
        const docPath = this.getDocumentPath();
        const documentText = doc.toString();
        const documentLines = documentText.split('\n');
        const processingRange = getProcessingRange(view);
        const orderedListItemsByLine = resolveOrderedListItemsByLine(
            documentLines,
            settings,
            processingRange
        );
        const hasCodeFences = documentText.includes('```') || documentText.includes('~~~');
        const hasExampleSyntax = documentText.includes('(@');
        const hasCustomLabelSyntax = documentText.includes('{::');
        const hasFencedDivSyntax = documentText.includes(':::');
        const fullCodeBlockRegions = hasCodeFences
            ? detectMarkdownCodeBlockRegions(doc)
            : [];
        const renderCodeRegions = this.getRenderCodeRegions(view, processingRange);
        const codeRegions = mergeCodeRegions([
            ...fullCodeBlockRegions,
            ...renderCodeRegions
        ]);
        const exampleScanResult = hasExampleSyntax
            ? scanExampleLabelsFromDoc(doc, settings, fullCodeBlockRegions)
            : { ...createExampleScanResult(), duplicateLineNumbers: new Set<number>() };
        const placeholderContext = this.getPlaceholderContext(docPath);
        const customScanResult = this.getCustomScanResult(
            view,
            settings,
            placeholderContext,
            fullCodeBlockRegions,
            hasCustomLabelSyntax
        );
        const fencedDivLabels: ReturnType<typeof scanFencedDivs> = hasFencedDivSyntax
            ? scanFencedDivs(doc, settings, fullCodeBlockRegions)
            : new Map<string, FencedDivReference>();
        const invalidLines = settings.enforcePandocListSpacing ? validateListBlocks(doc) : new Set<number>();

        if (docPath && customScanResult.placeholderContext) {
            const counters = this.stateManager.getDocumentCounters(docPath);
            counters.placeholderContext = customScanResult.placeholderContext;
        }

        const context = this.buildContext({
            view,
            settings,
            documentLines,
            processingRange,
            orderedListItemsByLine,
            exampleScanResult,
            customScanResult,
            fencedDivLabels,
            invalidLines,
            codeRegions
        });
        primeContextBeforeRange(context, processingRange.startLine, codeRegions);
        return context;
    }

    private getDocumentPath(): string | null {
        const workspace = this.app?.workspace;
        const activeFile = workspace?.getActiveFile();
        return activeFile?.path || null;
    }

    private getPlaceholderContext(docPath: string | null): PlaceholderContext {
        return docPath
            ? this.stateManager.getDocumentCounters(docPath).placeholderContext
            : new PlaceholderContext();
    }

    private getCustomScanResult(
        view: EditorView,
        settings: PandocExtendedMarkdownSettings,
        placeholderContext: PlaceholderContext,
        codeRegions: CodeRegion[] | undefined,
        hasCustomLabelSyntax: boolean
    ): CustomLabelScanResult {
        if (!hasCustomLabelSyntax) {
            placeholderContext.reset();
            return createEmptyCustomScanResult(placeholderContext);
        }

        return isCustomLabelListsEnabled(settings)
            ? scanCustomLabels(view.state.doc, settings, placeholderContext, codeRegions)
            : createEmptyCustomScanResult(placeholderContext);
    }

    private getRenderCodeRegions(
        view: EditorView,
        processingRange: ProcessingRange
    ): CodeRegion[] {
        const doc = view.state.doc;
        const renderText = doc.sliceString(processingRange.renderFrom, processingRange.renderTo);
        return renderText.includes('`') || renderText.includes('$')
            ? detectInlineCodeAndMathRegionsInRange(
                doc,
                processingRange.renderFrom,
                processingRange.renderTo
            )
            : [];
    }

    private buildContext(args: {
        view: EditorView;
        settings: PandocExtendedMarkdownSettings;
        documentLines: string[];
        processingRange: ProcessingRange;
        orderedListItemsByLine: Map<number, ResolvedOrderedListItem>;
        exampleScanResult: ReturnType<typeof scanExampleLabelsFromDoc>;
        customScanResult: CustomLabelScanResult;
        fencedDivLabels: ReturnType<typeof scanFencedDivs>;
        invalidLines: Set<number>;
        codeRegions: CodeRegion[];
    }): ProcessingContext {
        return {
            document: args.view.state.doc,
            documentLines: args.documentLines,
            view: args.view,
            settings: args.settings,
            app: this.app,
            component: this.component,
            processingRange: args.processingRange,
            orderedListItemsByLine: args.orderedListItemsByLine,
            exampleLabels: args.exampleScanResult.exampleLabels,
            exampleContent: args.exampleScanResult.exampleContent,
            exampleLineNumbers: args.exampleScanResult.exampleLineNumbers,
            duplicateExampleLabels: args.exampleScanResult.duplicateLabels,
            duplicateExampleContent: args.exampleScanResult.duplicateLabelContent,
            duplicateExampleLineNumbers: args.exampleScanResult.duplicateLineNumbers,
            customLabels: args.customScanResult.customLabels,
            rawToProcessed: args.customScanResult.rawToProcessed,
            duplicateCustomLabels: args.customScanResult.duplicateLabels,
            duplicateCustomLineInfo: args.customScanResult.duplicateLineInfo,
            fencedDivLabels: args.fencedDivLabels,
            placeholderContext: args.customScanResult.placeholderContext,
            invalidLines: args.invalidLines,
            contentRegions: [],
            structuralDecorations: [],
            inlineDecorations: [],
            hashCounter: { value: 1 },
            definitionState: {
                lastWasItem: false,
                pendingBlankLine: false
            },
            fencedDivStack: [],
            fencedDivTypeCounters: new Map(),
            fencedDivCanOpenAtCurrentLine: true,
            codeRegions: args.codeRegions
        };
    }
}

function createEmptyCustomScanResult(placeholderContext: PlaceholderContext): CustomLabelScanResult {
    return {
        customLabels: new Map<string, string>(),
        rawToProcessed: new Map<string, string>(),
        duplicateLabels: new Set<string>(),
        placeholderContext
    };
}

function mergeCodeRegions(regions: CodeRegion[]): CodeRegion[] {
    if (regions.length <= 1) {
        return regions;
    }

    const sorted = [...regions].sort((left, right) =>
        left.from - right.from || left.to - right.to || left.type.localeCompare(right.type)
    );
    const merged: CodeRegion[] = [];

    for (const region of sorted) {
        const last = merged[merged.length - 1];
        if (last && last.type === region.type && region.from <= last.to) {
            last.to = Math.max(last.to, region.to);
            continue;
        }
        merged.push({ ...region });
    }

    return merged;
}
