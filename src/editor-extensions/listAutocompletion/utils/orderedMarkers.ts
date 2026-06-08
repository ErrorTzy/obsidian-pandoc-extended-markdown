import {
    PandocExtendedMarkdownSettings,
    isSyntaxFeatureEnabled
} from '../../../shared/types/settingsTypes';
import {
    getIndentColumns,
    parseOrderedListMarker,
    resolveOrderedMarkerForTarget
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

    const resolvedMarker = resolveOrderedMarkerForTarget({
        lines: context.lines,
        currentLineIndex: context.currentLineIndex,
        currentIndentColumns: getIndentColumns(context.currentIndent),
        targetIndentColumns: getIndentColumns(context.targetIndent),
        currentStyle: parsed.style,
        direction: context.direction,
        settings
    });

    return resolvedMarker.marker;
}
