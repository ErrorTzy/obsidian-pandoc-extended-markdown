import type {
    PandocExportRequest,
    PandocExportResult,
    OdtPreviewAddonSettings
} from '../export/types';
import {
    createDefaultPandocPreviewFormatRegistry
} from './defaultRegistry';
import type {
    PandocPreviewFormatRegistry
} from './registry';
import type {
    PandocPreviewPipeline,
    PandocPreviewRendererPlan
} from './types';
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
    formatRegistry?: PandocPreviewFormatRegistry;
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
    pipeline: PandocPreviewPipeline;
    renderer: PandocPreviewRendererPlan;
    outputPath: string;
    result: PandocExportResult;
}

export class PandocPreviewWorkflowService {
    private readonly config: PandocPreviewWorkflowConfig;
    private readonly formatRegistry: PandocPreviewFormatRegistry;

    constructor(config: PandocPreviewWorkflowConfig) {
        this.config = config;
        this.formatRegistry = config.formatRegistry ?? createDefaultPandocPreviewFormatRegistry();
    }

    async startPreview(
        request: StartPandocPreviewRequest
    ): Promise<PandocPreviewRenderTask | PandocExportResult | undefined> {
        const run = await this.config.session.beginRun(request.extension);
        const registryRequest = {
            to: request.to,
            extension: request.extension,
            odtAddon: this.config.odtAddon
        };
        const pipeline = this.formatRegistry.select(registryRequest);
        const renderer = this.formatRegistry.selectRendererPlan(registryRequest);
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
            pipeline,
            renderer,
            outputPath: result.outputPath,
            result
        };
    }

    async renderPreviewTask(
        task: PandocPreviewRenderTask,
        renderer: PandocPreviewRendererPort,
        reader: PandocPreviewRenderReaderPort
    ): Promise<PandocPreviewPlan | undefined> {
        for (const stage of task.pipeline.stages) {
            if (!this.isCurrentRun(task.run)) return undefined;
            const artifact = await stage.createArtifact({
                run: task.run,
                outputPath: task.outputPath,
                result: task.result,
                exportManager: this.config.exportManager,
                session: this.config.session
            });
            if (!artifact) continue;
            if (!this.isCurrentRun(task.run)) return undefined;

            try {
                await renderer.render({
                    artifact,
                    readText: path => reader.readText(path),
                    readBinary: path => reader.readBinary(path)
                });

                return {
                    profile: task.result.profile,
                    artifact
                };
            } catch (error) {
                if (!stage.continueOnRenderError) throw error;
            }
        }

        return undefined;
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
