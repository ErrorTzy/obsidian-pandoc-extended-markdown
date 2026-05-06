import { CSS_CLASSES } from '../../../core/constants';
import { ListPatterns } from '../../../shared/patterns';
import { InlineTextMatch, InlineTextProcessor, ReadingModeContext } from '../types';

abstract class BaseSuperSubInlineProcessor implements InlineTextProcessor {
    phase = 'inline' as const;
    abstract name: string;
    abstract priority: number;
    abstract type: 'superscript' | 'subscript';
    abstract tagName: 'sup' | 'sub';
    abstract className: string;
    abstract isEnabled(context: ReadingModeContext): boolean;

    findMatches(text: string): InlineTextMatch[] {
        const matches = this.type === 'superscript'
            ? ListPatterns.findSuperscripts(text)
            : ListPatterns.findSubscripts(text);

        return matches
            .filter(match => match.index !== undefined)
            .map(match => ({
                start: match.index!,
                end: match.index! + match[0].length,
                type: this.type,
                data: {
                    content: ListPatterns.unescapeSpaces(match[0].slice(1, -1))
                }
            }));
    }

    createReplacement(match: InlineTextMatch): Node {
        const element = document.createElement(this.tagName);
        element.className = this.className;
        element.textContent = getStringData(match, 'content');
        return element;
    }

    process(): void {
        return;
    }
}

export class SuperscriptInlineProcessor extends BaseSuperSubInlineProcessor {
    name = 'superscript';
    priority = 320;
    type = 'superscript' as const;
    tagName = 'sup' as const;
    className = CSS_CLASSES.SUPERSCRIPT;

    isEnabled(context: ReadingModeContext): boolean {
        return Boolean(context.config.enableSuperSubscripts) &&
            context.config.enableSuperscript !== false;
    }
}

export class SubscriptInlineProcessor extends BaseSuperSubInlineProcessor {
    name = 'subscript';
    priority = 330;
    type = 'subscript' as const;
    tagName = 'sub' as const;
    className = CSS_CLASSES.SUBSCRIPT;

    isEnabled(context: ReadingModeContext): boolean {
        return Boolean(context.config.enableSuperSubscripts) &&
            context.config.enableSubscript !== false;
    }
}

function getStringData(match: InlineTextMatch, key: string): string {
    const value = match.data?.[key];
    return typeof value === 'string' ? value : '';
}
