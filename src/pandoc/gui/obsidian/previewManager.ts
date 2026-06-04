import {
    isPandocPreviewRenderTask,
    PandocPreviewSession,
    PandocPreviewWorkflowService
} from '../../core';
import type {
    PandocExportRequest,
    PandocExportResult,
    PandocExportSettings,
    PandocPreviewPlan,
    PandocPreviewRendererPort,
    PandocPreviewRenderTask,
    PandocPreviewRenderReaderPort,
    PandocPreviewSessionPort,
    PandocSystemPort
} from '../../core';
import type { PandocExportManager } from './export';

export interface PandocPreviewManagerConfig {
    exportManager: Pick<PandocExportManager, 'previewFile' | 'convertPreviewFile'>;
    settings: PandocExportSettings;
    makeTempPath: PandocPreviewSessionPort['makeTempPath'];
    system: Pick<PandocSystemPort, 'readBinary' | 'readText' | 'removeFile'>;
    renderer?: PandocPreviewRendererPort;
}

export interface PandocPreviewRefreshRequest {
    request: PandocExportRequest;
    to: string;
    extension: string;
    renderer?: PandocPreviewRendererPort;
}

export class PandocPreviewManager {
    private readonly config: PandocPreviewManagerConfig;
    private readonly workflow: PandocPreviewWorkflowService;

    constructor(config: PandocPreviewManagerConfig) {
        this.config = config;
        this.workflow = new PandocPreviewWorkflowService({
            exportManager: config.exportManager,
            odtAddon: config.settings.preview.odtAddon,
            session: new PandocPreviewSession(this.createSessionPort())
        });
    }

    async refresh(request: PandocPreviewRefreshRequest): Promise<PandocPreviewPlan | undefined> {
        const task = await this.workflow.startPreview(request);
        if (!isPandocPreviewRenderTask(task)) return this.exportResultToPlan(task);

        return this.renderResult(task, request.renderer ?? this.config.renderer);
    }

    async cleanup(): Promise<void> {
        await this.workflow.cleanup();
    }

    private async renderResult(
        task: PandocPreviewRenderTask,
        renderer: PandocPreviewRendererPort | undefined
    ): Promise<PandocPreviewPlan | undefined> {
        if (!renderer) {
            return { profile: task.result.profile, error: 'Pandoc preview renderer is not configured.' };
        }

        return this.workflow.renderPreviewTask(task, renderer, this.readerPort());
    }

    private async readText(path: string): Promise<string> {
        return this.config.system.readText(path);
    }

    private async readBinary(path: string): Promise<Uint8Array> {
        return this.config.system.readBinary(path);
    }

    private exportResultToPlan(
        result: PandocExportResult | undefined
    ): PandocPreviewPlan | undefined {
        if (!result) return undefined;
        return {
            profile: result.profile,
            error: result.ok ? undefined : result.error ?? 'Pandoc preview failed.'
        };
    }

    private readerPort(): PandocPreviewRenderReaderPort {
        return {
            readText: path => this.readText(path),
            readBinary: path => this.readBinary(path)
        };
    }

    private createSessionPort(): PandocPreviewSessionPort {
        return {
            makeTempPath: (extension, runId) => this.config.makeTempPath(extension, runId),
            removeFile: path => this.config.system.removeFile(path)
        };
    }
}
