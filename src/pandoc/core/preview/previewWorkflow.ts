import type {
    PandocExportRequest,
    PandocExportResult,
    OdtPreviewAddonSettings
} from '../export/types';
import {
    createPreviewArtifact,
    selectPreviewRendererPlan
} from './previewArtifact';
import type {
    PandocPreviewRendererPlan
} from './previewArtifact';
import type {
    PandocPreviewPlan,
    PandocPreviewRendererPort
} from '../ports';
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
        cwd?: string,
        extraArgs?: string[]
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

export interface PandocPreviewRenderReaderPort {
    readText(path: string): Promise<string>;
    readBinary(path: string): Promise<Uint8Array>;
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
            undefined,
            ['--standalone', '--embed-resources']
        );
        if (!result.ok) {
            throw new Error(result.error ?? 'ODT fallback preview failed.');
        }
        if (!this.config.session.isCurrentRun(run)) {
            return undefined;
        }

        return fallbackPath;
    }

    async renderPreviewTask(
        task: PandocPreviewRenderTask,
        renderer: PandocPreviewRendererPort,
        reader: PandocPreviewRenderReaderPort
    ): Promise<PandocPreviewPlan | undefined> {
        if (task.renderer.kind === 'odt-addon') {
            try {
                return await this.renderArtifact(task, renderer, reader);
            } catch {
                if (!this.isCurrentRun(task.run)) return undefined;
                return this.renderOdtFallbackArtifact(task, renderer, reader);
            }
        }

        if (task.renderer.kind === 'odt-pandoc-fallback') {
            return this.renderOdtFallbackArtifact(task, renderer, reader);
        }

        if (!this.isCurrentRun(task.run)) return undefined;
        return this.renderArtifact(task, renderer, reader);
    }

    isCurrentRun(run: PandocPreviewRun): boolean {
        return this.config.session.isCurrentRun(run);
    }

    cleanup(): Promise<void> {
        return this.config.session.cleanup();
    }

    private async renderArtifact(
        task: PandocPreviewRenderTask,
        renderer: PandocPreviewRendererPort,
        reader: PandocPreviewRenderReaderPort
    ): Promise<PandocPreviewPlan> {
        const artifact = createPreviewArtifact(task.renderer, task.outputPath);
        await renderer.render({
            artifact,
            readText: path => reader.readText(path),
            readBinary: path => reader.readBinary(path)
        });

        return {
            profile: task.result.profile,
            artifact
        };
    }

    private async renderOdtFallbackArtifact(
        task: PandocPreviewRenderTask,
        renderer: PandocPreviewRendererPort,
        reader: PandocPreviewRenderReaderPort
    ): Promise<PandocPreviewPlan | undefined> {
        const renderPath = await this.convertOdtFallback(task.run, task.outputPath);
        if (!renderPath) return undefined;

        const artifact = createPreviewArtifact({
            kind: 'html',
            label: 'ODT fallback preview'
        }, renderPath, task.outputPath);
        await renderer.render({
            artifact,
            readText: path => reader.readText(path),
            readBinary: path => reader.readBinary(path)
        });

        return {
            profile: task.result.profile,
            artifact
        };
    }
}

export function isPandocPreviewRenderTask(
    value: PandocPreviewRenderTask | PandocExportResult | undefined
): value is PandocPreviewRenderTask {
    return Boolean(value && 'run' in value);
}
