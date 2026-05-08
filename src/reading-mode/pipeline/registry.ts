import { pluginStateManager } from '../../core/state/pluginStateManager';

import { ReadingModePipeline } from './ReadingModePipeline';
import { CustomLabelReferenceInlineProcessor } from './inline/customLabelReferenceInlineProcessor';
import { ExampleReferenceInlineProcessor } from './inline/exampleReferenceInlineProcessor';
import {
    SubscriptInlineProcessor,
    SuperscriptInlineProcessor
} from './inline/superSubInlineProcessors';
import { CustomLabelListProcessor } from './processors/customLabelListProcessor';
import { DefinitionListNormalizationProcessor } from './processors/definitionListNormalizationProcessor';
import { ExtendedListBlockProcessor } from './processors/extendedListBlockProcessor';
import { FencedDivBlockProcessor } from './processors/fencedDivBlockProcessor';
import { InlineTextEngineProcessor } from './processors/inlineTextProcessor';
import { UnorderedListMarkerProcessor } from './processors/unorderedListMarkerProcessor';
import { ReadingModeContext } from './types';

export function createDefaultReadingModePipeline(): ReadingModePipeline {
    const pipeline = new ReadingModePipeline();
    const inlineProcessors = [
        new ExampleReferenceInlineProcessor(),
        // FencedDivReferenceInlineProcessor is intentionally not registered yet:
        // Pandoc treats @id as citation syntax, not a built-in div cross-reference.
        new SuperscriptInlineProcessor(),
        new SubscriptInlineProcessor(),
        new CustomLabelReferenceInlineProcessor()
    ];

    pipeline.registerProcessor(new UnorderedListMarkerProcessor());
    pipeline.registerProcessor(new DefinitionListNormalizationProcessor());
    pipeline.registerProcessor(new FencedDivBlockProcessor());
    pipeline.registerProcessor(new ExtendedListBlockProcessor());
    pipeline.registerProcessor(new InlineTextEngineProcessor(inlineProcessors));
    pipeline.registerProcessor(new CustomLabelListProcessor());

    return pipeline;
}

export function createReadingModeContext(
    element: HTMLElement,
    postProcessorContext: ReadingModeContext['postProcessorContext'],
    config: ReadingModeContext['config'],
    app?: ReadingModeContext['app']
): ReadingModeContext {
    const sourcePath = postProcessorContext.sourcePath || 'unknown';
    const section = element.closest<HTMLElement>('.markdown-preview-section');
    const sectionInfo = postProcessorContext.getSectionInfo?.(element) ??
        (section ? postProcessorContext.getSectionInfo?.(section) : null) ??
        null;
    const counters = pluginStateManager.getDocumentCounters(sourcePath);

    return {
        element,
        postProcessorContext,
        section,
        sectionInfo,
        sourcePath,
        config,
        app,
        counters,
        validationLines: config.strictPandocMode && sectionInfo?.text
            ? sectionInfo.text.split('\n')
            : [],
        renderContext: {
            strictLineBreaks: config.strictLineBreaks,
            getExampleNumber: (label: string) =>
                pluginStateManager.getLabeledExampleNumber(sourcePath, label),
            getExampleContent: (label: string) =>
                pluginStateManager.getLabeledExampleContent(sourcePath, label)
        }
    };
}
