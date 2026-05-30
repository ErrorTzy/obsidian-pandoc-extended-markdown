import type { App, PluginManifest, TFile } from 'obsidian';

import { ElectronPandocDesktopAdapter, PandocDesktopAdapter } from './desktopAdapter';
import { buildPandocEnv } from './environment';
import {
    NodePandocExportFileSystem,
    PandocExportFileSystem
} from './fileSystem';
import { dirname, joinPath } from './pathUtils';
import { PandocService } from './PandocService';
import { buildPandocProfileArgs } from './profileArgs';
import { runShellCommand, ShellRunner } from './shellRunner';
import { renderExportTemplate } from './template';
import { buildTemplateVariableContext } from './templateVariables';
import {
    ExportProfile,
    PandocExportRequest,
    PandocExportResult,
    PandocExportSettings
} from './types';
import { buildExportVariables } from './variables';

export interface PandocExportManagerConfig {
    app: App;
    manifest: PluginManifest;
    settings: PandocExportSettings;
    saveSettings?: () => Promise<void>;
    service?: PandocService;
    fileSystem?: PandocExportFileSystem;
    desktop?: PandocDesktopAdapter;
    shellRunner?: ShellRunner;
}

export class PandocExportManager {
    private readonly config: PandocExportManagerConfig;
    private lastExportRequest?: PandocExportRequest;

    constructor(config: PandocExportManagerConfig) {
        this.config = config;
    }

    getLastExportRequest(): PandocExportRequest | undefined {
        return this.lastExportRequest ? { ...this.lastExportRequest } : undefined;
    }

    async exportFile(request: PandocExportRequest): Promise<PandocExportResult> {
        const profile = this.getProfile(request.profileId);
        if (!profile) {
            return { ok: false, error: 'Pandoc export profile not found.' };
        }

        const outputPath = this.resolveOutputPath(request, profile);
        const finalOutputPath = await this.resolveOverwritePath(outputPath, request);
        if (!finalOutputPath) {
            return { ok: false, profile, error: 'Export cancelled.' };
        }

        const variables = buildExportVariables({
            vault: this.config.app.vault,
            metadataCache: this.config.app.metadataCache,
            currentFile: {
                path: request.currentFilePath,
                name: request.currentFileName,
                basename: request.currentFileBaseName
            },
            outputPath: finalOutputPath,
            pluginDir: this.getPluginDir()
        });
        const env = buildPandocEnv(this.config.settings.env, variables);
        const templateVariables = buildTemplateVariableContext(variables, {
            includeRuntimeEnv: this.config.settings.suggestRuntimeEnvVariables
        }).variables;
        const fileSystem = this.config.fileSystem ?? new NodePandocExportFileSystem();
        await fileSystem.ensureDir(finalOutputPath);

        const result = profile.type === 'pandoc' ?
            await this.exportPandocProfile(profile, templateVariables, env, request.extraArgs) :
            await this.exportCustomProfile(profile, templateVariables, env);

        if (!result.ok) {
            return { ok: false, profile, outputPath: finalOutputPath, result, error: result.error || result.stderr };
        }

        await this.afterSuccessfulExport(profile, finalOutputPath, request);

        return { ok: true, profile, outputPath: finalOutputPath, result };
    }

    private async exportPandocProfile(
        profile: Extract<ExportProfile, { type: 'pandoc' }>,
        variables: ReturnType<typeof buildExportVariables>,
        env: Record<string, string>,
        extraArgs?: string[]
    ) {
        const service = this.config.service ?? new PandocService();
        return service.run(buildPandocProfileArgs({ profile, variables, extraArgs }), {
            pandocPath: this.config.settings.pandocPath,
            cwd: variables.currentDir,
            env
        });
    }

    private async exportCustomProfile(
        profile: Extract<ExportProfile, { type: 'custom' }>,
        variables: ReturnType<typeof buildExportVariables>,
        env: Record<string, string>
    ) {
        if (profile.shell !== true) {
            return {
                executable: profile.commandTemplate,
                args: [],
                exitCode: 1,
                signal: null,
                stdout: '',
                stderr: 'Custom shell profile is not explicitly enabled.',
                error: 'Custom shell profile is not explicitly enabled.',
                timedOut: false,
                durationMs: 0,
                ok: false
            };
        }

        const command = renderExportTemplate(profile.commandTemplate, variables);
        return (this.config.shellRunner ?? runShellCommand)({
            command,
            cwd: variables.currentDir,
            env
        });
    }

    private async afterSuccessfulExport(
        profile: ExportProfile,
        outputPath: string,
        request: PandocExportRequest
    ): Promise<void> {
        this.lastExportRequest = { ...request, outputFolder: request.outputFolder, profileId: profile.id };
        this.config.settings.lastExportProfileId = profile.id;
        this.config.settings.lastOutputFolder = dirname(outputPath);
        await runPostExportAction(() => this.config.saveSettings?.(), 'save Pandoc export settings');

        const desktop = this.config.desktop ?? new ElectronPandocDesktopAdapter();
        if (profile.revealOutputFile ?? this.config.settings.revealOutputFile) {
            void runPostExportAction(() => desktop.revealPath(outputPath), 'reveal exported file');
        }
        if (profile.openOutputFile ?? this.config.settings.openOutputFile) {
            void runPostExportAction(() => desktop.openPath(outputPath), 'open exported file');
        }
    }

    private async resolveOverwritePath(
        outputPath: string,
        request: PandocExportRequest
    ): Promise<string | undefined> {
        const fileSystem = this.config.fileSystem ?? new NodePandocExportFileSystem();
        if (!this.config.settings.showOverwriteConfirmation || request.overwrite) {
            return outputPath;
        }
        if (!await fileSystem.exists(outputPath)) {
            return outputPath;
        }

        return (this.config.desktop ?? new ElectronPandocDesktopAdapter()).confirmOverwrite(outputPath);
    }

    private getProfile(profileId?: string): ExportProfile | undefined {
        const id = profileId ?? this.config.settings.lastExportProfileId;
        return this.config.settings.profiles.find(profile => profile.id === id) ??
            this.config.settings.profiles[0];
    }

    private resolveOutputPath(request: PandocExportRequest, profile: ExportProfile): string {
        const outputFolder = request.outputFolder ?? this.getDefaultOutputFolder(request.currentFilePath);
        const outputFileName = request.outputFileName ||
            `${request.currentFileBaseName}${profile.extension}`;

        return joinPath(outputFolder, outputFileName);
    }

    private getDefaultOutputFolder(currentFilePath: string): string {
        const settings = this.config.settings;
        if (settings.defaultOutputFolderMode === 'custom' && settings.customOutputFolder) {
            return settings.customOutputFolder;
        }
        if (settings.defaultOutputFolderMode === 'last' && settings.lastOutputFolder) {
            return settings.lastOutputFolder;
        }
        if (settings.defaultOutputFolderMode === 'vault') {
            return this.getVaultDir();
        }

        const adapter = this.config.app.vault.adapter as typeof this.config.app.vault.adapter & {
            getFullPath?: (path: string) => string;
        };
        const fullPath = adapter.getFullPath?.(currentFilePath) ?? currentFilePath;
        return fullPath.slice(0, Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\')));
    }

    private getPluginDir(): string {
        const vaultDir = this.getVaultDir();
        if (this.config.manifest.dir) {
            return joinPath(vaultDir, this.config.manifest.dir);
        }

        const vault = this.config.app.vault as typeof this.config.app.vault & {
            configDir?: string;
        };
        return joinPath(vaultDir, vault.configDir ?? '', 'plugins', this.config.manifest.id);
    }

    private getVaultDir(): string {
        const adapter = this.config.app.vault.adapter as typeof this.config.app.vault.adapter & {
            getBasePath?: () => string;
        };

        return adapter.getBasePath?.() ?? '';
    }
}

async function runPostExportAction(
    action: () => Promise<void> | void | undefined,
    label: string
): Promise<void> {
    try {
        await action();
    } catch (error) {
        console.warn(`Failed to ${label}.`, error);
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
