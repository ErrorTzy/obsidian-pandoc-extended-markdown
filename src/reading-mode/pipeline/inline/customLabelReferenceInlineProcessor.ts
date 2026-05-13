import { CSS_CLASSES } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';
import { InlineTextMatch, InlineTextProcessor, ReadingModeContext } from '../types';

export class CustomLabelReferenceInlineProcessor implements InlineTextProcessor {
    name = 'custom-label-reference';
    phase = 'inline' as const;
    priority = 340;

    isEnabled(context: ReadingModeContext): boolean {
        return Boolean(context.config.enableCustomLabelLists);
    }

    findMatches(text: string, node: Text, context: ReadingModeContext): InlineTextMatch[] {
        if (isAtCustomLabelListStart(text, node)) {
            return [];
        }

        const placeholderContext = context.counters.placeholderContext;
        return ListPatterns.findCustomLabelReferences(text)
            .filter(match => match.index !== undefined)
            .filter(match => placeholderContext.getProcessedLabel(match[1]) !== null)
            .map(match => ({
                start: match.index!,
                end: match.index! + match[0].length,
                type: 'custom-label-ref',
                data: {
                    rawLabel: match[1],
                    processedLabel: placeholderContext.getProcessedLabel(match[1])
                }
            }));
    }

    createReplacement(match: InlineTextMatch): Node {
        const processedLabel = getStringData(match, 'processedLabel');
        const span = document.createElement('span');
        span.className = CSS_CLASSES.CUSTOM_LABEL_REFERENCE_PROCESSED;
        span.setAttribute('data-custom-label-ref', processedLabel);
        span.textContent = `(${processedLabel})`;
        return span;
    }

    process(): void {
        return;
    }
}

function isAtCustomLabelListStart(text: string, node: Text): boolean {
    const parent = node.parentElement;
    if (!parent || parent.firstChild !== node) {
        return false;
    }

    return Boolean(text.match(ListPatterns.CUSTOM_LABEL_LIST_WITH_CONTENT));
}

function getStringData(match: InlineTextMatch, key: string): string {
    const value = match.data?.[key];
    return typeof value === 'string' ? value : '';
}
