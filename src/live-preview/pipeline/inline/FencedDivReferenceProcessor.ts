import { Decoration } from '@codemirror/view';
import { isFencedDivExtrasEnabled } from '../../../shared/types/settingsTypes';
import { getRegionCursorPosition } from '../../../shared/utils/cursorUtils';
import { FencedDivReferenceWidget } from '../../widgets';
import { ContentRegion, InlineMatch, InlineProcessor, ProcessingContext } from '../types';

const PANDOC_CITATION_REFERENCE = /@([^\s,;)\]}]+)/g;
const TRAILING_REFERENCE_PUNCTUATION = /[.!?]+$/;

export class FencedDivReferenceProcessor implements InlineProcessor {
    name = 'fenced-div-reference';
    priority = 12;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph', 'normal', 'fenced-div-content']);

    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        const matches: InlineMatch[] = [];
        if (!isFencedDivExtrasEnabled(context.settings)) {
            return matches;
        }

        const labels: Map<string, unknown> = context.fencedDivLabels || new Map<string, unknown>();
        const regionCursorPos = getRegionCursorPosition(context, region);
        let match: RegExpExecArray | null;

        while ((match = PANDOC_CITATION_REFERENCE.exec(text)) !== null) {
            const label = this.resolveLabel(match[1], labels);
            if (!label) {
                continue;
            }

            const refStart = match.index;
            const refEnd = refStart + label.length + 1;
            const cursorInRef = regionCursorPos >= refStart && regionCursorPos <= refEnd;

            if (!cursorInRef) {
                matches.push({
                    from: refStart,
                    to: refEnd,
                    type: 'fenced-div-ref',
                    data: {
                        label,
                        rawText: text.slice(refStart, refEnd),
                        region
                    }
                });
            }
        }

        return matches;
    }

    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const label = typeof match.data.label === 'string' ? match.data.label : '';
        const reference = context.fencedDivLabels?.get(label);
        const region = match.data.region as ContentRegion | undefined;
        const absolutePosition = match.from + (region?.from || 0);

        return Decoration.replace({
            widget: new FencedDivReferenceWidget(
                reference?.referenceText || 'Div',
                label,
                reference?.content,
                context.view,
                absolutePosition,
                context.app,
                context.component
            ),
            inclusive: false
        });
    }

    private resolveLabel(rawLabel: string, labels: Map<string, unknown>): string | undefined {
        if (labels.has(rawLabel)) {
            return rawLabel;
        }

        const trimmedLabel = rawLabel.replace(TRAILING_REFERENCE_PUNCTUATION, '');
        if (trimmedLabel !== rawLabel && labels.has(trimmedLabel)) {
            return trimmedLabel;
        }

        return undefined;
    }
}
