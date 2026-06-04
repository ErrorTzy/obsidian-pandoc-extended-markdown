import type {
    App,
    PluginManifest,
    TFile
} from 'obsidian';

import {
    buildExportVariables,
    dirname,
    joinPath,
    resolveDefaultOutputFolder
} from '../../../core';
import type {
    ExportVariables,
    PandocCurrentFile,
    PandocEmbed,
    PandocExportRequest,
    PandocExportSettings,
    PandocWorkspacePort
} from '../../../core';
import type {
    ExportVariableMetadataCache,
    ExportVariableVault
} from '../../../core';

export interface ObsidianPandocWorkspacePortConfig {
    app: App;
    manifest: PluginManifest;
    settings: PandocExportSettings;
    saveSettings?: (settings: PandocExportSettings) => Promise<void>;
}

export class ObsidianPandocWorkspacePort implements PandocWorkspacePort {
    private readonly config: ObsidianPandocWorkspacePortConfig;

    constructor(config: ObsidianPandocWorkspacePortConfig) {
        this.config = config;
    }

    vaultPath(): Promise<string> {
        return Promise.resolve(this.vaultDir());
    }

    pluginPath(): Promise<string> {
        return Promise.resolve(this.pluginDir());
    }

    currentFile(): Promise<PandocCurrentFile | undefined> {
        const workspace = this.config.app.workspace as typeof this.config.app.workspace & {
            getActiveFile?: () => TFile | null;
        };
        const file = workspace.getActiveFile?.();
        return Promise.resolve(file ? toCurrentFile(file) : undefined);
    }

    readFrontmatter(filePath: string): Promise<Record<string, unknown>> {
        const frontmatter = this.config.app.metadataCache
            ?.getCache?.(filePath)
            ?.frontmatter;
        return Promise.resolve(frontmatter ?? {});
    }

    resolveEmbeds(filePath: string): Promise<PandocEmbed[]> {
        const cache = this.config.app.metadataCache;
        const embeds = cache?.getCache?.(filePath)?.embeds ?? [];
        return Promise.resolve(embeds.flatMap(embed => {
            const target = cache?.getFirstLinkpathDest?.(embed.link, filePath);
            return target?.path ? [{
                sourcePath: filePath,
                targetPath: this.fullPath(target.path)
            }] : [];
        }));
    }

    attachmentFolder(filePath: string): Promise<string> {
        const vaultDir = this.vaultDir();
        const currentDir = dirname(this.fullPath(filePath));
        const attachmentFolder = this.vaultConfig().attachmentFolderPath ?? '/';
        if (attachmentFolder === '/') {
            return Promise.resolve(vaultDir);
        }
        if (attachmentFolder.startsWith('.')) {
            return Promise.resolve(joinPath(currentDir, attachmentFolder.slice(1)));
        }

        return Promise.resolve(joinPath(vaultDir, attachmentFolder));
    }

    loadSettings(): Promise<PandocExportSettings> {
        return Promise.resolve(this.config.settings);
    }

    saveSettings(settings: PandocExportSettings): Promise<void> {
        return this.config.saveSettings?.(settings) ?? Promise.resolve();
    }

    defaultOutputFolder(currentFilePath: string): string {
        return resolveDefaultOutputFolder({
            settings: this.config.settings,
            currentFilePath,
            vaultDir: this.vaultDir(),
            fullCurrentPath: this.fullPath(currentFilePath)
        });
    }

    exportVariables(
        request: PandocExportRequest,
        outputPath: string,
        pathDelimiter: string
    ): ExportVariables {
        return buildExportVariables({
            vault: this.exportVariableVault(),
            metadataCache: this.exportVariableMetadataCache(),
            currentFile: {
                path: request.currentFilePath,
                name: request.currentFileName,
                basename: request.currentFileBaseName
            },
            outputPath,
            pluginDir: this.pluginDir(),
            pathDelimiter
        });
    }

    vaultDir(): string {
        const adapter = this.config.app.vault.adapter as typeof this.config.app.vault.adapter & {
            getBasePath?: () => string;
        };

        return adapter.getBasePath?.() ?? '';
    }

    fullPath(path: string): string {
        const adapter = this.config.app.vault.adapter as typeof this.config.app.vault.adapter & {
            getFullPath?: (path: string) => string;
        };

        return adapter.getFullPath?.(path) ?? path;
    }

    pluginDir(): string {
        const vaultDir = this.vaultDir();
        if (this.config.manifest.dir) {
            return joinPath(vaultDir, this.config.manifest.dir);
        }

        return joinPath(vaultDir, this.configDir(), 'plugins', this.config.manifest.id);
    }

    private exportVariableVault(): ExportVariableVault {
        return this.config.app.vault;
    }

    private exportVariableMetadataCache(): ExportVariableMetadataCache {
        return this.config.app.metadataCache;
    }

    private vaultConfig(): { attachmentFolderPath?: string; useMarkdownLinks?: boolean } {
        const vault = this.config.app.vault as typeof this.config.app.vault & {
            config?: { attachmentFolderPath?: string; useMarkdownLinks?: boolean };
        };

        return vault.config ?? {};
    }

    private configDir(): string {
        const vault = this.config.app.vault as typeof this.config.app.vault & {
            configDir?: string;
        };

        return vault.configDir ?? '';
    }
}

function toCurrentFile(file: TFile): PandocCurrentFile {
    return {
        path: file.path,
        name: file.name,
        basename: file.basename
    };
}
