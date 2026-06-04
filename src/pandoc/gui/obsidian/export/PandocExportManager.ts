import type { App, PluginManifest, TFile } from 'obsidian';

import {
    buildPandocEnv,
    buildTemplateVariableContext,
    PandocExportExecutionService,
    PandocExportWorkflowService,
    type PandocExportWorkflowUserPort,
    type PandocExportVariableContext
} from '../../../core';
import type {
    PandocSystemPort,
    PandocExportRequest,
    PandocExportResult,
    PandocExportSettings,
    PandocExportSystemPort
} from '../../../core';
import {
    ObsidianPandocUserInteractionPort
} from '../notices/userInteractionPort';
import {
    ObsidianPandocWorkspacePort
} from '../workspace/workspacePort';

export interface PandocExportManagerConfig {
    app: App;
    manifest: PluginManifest;
    settings: PandocExportSettings;
    system: PandocExportSystemPort & Pick<PandocSystemPort, 'pathDelimiter' | 'platform'>;
    saveSettings?: () => Promise<void>;
    platformEnvDefaults?: Record<string, string>;
    runtimeEnv?: Record<string, string>;
    user?: Partial<PandocExportWorkflowUserPort>;
}

export class PandocExportManager {
    private readonly config: PandocExportManagerConfig;
    private readonly user: ObsidianPandocUserInteractionPort;
    private readonly workspace: ObsidianPandocWorkspacePort;
    private readonly workflow: PandocExportWorkflowService;

    constructor(config: PandocExportManagerConfig) {
        this.config = config;
        this.user = new ObsidianPandocUserInteractionPort();
        this.workspace = new ObsidianPandocWorkspacePort({
            app: config.app,
            manifest: config.manifest,
            settings: config.settings,
            saveSettings: async () => {
                await config.saveSettings?.();
            }
        });
        this.workflow = this.createWorkflowService();
    }

    getLastExportRequest(): PandocExportRequest | undefined {
        return this.workflow.getLastExportRequest();
    }

    async exportFile(request: PandocExportRequest): Promise<PandocExportResult> {
        return this.workflow.exportFile({
            request,
            defaultOutputFolder: this.getDefaultOutputFolder(request.currentFilePath),
            createVariableContext: outputPath => this.createVariableContext(request, outputPath)
        });
    }

    async previewFile(
        request: PandocExportRequest,
        previewOutputPath: string
    ): Promise<PandocExportResult> {
        return this.workflow.previewFile({
            request,
            previewOutputPath,
            defaultOutputFolder: this.getDefaultOutputFolder(request.currentFilePath),
            createVariableContext: outputPath => this.createVariableContext(request, outputPath)
        });
    }

    async convertPreviewFile(
        inputPath: string,
        outputPath: string,
        to: string,
        cwd?: string
    ): Promise<PandocExportResult> {
        return this.workflow.convertPreviewFile({
            inputPath,
            outputPath,
            to,
            cwd
        });
    }

    private createVariableContext(
        request: PandocExportRequest,
        outputPath: string,
    ): PandocExportVariableContext {
        const variables = this.workspace.exportVariables(
            request,
            outputPath,
            this.config.system.pathDelimiter()
        );

        return {
            variables,
            env: buildPandocEnv(
                this.config.settings.env,
                variables,
                this.config.platformEnvDefaults ?? {},
                this.config.runtimeEnv
            ),
            templateVariables: buildTemplateVariableContext(variables, {
                includeRuntimeEnv: this.config.settings.suggestRuntimeEnvVariables,
                runtimeEnv: this.config.runtimeEnv
            }).variables
        };
    }

    private createExecutionService(): PandocExportExecutionService {
        return new PandocExportExecutionService({
            pandocPath: this.config.settings.pandocPath,
            system: this.config.system
        });
    }

    private createWorkflowService(): PandocExportWorkflowService {
        return new PandocExportWorkflowService({
            settings: this.config.settings,
            execution: this.createExecutionService(),
            system: this.config.system,
            user: this.config.user ?? {
                confirmOverwrite: path => this.user.confirmOverwrite(path),
                openOutput: path => this.user.openOutput(path),
                revealOutput: path => this.user.revealOutput(path)
            },
            saveSettings: settings => this.workspace.saveSettings(settings),
            onPostExportError: (label, error) => {
                console.warn(`Failed to ${label}.`, error);
            }
        });
    }

    private getDefaultOutputFolder(currentFilePath: string): string {
        return this.workspace.defaultOutputFolder(currentFilePath);
    }
}

export function createPandocExportRequestFromFile(
    file: TFile,
    partial: Partial<PandocExportRequest> = {}
): PandocExportRequest {
    return {
        currentFilePath: file.path,
        currentFileName: file.name,
        currentFileBaseName: file.basename,
        ...partial
    };
}
