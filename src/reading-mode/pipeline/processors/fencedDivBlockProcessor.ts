import { scheduleFencedDivProcessing } from '../../features/fenced-divs/processor';
import { readFullSourceText } from '../sourceText';
import { BlockDomProcessor, ReadingModeContext } from '../types';

export class FencedDivBlockProcessor implements BlockDomProcessor {
    name = 'fenced-div-blocks';
    phase = 'block' as const;
    priority = 60;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableFencedDivs !== false;
    }

    process(context: ReadingModeContext): void {
        if (context.app) {
            void scheduleFencedDivProcessingWithFullSource(context);
            return;
        }

        scheduleFencedDivProcessing(
            context.element,
            context.sourcePath,
            context.config,
            context.sectionInfo?.text
        );
    }
}

async function scheduleFencedDivProcessingWithFullSource(
    context: ReadingModeContext
): Promise<void> {
    const fullSourceText = await readFullSourceText(context.sourcePath, context.app);
    const processingRoot = fullSourceText
        ? context.element.closest<HTMLElement>('.markdown-preview-view') ?? context.element
        : context.element;
    const sourceText = fullSourceText ?? context.sectionInfo?.text;

    scheduleFencedDivProcessing(
        processingRoot,
        context.sourcePath,
        context.config,
        sourceText
    );
}
