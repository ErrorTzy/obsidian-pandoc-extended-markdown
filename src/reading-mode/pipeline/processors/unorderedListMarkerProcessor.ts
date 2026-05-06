import {
    applyUnorderedListMarkerClasses,
    clearUnorderedListMarkerClasses
} from '../../parsers/unorderedListMarkerParser';
import { BlockDomProcessor, ReadingModeContext } from '../types';

export class UnorderedListMarkerProcessor implements BlockDomProcessor {
    name = 'unordered-list-marker-classes';
    phase = 'block' as const;
    priority = 20;

    process(context: ReadingModeContext): void {
        if (context.config.enableUnorderedListMarkerStyles !== false) {
            applyUnorderedListMarkerClasses(context.element, context.postProcessorContext);
            return;
        }

        clearUnorderedListMarkerClasses(context.element);
    }
}
