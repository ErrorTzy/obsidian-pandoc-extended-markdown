import type {
    PandocUserInteractionPort
} from '../ports';
import {
    dirname
} from '../utils/pathUtils';
import {
    resolveExportOutputPath,
    selectExportProfile
} from './exportPlan';
import type {
    ExportProfile,
    ExportVariables,
    PandocExportRequest,
    PandocExportResult,
    PandocExportSettings
} from './types';
import type {
    PandocExportExecutionService,
    PandocExportSystemPort
} from './exportService';

export type PandocExportWorkflowUserPort = Pick<
    PandocUserInteractionPort,
    'confirmOverwrite' | 'openOutput' | 'revealOutput'
>;

export interface PandocExportVariableContext {
    variables: ExportVariables;
    templateVariables: ExportVariables;
    env: Record<string, string>;
}

export interface PandocExportWorkflowConfig {
    settings: PandocExportSettings;
    execution: PandocExportExecutionService;
    system: Pick<PandocExportSystemPort, 'exists'>;
    user?: Partial<PandocExportWorkflowUserPort>;
    saveSettings?: (settings: PandocExportSettings) => Promise<void>;
    onPostExportError?: (label: string, error: unknown) => void;
}

export interface RunPandocExportWorkflowRequest {
    request: PandocExportRequest;
    defaultOutputFolder: string;
    createVariableContext(outputPath: string): PandocExportVariableContext;
}

export interface RunPandocPreviewWorkflowRequest {
    request: PandocExportRequest;
    defaultOutputFolder: string;
    previewOutputPath: string;
    createVariableContext(outputPath: string): PandocExportVariableContext;
}

export interface ConvertPandocPreviewWorkflowRequest {
    inputPath: string;
    outputPath: string;
    to: string;
    cwd?: string;
}

export class PandocExportWorkflowService {
    private readonly config: PandocExportWorkflowConfig;
    private lastExportRequest?: PandocExportRequest;

    constructor(config: PandocExportWorkflowConfig) {
        this.config = config;
    }

    getLastExportRequest(): PandocExportRequest | undefined {
        return this.lastExportRequest ? { ...this.lastExportRequest } : undefined;
    }

    async exportFile(
        workflowRequest: RunPandocExportWorkflowRequest
    ): Promise<PandocExportResult> {
        const { request } = workflowRequest;
        const profile = this.selectProfile(request.profileId);
        if (!profile) {
            return { ok: false, error: 'Pandoc export profile not found.' };
        }

        const outputPath = this.resolveOutputPath(workflowRequest, profile);
        const finalOutputPath = await this.resolveOverwritePath(outputPath, request);
        if (!finalOutputPath) {
            return { ok: false, profile, error: 'Export cancelled.' };
        }

        const context = workflowRequest.createVariableContext(finalOutputPath);
        await this.config.execution.ensureOutputDir(finalOutputPath);
        const result = profile.type === 'pandoc' ?
            await this.config.execution.exportPandocProfile({
                profile,
                variables: context.templateVariables,
                env: context.env,
                extraArgs: request.extraArgs
            }) :
            await this.config.execution.exportCustomProfile({
                profile,
                variables: context.templateVariables,
                env: context.env
            });

        if (!result.ok) {
            return {
                ok: false,
                profile,
                outputPath: finalOutputPath,
                result,
                error: result.error || result.stderr
            };
        }

        await this.afterSuccessfulExport(profile, finalOutputPath, request);

        return { ok: true, profile, outputPath: finalOutputPath, result };
    }

    async previewFile(
        workflowRequest: RunPandocPreviewWorkflowRequest
    ): Promise<PandocExportResult> {
        const { request } = workflowRequest;
        const profile = this.selectProfile(request.profileId);
        if (!profile) {
            return { ok: false, error: 'Pandoc export profile not found.' };
        }
        if (profile.type !== 'pandoc') {
            return { ok: false, profile, error: 'Preview is available for Pandoc profiles only.' };
        }

        const outputPath = this.resolveOutputPath(workflowRequest, profile);
        const context = workflowRequest.createVariableContext(outputPath);
        await this.config.execution.ensureOutputDir(workflowRequest.previewOutputPath);
        const result = await this.config.execution.previewPandocProfile({
            profile,
            variables: context.templateVariables,
            env: context.env,
            previewOutputPath: workflowRequest.previewOutputPath,
            extraArgs: request.extraArgs
        });

        if (!result.ok) {
            return {
                ok: false,
                profile,
                outputPath: workflowRequest.previewOutputPath,
                result,
                error: result.error || result.stderr
            };
        }

        return {
            ok: true,
            profile,
            outputPath: workflowRequest.previewOutputPath,
            result
        };
    }

    async convertPreviewFile(
        request: ConvertPandocPreviewWorkflowRequest
    ): Promise<PandocExportResult> {
        await this.config.execution.ensureOutputDir(request.outputPath);
        const result = await this.config.execution.convertPreviewFile({
            ...request,
            env: this.config.settings.env
        });

        if (!result.ok) {
            return {
                ok: false,
                outputPath: request.outputPath,
                result,
                error: result.error || result.stderr
            };
        }

        return { ok: true, outputPath: request.outputPath, result };
    }

    private selectProfile(profileId?: string): ExportProfile | undefined {
        return selectExportProfile(this.config.settings, profileId);
    }

    private resolveOutputPath(
        workflowRequest: Pick<RunPandocExportWorkflowRequest, 'request' | 'defaultOutputFolder'>,
        profile: ExportProfile
    ): string {
        return resolveExportOutputPath(
            workflowRequest.request,
            profile,
            workflowRequest.defaultOutputFolder
        );
    }

    private async resolveOverwritePath(
        outputPath: string,
        request: PandocExportRequest
    ): Promise<string | undefined> {
        if (!this.config.settings.showOverwriteConfirmation || request.overwrite) {
            return outputPath;
        }
        if (!await this.config.system.exists(outputPath)) {
            return outputPath;
        }

        return this.config.user?.confirmOverwrite?.(outputPath);
    }

    private async afterSuccessfulExport(
        profile: ExportProfile,
        outputPath: string,
        request: PandocExportRequest
    ): Promise<void> {
        this.lastExportRequest = {
            ...request,
            outputFolder: request.outputFolder,
            profileId: profile.id
        };
        this.config.settings.lastExportProfileId = profile.id;
        this.config.settings.lastOutputFolder = dirname(outputPath);

        await this.runPostExportAction(
            () => this.config.saveSettings?.(this.config.settings),
            'save Pandoc export settings'
        );

        if (profile.revealOutputFile ?? this.config.settings.revealOutputFile) {
            void this.runPostExportAction(
                () => this.config.user?.revealOutput?.(outputPath),
                'reveal exported file'
            );
        }
        if (profile.openOutputFile ?? this.config.settings.openOutputFile) {
            void this.runPostExportAction(
                () => this.config.user?.openOutput?.(outputPath),
                'open exported file'
            );
        }
    }

    private async runPostExportAction(
        action: () => Promise<void> | void | undefined,
        label: string
    ): Promise<void> {
        try {
            await action();
        } catch (error) {
            this.config.onPostExportError?.(label, error);
        }
    }
}
