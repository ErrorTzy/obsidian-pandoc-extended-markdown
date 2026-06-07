import { pluginStateManager } from '../../core/state/pluginStateManager';
import { extractFencedDivs } from '../../shared/extractors/fencedDivExtractor';

import { ReadingModePipeline } from './ReadingModePipeline';
import { CustomLabelReferenceInlineProcessor } from './inline/customLabelReferenceInlineProcessor';
import { ExampleReferenceInlineProcessor } from './inline/exampleReferenceInlineProcessor';
import { FencedDivReferenceInlineProcessor } from './inline/fencedDivReferenceInlineProcessor';
import {
    SubscriptInlineProcessor,
    SuperscriptInlineProcessor
} from './inline/superSubInlineProcessors';
import { CustomLabelListProcessor } from './processors/customLabelListProcessor';
import { DefinitionListNormalizationProcessor } from './processors/definitionListNormalizationProcessor';
import { ExtendedListBlockProcessor } from './processors/extendedListBlockProcessor';
import { FencedDivBlockProcessor } from './processors/fencedDivBlockProcessor';
import { InlineTextEngineProcessor } from './processors/inlineTextProcessor';
import { NativeListSpacingProcessor } from './processors/nativeListSpacingProcessor';
import { UnorderedListMarkerProcessor } from './processors/unorderedListMarkerProcessor';
import { ReadingModeContext } from './types';

export function createDefaultReadingModePipeline(): ReadingModePipeline {
    const pipeline = new ReadingModePipeline();
    const inlineProcessors = [
        new ExampleReferenceInlineProcessor(),
        new FencedDivReferenceInlineProcessor(),
        new SuperscriptInlineProcessor(),
        new SubscriptInlineProcessor(),
        new CustomLabelReferenceInlineProcessor()
    ];

    pipeline.registerProcessor(new UnorderedListMarkerProcessor());
    pipeline.registerProcessor(new NativeListSpacingProcessor());
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
    hydrateFencedDivLabelsFromSource(sectionInfo?.text || '', config, counters.fencedDivLabels);

    return {
        element,
        postProcessorContext,
        section,
        sectionInfo,
        sourcePath,
        config,
        app,
        counters,
        validationLines: config.enforcePandocListSpacing && sectionInfo?.text
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

function hydrateFencedDivLabelsFromSource(
    source: string,
    config: ReadingModeContext['config'],
    labels: ReadingModeContext['counters']['fencedDivLabels']
): void {
    if (!source || config.enableFencedDivs === false || config.enableFencedDivExtras === false) {
        return;
    }

    const items = extractFencedDivs(source, config);

    for (const item of items) {
        if (!item.label || labels.has(item.label)) {
            continue;
        }

        labels.set(item.label, {
            label: item.label,
            title: item.title,
            titleTemplate: item.title,
            displayName: item.referenceText,
            typeLabel: item.typeLabel,
            typeKey: item.typeKey,
            number: item.number,
            numberParts: item.numberParts,
            numberingEnabled: item.numberingEnabled,
            referenceText: item.referenceText,
            blockTitleText: item.blockTitleText,
            lineNumber: item.lineNumber + 1,
            classes: item.classes,
            content: item.content
        });
    }
}
