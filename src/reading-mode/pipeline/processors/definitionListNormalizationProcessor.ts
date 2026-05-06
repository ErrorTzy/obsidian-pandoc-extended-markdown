import { normalizeExistingDefinitionLists } from '../../utils/definitionListDom';
import { BlockDomProcessor, ObsidianAppLike, ReadingModeContext } from '../types';

const DEFINITION_LIST_NORMALIZATION_DELAY_MS = 50;

export class DefinitionListNormalizationProcessor implements BlockDomProcessor {
    name = 'definition-list-normalization';
    phase = 'block' as const;
    priority = 40;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableDefinitionLists !== false;
    }

    process(context: ReadingModeContext): void {
        const definitionRoot = getDefinitionListNormalizationRoot(context.element);
        window.setTimeout(() => {
            if (context.app) {
                void normalizeDefinitionListsWithFullSource(definitionRoot, context);
                return;
            }

            normalizeExistingDefinitionLists(
                definitionRoot,
                context.postProcessorContext,
                context.config,
                context.renderContext
            );
        }, DEFINITION_LIST_NORMALIZATION_DELAY_MS);
    }
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
