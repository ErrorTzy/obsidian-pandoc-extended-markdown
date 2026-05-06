import { MarkdownPostProcessorContext } from 'obsidian';

import { ProcessorConfig } from '../shared/types/processorConfig';

import {
    createDefaultReadingModePipeline,
    createReadingModeContext
} from './pipeline/registry';
import { ObsidianAppLike } from './pipeline/types';

export function processReadingMode(
    element: HTMLElement, 
    context: MarkdownPostProcessorContext, 
    config: ProcessorConfig,
    app?: ObsidianAppLike
): void {
    const readingModeContext = createReadingModeContext(element, context, config, app);
    createDefaultReadingModePipeline().process(readingModeContext);
}
