import { setTooltip } from 'obsidian';

import { CSS_CLASSES, DECORATION_STYLES } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';
import { InlineTextMatch, InlineTextProcessor, ReadingModeContext } from '../types';

export class ExampleReferenceInlineProcessor implements InlineTextProcessor {
    name = 'example-reference';
    phase = 'inline' as const;
    priority = 310;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableExampleLists !== false;
    }

    findMatches(text: string, _node: Text, context: ReadingModeContext): InlineTextMatch[] {
        return ListPatterns.findExampleReferences(text)
            .filter(match => match.index !== undefined)
            .filter(match => context.renderContext.getExampleNumber?.(match[1]) !== undefined)
            .map(match => ({
                start: match.index!,
                end: match.index! + match[0].length,
                type: 'example-ref',
                data: {
                    label: match[1]
                }
            }));
    }

    createReplacement(match: InlineTextMatch, context: ReadingModeContext): Node {
        const label = getStringData(match, 'label');
        const number = context.renderContext.getExampleNumber?.(label);
        const span = document.createElement('span');
        span.className = CSS_CLASSES.EXAMPLE_REF;
        span.textContent = number !== undefined ? `(${number})` : `(@${label})`;

        const tooltipText = context.renderContext.getExampleContent?.(label);
        if (tooltipText) {
            setTooltip(span, tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
        }

        return span;
    }

    process(): void {
        return;
    }
}

function getStringData(match: InlineTextMatch, key: string): string {
    const value = match.data?.[key];
    return typeof value === 'string' ? value : '';
}
