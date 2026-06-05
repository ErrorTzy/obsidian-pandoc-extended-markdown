import type {
    PandocPreviewRendererPort
} from '../../../core';
import {
    createDefaultObsidianPandocPreviewRendererRegistry
} from './defaultRegistry';
import type {
    ObsidianPandocPreviewRendererRegistry
} from './registry';
import {
    resetPreviewSizing
} from './previewSizing';
import {
    renderUnsupportedPreview
} from './shared/unsupportedPreview';

export class ObsidianPandocPreviewRendererPort implements PandocPreviewRendererPort {
    private readonly container: HTMLElement;
    private readonly registry: ObsidianPandocPreviewRendererRegistry;

    constructor(
        container: HTMLElement,
        registry = createDefaultObsidianPandocPreviewRendererRegistry()
    ) {
        this.container = container;
        this.registry = registry;
    }

    async render(request: Parameters<PandocPreviewRendererPort['render']>[0]): Promise<void> {
        resetPreviewContainer(this.container);
        const rendererId = request.artifact.rendererId ?? request.artifact.kind;
        const renderer = this.registry.get(rendererId);
        if (!renderer) {
            renderUnsupportedPreview(this.container, request.artifact.label);
            return;
        }

        await renderer.render({
            container: this.container,
            artifact: request.artifact,
            readText: request.readText,
            readBinary: request.readBinary
        });
    }
}

export function resetPreviewContainer(container: HTMLElement): void {
    resetPreviewSizing(container);
    container.empty();
    container.addClass('pem-pandoc-preview-rendered');
}
