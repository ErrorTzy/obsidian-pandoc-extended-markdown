import type {
    PandocPreviewArtifact,
    PandocPreviewArtifactKind
} from '../../ports';
import type {
    PandocPreviewFormatModule,
    PandocPreviewMatchRequest,
    PandocPreviewRendererId,
    PandocPreviewRendererKind,
    PandocPreviewRendererPlan
} from '../types';

export interface SimplePreviewFormatOptions {
    id: string;
    kind: PandocPreviewArtifactKind;
    label: string;
    rendererId?: PandocPreviewRendererId;
    matches(request: PandocPreviewMatchRequest): boolean;
}

export function createSimplePreviewFormatModule(
    options: SimplePreviewFormatOptions
): PandocPreviewFormatModule {
    return {
        id: options.id,
        match: request => options.matches(request),
        createPipeline: () => ({
            formatId: options.id,
            stages: [{
                id: `${options.id}:render`,
                createArtifact: async ({ outputPath }) => createArtifact({
                    formatId: options.id,
                    kind: options.kind,
                    label: options.label,
                    rendererId: options.rendererId ?? options.kind
                }, outputPath)
            }]
        }),
        createRendererPlan: () => ({
            formatId: options.id,
            kind: options.kind as PandocPreviewRendererKind,
            label: options.label,
            rendererId: options.rendererId ?? options.kind
        })
    };
}

export function createArtifact(
    plan: PandocPreviewRendererPlan,
    filePath: string,
    sourcePath?: string
): PandocPreviewArtifact {
    return {
        kind: artifactKindForRenderer(plan.kind),
        formatId: plan.formatId,
        rendererId: plan.rendererId,
        label: plan.label,
        filePath,
        sourcePath,
        addonInstallPath: plan.addonInstallPath,
        addonVersion: plan.addonVersion,
        metadata: plan.metadata
    };
}

function artifactKindForRenderer(kind: PandocPreviewRendererKind): PandocPreviewArtifactKind {
    return kind === 'odt-pandoc-fallback' ? 'html' : kind;
}
