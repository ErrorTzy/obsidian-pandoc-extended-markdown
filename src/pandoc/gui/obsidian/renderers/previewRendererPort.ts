import type {
    PandocPreviewArtifact,
    PandocPreviewRendererPort
} from '../../../core';
import {
    renderPreviewFile,
    type PandocPreviewRenderer
} from './previewRenderers';

export class ObsidianPandocPreviewRendererPort implements PandocPreviewRendererPort {
    private readonly container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    async render(request: Parameters<PandocPreviewRendererPort['render']>[0]): Promise<void> {
        await renderPreviewFile({
            container: this.container,
            filePath: request.artifact.filePath,
            renderer: rendererFromArtifact(request.artifact),
            readText: request.readText,
            readBinary: request.readBinary
        });
    }
}

function rendererFromArtifact(artifact: PandocPreviewArtifact): PandocPreviewRenderer {
    return {
        kind: artifact.kind,
        label: artifact.label,
        pageSize: artifact.pageSize,
        sourcePath: artifact.sourcePath,
        addonInstallPath: artifact.addonInstallPath,
        addonVersion: artifact.addonVersion
    };
}
