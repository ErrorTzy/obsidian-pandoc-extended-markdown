import type { MarkdownRenderChild } from 'obsidian';

import { normalizeExistingDefinitionLists } from '../../features/definition-lists/normalizer';
import { readFullSourceText } from '../sourceText';
import { BlockDomProcessor, ReadingModeContext } from '../types';

const DEFINITION_LIST_SELECTOR = 'dl.pem-definition-list';
const DOM_SETTLED_FRAME_COUNT = 2;
const DOM_SETTLED_FALLBACK_MS = 500;
const MIN_HEIGHT_CSS_PROPERTY = 'min-height';
const rootControllers = new WeakMap<HTMLElement, DefinitionListReconciliationController>();

export class DefinitionListNormalizationProcessor implements BlockDomProcessor {
    name = 'definition-list-normalization';
    phase = 'block' as const;
    priority = 40;

    isEnabled(context: ReadingModeContext): boolean {
        return context.config.enableDefinitionLists !== false;
    }

    process(context: ReadingModeContext): void {
        const definitionRoot = getDefinitionListNormalizationRoot(context.element);
        if (!context.app) {
            normalizeExistingDefinitionLists(
                definitionRoot,
                context.postProcessorContext,
                context.config,
                context.renderContext
            );
            runAfterDomSettles(definitionRoot, () => {
                normalizeExistingDefinitionLists(
                    definitionRoot,
                    context.postProcessorContext,
                    context.config,
                    context.renderContext
                );
            });
            return;
        }

        const observationRoot = getDefinitionListObservationRoot(definitionRoot);
        const controller = getDefinitionListReconciliationController(observationRoot, context);

        void controller.reconcile();
        runAfterDomSettles(observationRoot, () => {
            void controller.reconcile();
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

function getDefinitionListObservationRoot(element: HTMLElement): HTMLElement {
    return element.closest('.markdown-embed') as HTMLElement || element;
}

function getDefinitionListReconciliationController(
    root: HTMLElement,
    context: ReadingModeContext
): DefinitionListReconciliationController {
    const existing = rootControllers.get(root);
    if (existing) {
        existing.updateContext(context);
        return existing;
    }

    const controller = new DefinitionListReconciliationController(root, context);
    rootControllers.set(root, controller);
    controller.start();
    return controller;
}

class DefinitionListReconciliationController {
    private context: ReadingModeContext;
    private observer: MutationObserver | null = null;
    private connectionObserver: MutationObserver | null = null;
    private observedRoot: HTMLElement | null = null;
    private scheduled = false;
    private running = false;
    private pending = false;

    constructor(private readonly root: HTMLElement, context: ReadingModeContext) {
        this.context = context;
    }

    updateContext(context: ReadingModeContext): void {
        this.context = context;
    }

    start(): void {
        if (typeof MutationObserver === 'undefined') {
            this.registerLifecycle();
            return;
        }

        this.observeCurrentRoot();
        this.observeConnectionIfDetached();
        this.registerLifecycle();
    }

    schedule(): void {
        if (this.scheduled) {
            return;
        }

        this.scheduled = true;
        queueDefinitionListReconciliation(() => void this.reconcile());
    }

    stop(): void {
        this.observer?.disconnect();
        this.connectionObserver?.disconnect();
        this.observer = null;
        this.connectionObserver = null;
        this.observedRoot = null;
        this.scheduled = false;
    }

    async reconcile(): Promise<void> {
        this.scheduled = false;
        if (this.running) {
            this.pending = true;
            return;
        }

        this.running = true;
        try {
            this.observeCurrentRoot();
            await normalizeDefinitionRoot(this.root, this.context);
            this.observeCurrentRoot();
            this.observeConnectionIfDetached();
        } finally {
            this.running = false;
            if (this.pending) {
                this.pending = false;
                this.schedule();
            }
        }
    }

    private registerLifecycle(): void {
        if (typeof this.context.postProcessorContext.addChild !== 'function') {
            return;
        }

        this.context.postProcessorContext.addChild(createObserverRenderChild(this.root, () => {
            this.stop();
            rootControllers.delete(this.root);
        }));
    }

    private observeCurrentRoot(): void {
        if (!this.observer || this.observedRoot !== this.resolveObservationRoot()) {
            this.observer?.disconnect();
            this.observedRoot = this.resolveObservationRoot();
            this.observer = new MutationObserver(() => this.schedule());
            this.observer.observe(this.observedRoot, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }

    private observeConnectionIfDetached(): void {
        if (this.root.closest('.markdown-preview-section') || this.connectionObserver) {
            return;
        }

        this.connectionObserver = new MutationObserver(() => {
            if (!this.root.closest('.markdown-preview-section')) {
                return;
            }

            this.connectionObserver?.disconnect();
            this.connectionObserver = null;
            this.observeCurrentRoot();
            this.schedule();
        });
        this.connectionObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    private resolveObservationRoot(): HTMLElement {
        return this.root.closest<HTMLElement>('.markdown-embed') ??
            this.root.closest<HTMLElement>('.markdown-preview-section') ??
            this.root;
    }
}

async function normalizeDefinitionRoot(
    definitionRoot: HTMLElement,
    context: ReadingModeContext
): Promise<void> {
    const roots = getCurrentDefinitionRoots(definitionRoot);
    roots.forEach(root => normalizeExistingDefinitionLists(
        root,
        context.postProcessorContext,
        context.config,
        context.renderContext
    ));
    releaseEmbeddedPreviewMinimumHeight(definitionRoot);

    if (!context.app) {
        return;
    }

    const fullSourceText = await readFullSourceText(context.sourcePath, context.app);
    if (!fullSourceText) {
        return;
    }

    context.fullSource = fullSourceText;
    getCurrentDefinitionRoots(definitionRoot).forEach(root => normalizeExistingDefinitionLists(
        root,
        context.postProcessorContext,
        context.config,
        context.renderContext,
        fullSourceText
    ));
    releaseEmbeddedPreviewMinimumHeight(definitionRoot);
}

function getCurrentDefinitionRoots(root: HTMLElement): HTMLElement[] {
    if (root.classList.contains('markdown-embed')) {
        const embedSections = Array.from(root.querySelectorAll<HTMLElement>('.markdown-preview-section'));
        return embedSections.length > 0 ? embedSections : [root];
    }

    if (root.classList.contains('markdown-preview-section')) {
        return [root];
    }

    const currentSection = root.closest<HTMLElement>('.markdown-preview-section');
    if (currentSection) {
        return [currentSection];
    }

    const nestedSections = Array.from(root.querySelectorAll<HTMLElement>('.markdown-preview-section'));
    return nestedSections.length > 0 ? nestedSections : [root];
}

function queueDefinitionListReconciliation(callback: () => void): void {
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(callback);
        return;
    }

    window.setTimeout(callback, 0);
}

function releaseEmbeddedPreviewMinimumHeight(root: HTMLElement): void {
    const embed = root.classList.contains('markdown-embed') ?
        root :
        root.closest<HTMLElement>('.markdown-embed');
    if (!embed) {
        return;
    }

    const sections = Array.from(embed.querySelectorAll<HTMLElement>('.markdown-preview-section'))
        .filter(section => section.querySelector(DEFINITION_LIST_SELECTOR));
    sections.forEach(section => {
        section.setCssProps({ [MIN_HEIGHT_CSS_PROPERTY]: '0px' });
    });
}

function createObserverRenderChild(
    containerEl: HTMLElement,
    onunload: () => void
): MarkdownRenderChild {
    return {
        containerEl,
        load: () => undefined,
        onload: () => undefined,
        unload: onunload,
        onunload
    } as unknown as MarkdownRenderChild;
}
