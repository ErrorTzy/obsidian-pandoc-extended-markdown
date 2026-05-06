import { setTooltip } from 'obsidian';

import { CSS_CLASSES, DECORATION_STYLES } from '../../../core/constants';
import { InlineTextMatch, InlineTextProcessor, ReadingModeContext } from '../types';

const PANDOC_CITATION_REFERENCE = /@([^\s,;)\]}]+)/g;
const TRAILING_REFERENCE_PUNCTUATION = /[.!?]+$/;

export class FencedDivReferenceInlineProcessor implements InlineTextProcessor {
    name = 'fenced-div-reference';
    phase = 'inline' as const;
    priority = 315;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableFencedDivs !== false;
    }

    findMatches(text: string, _node: Text, context: ReadingModeContext): InlineTextMatch[] {
        const matches: InlineTextMatch[] = [];
        let match: RegExpExecArray | null;
        const labels = context.counters.fencedDivLabels;

        PANDOC_CITATION_REFERENCE.lastIndex = 0;
        while ((match = PANDOC_CITATION_REFERENCE.exec(text)) !== null) {
            const label = resolveLabel(match[1], labels);
            if (!label) {
                continue;
            }

            matches.push({
                start: match.index,
                end: match.index + label.length + 1,
                type: 'fenced-div-ref',
                data: { label }
            });
        }

        return matches;
    }

    createReplacement(match: InlineTextMatch, context: ReadingModeContext): Node {
        const label = getStringData(match, 'label');
        const reference = context.counters.fencedDivLabels.get(label);
        const span = document.createElement('span');
        span.className = CSS_CLASSES.FENCED_DIV_REFERENCE;
        span.dataset.pandocDivRef = label;
        span.textContent = reference?.displayName || 'Div';

        if (reference?.content) {
            setTooltip(span, reference.content, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        }

        return span;
    }

    process(): void {
        return;
    }
}

function resolveLabel(
    rawLabel: string | undefined,
    labels: ReadingModeContext['counters']['fencedDivLabels']
): string | undefined {
    if (!rawLabel) {
        return undefined;
    }

    if (labels.has(rawLabel)) {
        return rawLabel;
    }

    const trimmedLabel = rawLabel.replace(TRAILING_REFERENCE_PUNCTUATION, '');
    if (trimmedLabel !== rawLabel && labels.has(trimmedLabel)) {
        return trimmedLabel;
    }

    return undefined;
}

function getStringData(match: InlineTextMatch, key: string): string {
    const value = match.data?.[key];
    return typeof value === 'string' ? value : '';
}
