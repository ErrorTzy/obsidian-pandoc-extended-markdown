import {
    createPreviewArtifact,
    selectPreviewRendererPlan
} from '../../../core';
import type {
    OdtPreviewAddonSettings,
    PandocPreviewArtifact,
    PandocPreviewRendererPlan
} from '../../../core';
import {
    createDefaultObsidianPandocPreviewRendererRegistry
} from './defaultRegistry';
import {
    resetPreviewSizing
} from './previewSizing';
import {
    renderUnsupportedPreview
} from './shared/unsupportedPreview';
import type {
    ObsidianPandocPreviewRendererRegistry
} from './registry';

const ODT_FALLBACK_PREVIEW_NOTICE =
    'This preview is a fallback. Download odt support in plugin settings for the recommended renderer.';

export type {
    PandocPreviewRendererKind
} from '../../../core';

export interface PandocPreviewRenderer extends PandocPreviewRendererPlan {
    pageSize?: {
        widthPx: number;
        heightPx: number;
        marginsPx?: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        };
        headerHeightPx?: number;
        footerHeightPx?: number;
    };
    sourcePath?: string;
}

export interface PandocPreviewRenderRequest {
    container: HTMLElement;
    filePath: string;
    renderer: PandocPreviewRenderer;
    readText: (path: string) => Promise<string>;
    readBinary: (path: string) => Promise<Uint8Array>;
    registry?: ObsidianPandocPreviewRendererRegistry;
}

export function selectPreviewRenderer(
    toFormat: string,
    extension: string,
    odtAddon?: OdtPreviewAddonSettings
): PandocPreviewRenderer {
    return selectPreviewRendererPlan(toFormat, extension, odtAddon);
}

export async function renderPreviewFile(request: PandocPreviewRenderRequest): Promise<void> {
    resetPreviewSizing(request.container);
    request.container.empty();
    request.container.addClass('pem-pandoc-preview-rendered');

    const artifact = artifactFromLegacyRequest(request);
    const registry = request.registry ?? createDefaultObsidianPandocPreviewRendererRegistry();
    const renderer = registry.get(artifact.rendererId ?? artifact.kind);
    if (!renderer) {
        renderUnsupportedPreview(request.container, artifact.label);
        return;
    }

    await renderer.render({
        container: request.container,
        artifact,
        readText: request.readText,
        readBinary: request.readBinary
    });
}

function artifactFromLegacyRequest(request: PandocPreviewRenderRequest): PandocPreviewArtifact {
    const artifact = createPreviewArtifact(
        request.renderer,
        request.filePath,
        request.renderer.sourcePath
    );
    artifact.pageSize = request.renderer.pageSize;
    artifact.metadata = {
        ...artifact.metadata,
        ...legacyFallbackNoticeMetadata(request.renderer)
    };

    return artifact;
}

function legacyFallbackNoticeMetadata(
    renderer: PandocPreviewRenderer
): Record<string, unknown> {
    if (
        renderer.kind === 'html' &&
        renderer.label === 'ODT fallback preview' &&
        renderer.sourcePath?.toLowerCase().endsWith('.odt')
    ) {
        return { previewNotice: ODT_FALLBACK_PREVIEW_NOTICE };
    }

    return {};
}
