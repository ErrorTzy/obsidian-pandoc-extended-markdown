import { Decoration } from '@codemirror/view';
import { ContentRegion, InlineMatch, InlineProcessor, ProcessingContext } from '../types';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import { getRegionCursorPosition } from '../../../shared/utils/cursorUtils';
import { SmartDashWidget } from '../../widgets';

const DASH_RUN_PATTERN = /-{2,}/g;

/**
 * Processes Pandoc smart dash syntax in Live Preview.
 */
export class SmartDashProcessor implements InlineProcessor {
    name = 'smart-dash';
    priority = 35;
    supportedRegions = new Set(['list-content', 'definition-content', 'paragraph', 'normal', 'fenced-div-content']);

    findMatches(text: string, region: ContentRegion, context: ProcessingContext): InlineMatch[] {
        const matches: InlineMatch[] = [];

        if (!isSyntaxFeatureEnabled(context.settings, 'enableSmartDashes')) {
            return matches;
        }

        const regionCursorPos = getRegionCursorPosition(context, region);

        let match: RegExpExecArray | null;
        while ((match = DASH_RUN_PATTERN.exec(text)) !== null) {
            const dashStart = match.index;
            const dashEnd = dashStart + match[0].length;
            const cursorInDash = regionCursorPos >= dashStart && regionCursorPos <= dashEnd;

            if (!cursorInDash && !isEscaped(text, dashStart)) {
                matches.push({
                    from: dashStart,
                    to: dashEnd,
                    type: 'smart-dash',
                    data: {
                        renderedText: renderPandocDashRun(match[0]),
                        rawText: match[0],
                        absoluteFrom: region.from + dashStart
                    }
                });
            }
        }

        return matches;
    }

    createDecoration(match: InlineMatch, context: ProcessingContext): Decoration {
        const { renderedText, absoluteFrom } = match.data;

        return Decoration.replace({
            widget: new SmartDashWidget(String(renderedText), context.view, Number(absoluteFrom)),
            inclusive: false
        });
    }
}

export function renderPandocDashRun(dashRun: string): string {
    let remaining = dashRun.length;
    let rendered = '';

    while (remaining >= 3) {
        rendered += '\u2014';
        remaining -= 3;
    }

    if (remaining === 2) {
        rendered += '\u2013';
    } else if (remaining === 1) {
        rendered += '-';
    }

    return rendered;
}

function isEscaped(text: string, index: number): boolean {
    let slashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) {
        slashCount++;
    }
    return slashCount % 2 === 1;
}
