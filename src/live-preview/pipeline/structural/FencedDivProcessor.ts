import { Decoration } from '@codemirror/view';
import { Line } from '@codemirror/state';
import { CSS_CLASSES } from '../../../core/constants';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import { FencedDivStackItem } from '../../../shared/types/fencedDivTypes';
import { ProcessingContext, StructuralResult } from '../types';
import { BaseStructuralProcessor } from './BaseStructuralProcessor';
import {
    getFencedDivCssClass,
    getFencedDivDisplayName,
    isFencedDivClosing,
    parseFencedDivOpening
} from './fencedDiv/parser';
import { FencedDivClosingWidget, FencedDivHeaderWidget } from '../../widgets';

export class FencedDivProcessor extends BaseStructuralProcessor {
    name = 'fenced-div';
    priority = 18;

    canProcess(line: Line, context: ProcessingContext): boolean {
        if (!isSyntaxFeatureEnabled(context.settings, 'enableFencedDivs')) {
            return false;
        }

        if (this.canOpenAtCurrentLine(context) && parseFencedDivOpening(line.text)) {
            return true;
        }

        const stack = context.fencedDivStack || [];
        return stack.length > 0;
    }

    process(line: Line, context: ProcessingContext): StructuralResult {
        const opening = this.canOpenAtCurrentLine(context)
            ? parseFencedDivOpening(line.text)
            : null;
        if (opening) {
            return this.processOpeningFence(line, context, {
                label: opening.id,
                classes: opening.classes,
                openingLine: line.number
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
        const displayName = getFencedDivDisplayName(stackItem.classes);
        const activeItem = {
            ...stackItem,
            displayName
        };

        context.fencedDivStack = context.fencedDivStack || [];
        context.fencedDivStack.push(activeItem);
        context.fencedDivBoundaryLine = line.number;

        const decorations = [
            this.createFenceLineDecoration(line, 'cm-pem-fenced-div-open', stackItem.classes),
            this.createOpeningMarkerDecoration(line, context, displayName, stackItem.label)
        ];

        return {
            decorations,
            skipFurtherProcessing: true
        };
    }

    private processClosingFence(line: Line, context: ProcessingContext): StructuralResult {
        const stack = context.fencedDivStack || [];
        const closingItem = stack.pop();
        context.fencedDivBoundaryLine = line.number;
        const decorations = [
            this.createFenceLineDecoration(line, 'cm-pem-fenced-div-close', closingItem?.classes || []),
            this.createClosingMarkerDecoration(line, context)
        ];

        return {
            decorations,
            skipFurtherProcessing: true
        };
    }

    private processContentLine(line: Line, context: ProcessingContext): StructuralResult {
        const activeItem = this.getActiveItem(context);
        const decorations = [
            this.createFenceLineDecoration(line, 'cm-pem-fenced-div-content', activeItem?.classes || [])
        ];

        return {
            decorations,
            skipFurtherProcessing: false
        };
    }

    private createOpeningMarkerDecoration(
        line: Line,
        context: ProcessingContext,
        displayName: string,
        label?: string
    ): { from: number; to: number; decoration: Decoration } {
        if (this.isCursorInMarker(line.from, line.to, context)) {
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
                widget: new FencedDivHeaderWidget(displayName, label, context.view, line.from),
                inclusive: false
            })
        };
    }

    private createClosingMarkerDecoration(
        line: Line,
        context: ProcessingContext
    ): { from: number; to: number; decoration: Decoration } {
        if (this.isCursorInMarker(line.from, line.to, context)) {
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
        classes: string[]
    ): { from: number; to: number; decoration: Decoration } {
        const primaryClass = getFencedDivCssClass(classes);
        const className = [
            CSS_CLASSES.FENCED_DIV_LINE,
            stateClass,
            primaryClass ? `cm-pem-fenced-div-${primaryClass}` : undefined
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

    private canOpenAtCurrentLine(context: ProcessingContext): boolean {
        return context.fencedDivCanOpenAtCurrentLine ?? true;
    }
}
