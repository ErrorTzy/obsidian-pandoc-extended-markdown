import { Decoration } from '@codemirror/view';
import { ContentRegion, InlineMatch, InlineProcessor, ProcessingContext } from '../types';
import { isSyntaxFeatureEnabled } from '../../../shared/types/settingsTypes';
import { findSmartDashMatches, renderPandocDashRun } from '../../../shared/utils/smartDash';
import { getRegionCursorPosition } from '../../../shared/utils/cursorUtils';
import { SmartDashWidget } from '../../widgets';

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

        for (const match of findSmartDashMatches(text)) {
            const dashStart = match.start;
            const dashEnd = match.end;
            const cursorInDash = regionCursorPos >= dashStart && regionCursorPos <= dashEnd;

            if (!cursorInDash) {
                matches.push({
                    from: dashStart,
                    to: dashEnd,
                    type: 'smart-dash',
                    data: {
                        renderedText: match.renderedText,
                        rawText: match.rawText,
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

export { renderPandocDashRun };
