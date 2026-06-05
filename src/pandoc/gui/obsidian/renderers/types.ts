import type {
    PandocPreviewArtifact
} from '../../../core';

export interface ObsidianPandocPreviewRenderRequest {
    container: HTMLElement;
    artifact: PandocPreviewArtifact;
    readText: (path: string) => Promise<string>;
    readBinary: (path: string) => Promise<Uint8Array>;
}

export interface ObsidianPandocPreviewRendererModule {
    id: string;
    label: string;
    render(request: ObsidianPandocPreviewRenderRequest): Promise<void>;
}
