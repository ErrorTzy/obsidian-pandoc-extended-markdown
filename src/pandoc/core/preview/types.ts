import type {
    OdtPreviewAddonSettings,
    PandocExportResult
} from '../export/types';
import type {
    PandocPreviewArtifact
} from '../ports';
import type {
    PandocPreviewExportPort
} from './previewWorkflow';
import type {
    PandocPreviewRun,
    PandocPreviewSession
} from './previewSession';

export type PandocPreviewRendererId = string;

export interface PandocPreviewMatchRequest {
    to: string;
    extension: string;
    normalizedFormat: string;
    normalizedExtension: string;
    odtAddon?: OdtPreviewAddonSettings;
}

export interface PandocPreviewPipeline {
    formatId: string;
    stages: PandocPreviewStage[];
}

export interface PandocPreviewStage {
    id: string;
    continueOnRenderError?: boolean;
    createArtifact(request: PandocPreviewStageRequest): Promise<PandocPreviewArtifact | undefined>;
}

export interface PandocPreviewStageRequest {
    run: PandocPreviewRun;
    outputPath: string;
    result: PandocExportResult;
    exportManager: PandocPreviewExportPort;
    session: PandocPreviewSession;
}

export interface PandocPreviewFormatModule {
    id: string;
    match(request: PandocPreviewMatchRequest): boolean;
    createPipeline(request: PandocPreviewMatchRequest): PandocPreviewPipeline;
    createRendererPlan(request: PandocPreviewMatchRequest): PandocPreviewRendererPlan;
}

export type PandocPreviewRendererKind =
    | 'html'
    | 'text'
    | 'pdf'
    | 'docx'
    | 'epub'
    | 'pptx'
    | 'odt-addon'
    | 'odt-pandoc-fallback'
    | 'unsupported';

export interface PandocPreviewRendererPlan {
    kind: PandocPreviewRendererKind;
    label: string;
    formatId?: string;
    rendererId?: PandocPreviewRendererId;
    addonInstallPath?: string;
    addonVersion?: string;
    metadata?: Record<string, unknown>;
}
