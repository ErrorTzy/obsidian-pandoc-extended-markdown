import { ReadingModeContext, ReadingModeProcessor } from './types';

export class ReadingModePipeline {
    private processors: ReadingModeProcessor[] = [];

    registerProcessor(processor: ReadingModeProcessor): void {
        this.processors.push(processor);
        this.processors.sort((a, b) => a.priority - b.priority);
    }

    process(context: ReadingModeContext): void {
        this.processors
            .filter(processor => processor.isEnabled?.(context) ?? true)
            .forEach(processor => processor.process(context));
    }
}
