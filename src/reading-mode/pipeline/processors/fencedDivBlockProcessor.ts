import { scheduleFencedDivProcessing } from '../../features/fenced-divs/processor';
import { BlockDomProcessor, ReadingModeContext } from '../types';

export class FencedDivBlockProcessor implements BlockDomProcessor {
    name = 'fenced-div-blocks';
    phase = 'block' as const;
    priority = 60;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableFencedDivs !== false;
    }

    process(context: ReadingModeContext): void {
        scheduleFencedDivProcessing(
            context.element,
            context.sourcePath,
            context.config,
            context.sectionInfo?.text
        );
    }
}
