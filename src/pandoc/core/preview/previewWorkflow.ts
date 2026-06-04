import type {
    PandocExportRequest,
    PandocExportResult,
    OdtPreviewAddonSettings
} from '../export/types';
import {
    selectPreviewRendererPlan
} from './previewArtifact';
import type {
    PandocPreviewRendererPlan
} from './previewArtifact';
import type {
    PandocPreviewRun
} from './previewSession';
import {
    PandocPreviewSession
} from './previewSession';

export interface PandocPreviewExportPort {
    previewFile(request: PandocExportRequest, outputPath: string): Promise<PandocExportResult>;
    convertPreviewFile(
        inputPath: string,
        outputPath: string,
        to: string,
        cwd?: string
    ): Promise<PandocExportResult>;
}

export interface PandocPreviewWorkflowConfig {
    exportManager: PandocPreviewExportPort;
    odtAddon?: OdtPreviewAddonSettings;
    session: PandocPreviewSession;
}

export interface StartPandocPreviewRequest {
    request: PandocExportRequest;
    to: string;
    extension: string;
}

export interface PandocPreviewRenderTask {
    run: PandocPreviewRun;
    renderer: PandocPreviewRendererPlan;
    outputPath: string;
    result: PandocExportResult;
}

export class PandocPreviewWorkflowService {
    private readonly config: PandocPreviewWorkflowConfig;

    constructor(config: PandocPreviewWorkflowConfig) {
        this.config = config;
    }

    async startPreview(
        request: StartPandocPreviewRequest
    ): Promise<PandocPreviewRenderTask | PandocExportResult | undefined> {
        const run = await this.config.session.beginRun(request.extension);
        const renderer = selectPreviewRendererPlan(
            request.to,
            request.extension,
            this.config.odtAddon
        );
        const result = await this.config.exportManager.previewFile(
            request.request,
            run.outputPath
        );

        if (await this.config.session.removeIfStale(run)) {
            return undefined;
        }
        if (!result.ok || !result.outputPath) {
            return result;
        }

        return {
            run,
            renderer,
            outputPath: result.outputPath,
            result
        };
    }

    async convertOdtFallback(
        run: PandocPreviewRun,
        outputPath: string
    ): Promise<string | undefined> {
        const fallbackPath = await this.config.session.createTempFile(run, '.html');
        const result = await this.config.exportManager.convertPreviewFile(
            outputPath,
            fallbackPath,
            'html',
            undefined
        );
        if (!result.ok) {
            throw new Error(result.error ?? 'ODT fallback preview failed.');
        }
        if (!this.config.session.isCurrentRun(run)) {
            return undefined;
        }

        return fallbackPath;
    }

    isCurrentRun(run: PandocPreviewRun): boolean {
        return this.config.session.isCurrentRun(run);
    }

    cleanup(): Promise<void> {
        return this.config.session.cleanup();
    }
}

export function isPandocPreviewRenderTask(
    value: PandocPreviewRenderTask | PandocExportResult | undefined
): value is PandocPreviewRenderTask {
    return Boolean(value && 'run' in value);
}
