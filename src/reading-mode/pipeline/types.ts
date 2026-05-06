import { MarkdownPostProcessorContext } from 'obsidian';

import { ProcessorConfig } from '../../shared/types/processorConfig';
import { DocumentCounters } from '../../shared/types/settingsTypes';
import { SectionInfo } from '../../shared/types/obsidian-extended';

import { RenderContext } from '../renderer';

export type ReadingModePhase = 'setup' | 'block' | 'inline' | 'cleanup';

export interface ReadingModeContext {
    element: HTMLElement;
    postProcessorContext: MarkdownPostProcessorContext;
    section: HTMLElement | null;
    sectionInfo: SectionInfo | null;
    sourcePath: string;
    fullSource?: string;
    config: ProcessorConfig;
    renderContext: RenderContext;
    counters: DocumentCounters;
    app?: ObsidianAppLike;
    validationLines: string[];
}

export interface ReadingModeProcessor {
    name: string;
    phase: ReadingModePhase;
    priority: number;
    isEnabled?(context: ReadingModeContext): boolean;
    process(context: ReadingModeContext): void;
}

export interface BlockDomProcessor extends ReadingModeProcessor {
    phase: 'block' | 'setup' | 'cleanup';
}

export interface InlineTextMatch {
    start: number;
    end: number;
    type: string;
    data?: Record<string, unknown>;
}

export interface InlineTextProcessor extends ReadingModeProcessor {
    phase: 'inline';
    findMatches(text: string, node: Text, context: ReadingModeContext): InlineTextMatch[];
    createReplacement(match: InlineTextMatch, context: ReadingModeContext): Node | Node[];
}

export interface ObsidianAppLike {
    vault?: ObsidianVaultLike;
    workspace?: {
        getActiveFile?(): ObsidianFileLike | null;
    };
}

export interface ObsidianVaultLike {
    getAbstractFileByPath(path: string): ObsidianFileLike | null;
    cachedRead(file: ObsidianFileLike): Promise<string>;
}

export interface ObsidianFileLike {
    path: string;
}
