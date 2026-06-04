import {
    isPandocPreviewRenderTask,
    PandocPreviewSession,
    PandocPreviewWorkflowService
} from '../../core';
import type {
    PandocExportRequest,
    PandocExportResult,
    PandocExportSettings,
    PandocPreviewRenderTask,
    PandocPreviewSessionPort,
    PandocSystemPort
} from '../../core';
import {
    renderPreviewFile,
    type PandocPreviewRenderer
} from './renderers/previewRenderers';
import {
    DEFAULT_ODT_PAGE_SIZE,
    extractOdtPageSizes,
    pageSizeAt
} from './renderers/previewPageMetadata';
import type { PandocExportManager } from './export';

export interface PandocPreviewManagerConfig {
    exportManager: Pick<PandocExportManager, 'previewFile' | 'convertPreviewFile'>;
    settings: PandocExportSettings;
    makeTempPath: PandocPreviewSessionPort['makeTempPath'];
    system: Pick<PandocSystemPort, 'readBinary' | 'readText' | 'removeFile'>;
    renderFile?: typeof renderPreviewFile;
}

export interface PandocPreviewRefreshRequest {
    request: PandocExportRequest;
    to: string;
    extension: string;
    container: HTMLElement;
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

    async refresh(request: PandocPreviewRefreshRequest): Promise<PandocExportResult | undefined> {
        const task = await this.workflow.startPreview(request);
        if (!isPandocPreviewRenderTask(task)) return task;

        return this.renderResult(request.container, task);
    }

    async cleanup(): Promise<void> {
        await this.workflow.cleanup();
    }

    private async renderResult(
        container: HTMLElement,
        task: PandocPreviewRenderTask
    ): Promise<PandocExportResult | undefined> {
        const renderer = task.renderer as PandocPreviewRenderer;
        if (renderer.kind === 'odt-addon') {
            try {
                await this.renderFile(container, task.outputPath, renderer);
                return task.result;
            } catch {
                if (!this.workflow.isCurrentRun(task.run)) return undefined;
                return this.renderOdtFallbackResult(container, task);
            }
        }

        if (renderer.kind === 'odt-pandoc-fallback') {
            return this.renderOdtFallbackResult(container, task);
        }

        if (!this.workflow.isCurrentRun(task.run)) return undefined;
        await this.renderFile(container, task.outputPath, renderer);
        return task.result;
    }

    private async renderOdtFallbackResult(
        container: HTMLElement,
        task: PandocPreviewRenderTask
    ): Promise<PandocExportResult | undefined> {
        const renderPath = await this.workflow.convertOdtFallback(task.run, task.outputPath);
        if (!renderPath) return undefined;
        const pageSize = pageSizeAt(
            extractOdtPageSizes(await this.readBinary(task.outputPath)),
            0,
            DEFAULT_ODT_PAGE_SIZE
        );

        if (!this.workflow.isCurrentRun(task.run)) return undefined;
        await this.renderFile(container, renderPath, {
            kind: 'paged-html',
            label: 'ODT fallback preview',
            pageSize
        });

        return task.result;
    }

    private async renderFile(
        container: HTMLElement,
        filePath: string,
        renderer: PandocPreviewRenderer
    ): Promise<void> {
        await (this.config.renderFile ?? renderPreviewFile)({
            container,
            filePath,
            renderer,
            readText: path => this.readText(path),
            readBinary: path => this.readBinary(path)
        });
    }

    private async readText(path: string): Promise<string> {
        return this.config.system.readText(path);
    }

    private async readBinary(path: string): Promise<Uint8Array> {
        return this.config.system.readBinary(path);
    }

    private createSessionPort(): PandocPreviewSessionPort {
        return {
            makeTempPath: (extension, runId) => this.config.makeTempPath(extension, runId),
            removeFile: path => this.config.system.removeFile(path)
        };
    }
}
