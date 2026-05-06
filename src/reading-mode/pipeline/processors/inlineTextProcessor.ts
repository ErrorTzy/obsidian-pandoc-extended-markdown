import { InlineTextProcessor, ReadingModeContext } from '../types';
import { processInlineTextNodes } from '../inline/textReplacementEngine';

export class InlineTextEngineProcessor {
    name = 'inline-text-engine';
    phase = 'inline' as const;
    priority = 300;

    constructor(private readonly processors: InlineTextProcessor[]) {}

    process(context: ReadingModeContext): void {
        processInlineTextNodes(context.element, context, this.processors);
    }
}
