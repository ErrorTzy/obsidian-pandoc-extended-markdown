import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { CSS_CLASSES } from '../../../core/constants';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import { FencedDivStackItem } from '../../../shared/types/fencedDivTypes';
import { ProcessingContext, StructuralResult } from '../types';
import { BaseStructuralProcessor } from './BaseStructuralProcessor';
import {
    getFencedDivCssClasses,
    isFencedDivClosing,
    parseFencedDivOpening
} from './fencedDiv/parser';
import { FencedDivClosingWidget, FencedDivHeaderWidget } from '../../widgets';
import {
    createFencedDivReferenceMetadata,
    getFencedDivTitle
} from '../../../shared/utils/fencedDivReferenceMetadata';

export class FencedDivProcessor extends BaseStructuralProcessor {
    name = 'fenced-div';
    priority = 18;
    private readonly maxDepthClass = 6;

    canProcess(line: Line, context: ProcessingContext): boolean {
        if (!isSyntaxFeatureEnabled(context.settings, 'enableFencedDivs')) {
            return false;
        }

        if (this.canOpenAtCurrentLine(context) && parseFencedDivOpening(line.text, context.settings)) {
            return true;
        }

        const stack = context.fencedDivStack || [];
        return stack.length > 0;
    }

    process(line: Line, context: ProcessingContext): StructuralResult {
        const opening = this.canOpenAtCurrentLine(context)
            ? parseFencedDivOpening(line.text, context.settings)
            : null;
        if (opening) {
            context.fencedDivTypeCounters = context.fencedDivTypeCounters || new Map();
            const renderExtendedTitle = !context.settings.strictPandocMode;
            const title = renderExtendedTitle ? getFencedDivTitle(opening) : '';
            const metadata = renderExtendedTitle && (opening.id || title || opening.classes.length > 0)
                ? createFencedDivReferenceMetadata(
                    title,
                    opening.classes,
                    context.fencedDivTypeCounters
                )
                : undefined;
            const reference = opening.id
                ? context.fencedDivLabels?.get(opening.id)
                : undefined;
            return this.processOpeningFence(line, context, {
                label: opening.id,
                classes: opening.classes,
                openingLine: line.number,
                displayName: renderExtendedTitle
                    ? reference?.blockTitleText ?? metadata?.blockTitleText
                    : undefined
            });
        }

        if (isFencedDivClosing(line.text) && (context.fencedDivStack || []).length > 0) {
            return this.processClosingFence(line, context);
        }

        return this.processContentLine(line, context);
    }

    private processOpeningFence(
        line: Line,
        context: ProcessingContext,
        stackItem: FencedDivStackItem
    ): StructuralResult {
        context.fencedDivStack = context.fencedDivStack || [];
        context.fencedDivStack.push(stackItem);
        context.fencedDivBoundaryLine = line.number;

        const renderDepth = context.fencedDivStack.length;
        const decorations = [
            this.createFenceLineDecoration(line, 'cm-pem-fenced-div-open', stackItem.classes, renderDepth),
            this.createOpeningMarkerDecoration(line, context, stackItem.label, stackItem.displayName || '')
        ];

        return {
            decorations,
            skipFurtherProcessing: true
        };
    }

    private processClosingFence(line: Line, context: ProcessingContext): StructuralResult {
        const stack = context.fencedDivStack || [];
        const renderDepth = stack.length;
        const closingItem = stack.pop();
        context.fencedDivBoundaryLine = line.number;
        const decorations = [
            this.createFenceLineDecoration(line, 'cm-pem-fenced-div-close', closingItem?.classes || [], renderDepth),
            this.createClosingMarkerDecoration(line, context)
        ];

        return {
            decorations,
            skipFurtherProcessing: true
        };
    }

    private processContentLine(line: Line, context: ProcessingContext): StructuralResult {
        const activeItem = this.getActiveItem(context);
        const renderDepth = (context.fencedDivStack || []).length;
        const stateClass = this.isBeforeClosingFence(line, context)
            ? 'cm-pem-fenced-div-content cm-pem-fenced-div-content-end'
            : 'cm-pem-fenced-div-content';
        const decorations = [
            this.createFenceLineDecoration(line, stateClass, activeItem?.classes || [], renderDepth)
        ];

        return {
            decorations,
            skipFurtherProcessing: false
        };
    }

    private createOpeningMarkerDecoration(
        line: Line,
        context: ProcessingContext,
        label: string | undefined,
        titleText: string
    ): { from: number; to: number; decoration: Decoration } {
        if (this.isCursorOnFenceLine(line, context)) {
            return {
                from: line.from,
                to: line.to,
                decoration: Decoration.mark({
                    class: 'cm-pem-fenced-div-marker-cursor'
                })
            };
        }

        return {
            from: line.from,
            to: line.to,
            decoration: Decoration.replace({
                widget: new FencedDivHeaderWidget(
                    label,
                    titleText,
                    context.view,
                    line.from
                ),
                inclusive: false
            })
        };
    }

    private createClosingMarkerDecoration(
        line: Line,
        context: ProcessingContext
    ): { from: number; to: number; decoration: Decoration } {
        if (this.isCursorOnFenceLine(line, context)) {
            return {
                from: line.from,
                to: line.to,
                decoration: Decoration.mark({
                    class: 'cm-pem-fenced-div-marker-cursor'
                })
            };
        }

        return {
            from: line.from,
            to: line.to,
            decoration: Decoration.replace({
                widget: new FencedDivClosingWidget(context.view, line.from),
                inclusive: false
            })
        };
    }

    private createFenceLineDecoration(
        line: Line,
        stateClass: string,
        classes: string[],
        renderDepth: number
    ): { from: number; to: number; decoration: Decoration } {
        const semanticClasses = getFencedDivCssClasses(classes)
            .map(className => `cm-pem-fenced-div-${className}`);
        const depthClass = Math.min(renderDepth, this.maxDepthClass);
        const className = [
            CSS_CLASSES.FENCED_DIV_LINE,
            stateClass,
            renderDepth > 1 ? 'cm-pem-fenced-div-inner' : undefined,
            renderDepth > 1 ? `cm-pem-fenced-div-depth-${depthClass}` : undefined,
            ...semanticClasses
        ].filter(Boolean).join(' ');

        return {
            from: line.from,
            to: line.from,
            decoration: Decoration.line({ class: className })
        };
    }

    private getActiveItem(context: ProcessingContext): FencedDivStackItem | undefined {
        const stack = context.fencedDivStack || [];
        return stack[stack.length - 1];
    }

    private isCursorOnFenceLine(line: Line, context: ProcessingContext): boolean {
        const cursorPos = context.view.state.selection?.main?.head;
        return cursorPos !== undefined && cursorPos >= line.from && cursorPos <= line.to;
    }

    private canOpenAtCurrentLine(context: ProcessingContext): boolean {
        return context.fencedDivCanOpenAtCurrentLine ?? true;
    }

    private isBeforeClosingFence(line: Line, context: ProcessingContext): boolean {
        if (line.number >= context.document.lines) {
            return false;
        }

        return isFencedDivClosing(context.document.line(line.number + 1).text);
    }
}
