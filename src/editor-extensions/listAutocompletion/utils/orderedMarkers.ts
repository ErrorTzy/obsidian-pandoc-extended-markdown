import {
    PandocExtendedMarkdownSettings,
    isSyntaxFeatureEnabled
} from '../../../shared/types/settingsTypes';
import {
    formatOrderedListMarker,
    getIndentColumns,
    parseOrderedListMarker,
    resolveOrderedListMarkerStyle
} from '../../../shared/utils/orderedListMarkers';

export interface OrderedMarkerIndentContext {
    lines: string[];
    currentLineIndex: number;
    currentIndent: string;
    targetIndent: string;
    direction: 'indent' | 'outdent';
}

export function getOrderedMarkerForIndent(
    marker: string,
    settings: Partial<PandocExtendedMarkdownSettings>,
    context?: OrderedMarkerIndentContext
): string {
    const parsed = parseOrderedListMarker(`${context?.currentIndent ?? ''}${marker} `);
    if (!parsed) {
        return marker;
    }

    if (!context || !isSyntaxFeatureEnabled(settings, 'enableOrderedListMarkerCycling')) {
        return marker;
    }

    const style = resolveOrderedListMarkerStyle({
        lines: context.lines,
        currentLineIndex: context.currentLineIndex,
        currentIndentColumns: getIndentColumns(context.currentIndent),
        targetIndentColumns: getIndentColumns(context.targetIndent),
        currentStyle: parsed.style,
        direction: context.direction,
        settings
    });

    return formatOrderedListMarker(style, 1);
}
