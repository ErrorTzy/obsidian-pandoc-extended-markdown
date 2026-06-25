import { CSS_CLASSES } from '../../../core/constants';
import { findSmartDashMatches } from '../../../shared/utils/smartDash';
import { InlineTextMatch, InlineTextProcessor, ReadingModeContext } from '../types';

export class SmartDashInlineProcessor implements InlineTextProcessor {
    name = 'smart-dash';
    phase = 'inline' as const;
    priority = 335;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableSmartDashes !== false;
    }

    findMatches(text: string): InlineTextMatch[] {
        return findSmartDashMatches(text).map(match => ({
            start: match.start,
            end: match.end,
            type: 'smart-dash',
            data: {
                renderedText: match.renderedText,
                rawText: match.rawText
            }
        }));
    }

    createReplacement(match: InlineTextMatch): Node {
        const span = document.createElement('span');
        span.className = CSS_CLASSES.SMART_DASH;
        span.textContent = getStringData(match, 'renderedText');
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
