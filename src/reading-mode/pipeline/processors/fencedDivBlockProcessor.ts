import { scheduleFencedDivProcessing } from '../../features/fenced-divs/processor';
import { prepareCapturedListClosingSignatures } from '../../features/fenced-divs/capturedListSignatures';
import { scheduleCoordinatedFencedDivRun } from '../../features/fenced-divs/processingCoordinator';
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
            scheduleCoordinatedFencedDivRun(
                context.element,
                isCurrent => scheduleFencedDivProcessingWithFullSource(context, isCurrent)
            );
            return;
        }

        void scheduleFencedDivProcessing(
            context.element,
            context.sourcePath,
            context.config,
            context.sectionInfo?.text
        );
    }
}

async function scheduleFencedDivProcessingWithFullSource(
    context: ReadingModeContext,
    isCurrent: () => boolean
): Promise<void> {
    const fullSourcePromise = readFullSourceText(context.sourcePath, context.app);
    await waitForPreviewDomToSettle();
    const fullSourceText = await fullSourcePromise;
    if (!isCurrent()) {
        return;
    }
    const processingRoot = fullSourceText
        ? context.element.closest<HTMLElement>('.markdown-preview-view') ?? context.element
        : context.element;
    const sourceText = fullSourceText ?? context.sectionInfo?.text;

    const capturedListClosingSignatures = sourceText === undefined
        ? undefined
        : await prepareCapturedListClosingSignatures(processingRoot, sourceText, context, isCurrent);
    if (!isCurrent()) {
        return;
    }

    await scheduleFencedDivProcessing(
        processingRoot,
        context.sourcePath,
        context.config,
        sourceText,
        { capturedListClosingSignatures, isCurrent }
    );
}

function waitForPreviewDomToSettle(): Promise<void> {
    return new Promise(resolve => {
        if (typeof window.requestAnimationFrame !== 'function') {
            window.setTimeout(resolve, 0);
            return;
        }
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
}
