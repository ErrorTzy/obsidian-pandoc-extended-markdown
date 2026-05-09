import { normalizeExistingDefinitionLists } from '../../features/definition-lists/normalizer';
import { BlockDomProcessor, ObsidianAppLike, ReadingModeContext } from '../types';

const DOM_SETTLED_FRAME_COUNT = 2;
const DOM_SETTLED_FALLBACK_MS = 500;

export class DefinitionListNormalizationProcessor implements BlockDomProcessor {
    name = 'definition-list-normalization';
    phase = 'block' as const;
    priority = 40;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableDefinitionLists !== false;
    }

    process(context: ReadingModeContext): void {
        runAfterDomSettles(context.element, () => {
            const definitionRoot = getDefinitionListNormalizationRoot(context.element);
            if (context.app) {
                normalizeExistingDefinitionLists(
                    definitionRoot,
                    context.postProcessorContext,
                    context.config,
                    context.renderContext
                );
                void normalizeDefinitionListsWithFullSource(definitionRoot, context);
                return;
            }

            normalizeExistingDefinitionLists(
                definitionRoot,
                context.postProcessorContext,
                context.config,
                context.renderContext
            );
        });
    }
}

function runAfterDomSettles(root: HTMLElement, callback: () => void): void {
    const canObserveDom = typeof MutationObserver !== 'undefined' &&
        typeof window.requestAnimationFrame === 'function';

    if (!canObserveDom) {
        window.setTimeout(callback, 0);
        return;
    }

    let settledFrames = 0;
    let frameId: number | null = null;
    let fallbackId: number | null = null;
    let completed = false;

    const complete = () => {
        if (completed) {
            return;
        }
        completed = true;
        observer.disconnect();
        if (frameId !== null) {
            window.cancelAnimationFrame(frameId);
        }
        if (fallbackId !== null) {
            window.clearTimeout(fallbackId);
        }
        callback();
    };

    const scheduleFrame = () => {
        if (frameId !== null || completed) {
            return;
        }

        frameId = window.requestAnimationFrame(() => {
            frameId = null;
            settledFrames++;
            if (settledFrames >= DOM_SETTLED_FRAME_COUNT) {
                complete();
                return;
            }
            scheduleFrame();
        });
    };

    const observer = new MutationObserver(() => {
        settledFrames = 0;
        scheduleFrame();
    });

    observer.observe(root, {
        childList: true,
        subtree: true
    });
    fallbackId = window.setTimeout(complete, DOM_SETTLED_FALLBACK_MS);
    scheduleFrame();
}

function getDefinitionListNormalizationRoot(element: HTMLElement): HTMLElement {
    return element.closest('.markdown-preview-section') as HTMLElement ||
        element.closest('.el-p') as HTMLElement ||
        element;
}

async function normalizeDefinitionListsWithFullSource(
    definitionRoot: HTMLElement,
    context: ReadingModeContext
): Promise<void> {
    const fullSourceText = await readFullSourceText(context.sourcePath, context.app);
    context.fullSource = fullSourceText;
    normalizeExistingDefinitionLists(
        definitionRoot,
        context.postProcessorContext,
        context.config,
        context.renderContext,
        fullSourceText
    );
}

async function readFullSourceText(
    sourcePath?: string,
    suppliedApp?: ObsidianAppLike
): Promise<string | undefined> {
    const app = suppliedApp ?? getObsidianApp();
    const vault = app?.vault;
    const activeFile = app?.workspace?.getActiveFile?.();
    const path = sourcePath ?? activeFile?.path;

    if (!path) {
        return undefined;
    }

    const file = activeFile?.path === path
        ? activeFile
        : vault?.getAbstractFileByPath(path);
    if (!file || typeof vault?.cachedRead !== 'function') {
        return undefined;
    }

    try {
        return await vault.cachedRead(file);
    } catch {
        return undefined;
    }
}

function getObsidianApp(): ObsidianAppLike | undefined {
    const globalWindow = window as Window & {
        app?: ObsidianAppLike;
    };

    return globalWindow.app;
}
