import { pluginStateManager } from '../../../core/state/pluginStateManager';
import { processCustomLabelLists } from '../../parsers/customLabelListParser';
import { BlockDomProcessor, ReadingModeContext } from '../types';

export class CustomLabelListProcessor implements BlockDomProcessor {
    name = 'custom-label-lists';
    phase = 'block' as const;
    priority = 130;

    isEnabled(context: ReadingModeContext): boolean {
        return !context.config.strictPandocMode && Boolean(context.config.enableCustomLabelLists);
    }

    process(context: ReadingModeContext): void {
        const counters = pluginStateManager.getDocumentCounters(context.sourcePath);
        processCustomLabelLists(
            context.element,
            context.postProcessorContext,
            counters.placeholderContext
        );
    }
}
