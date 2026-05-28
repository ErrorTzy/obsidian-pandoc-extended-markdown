import type { App, PluginManifest, TFile } from 'obsidian';

import {
    basename,
    dirname,
    joinPath,
    removeExtension
} from './pathUtils';
import type {
    ExportVariables,
    PandocExportSettings
} from './types';
import { buildExportVariables } from './variables';
import type { ExportVariableFile } from './variables';

export interface BuildPreviewVariablesRequest {
    app: App;
    manifest: PluginManifest;
    settings?: PandocExportSettings;
    extension: string;
}

interface FileLike {
    path: string;
    name?: string;
    basename?: string;
}

export function buildPreviewExportVariables(
    request: BuildPreviewVariablesRequest
): ExportVariables {
    const currentFile = getPreviewFile(request.app);
    const vaultDir = getVaultDir(request.app);
    const currentPath = getFullPath(request.app, currentFile.path, vaultDir);
    const outputPath = getPreviewOutputPath(
        request,
        currentFile,
        currentPath,
        vaultDir
    );
    const pluginDir = getPluginDir(request.app, request.manifest, vaultDir);

    return normalizePathVariables(buildExportVariables({
        vault: request.app.vault,
        metadataCache: request.app.metadataCache,
        currentFile,
        outputPath,
        pluginDir,
        luaFilterDir: joinNativePath(pluginDir, 'lua_filter')
    }));
}

function getPreviewFile(app: App): ExportVariableFile {
    const workspace = app.workspace as typeof app.workspace & {
        getActiveFile?: () => TFile | null;
    };
    const activeFile = workspace.getActiveFile?.();
    if (activeFile) return toExportFile(activeFile);

    return {
        path: 'Untitled.md',
        name: 'Untitled.md',
        basename: 'Untitled'
    };
}

function toExportFile(file: FileLike): ExportVariableFile {
    const name = file.name ?? basename(file.path);

    return {
        path: file.path,
        name,
        basename: file.basename ?? removeExtension(name)
    };
}

function getPreviewOutputPath(
    request: BuildPreviewVariablesRequest,
    currentFile: ExportVariableFile,
    currentPath: string,
    vaultDir: string
): string {
    const folder = getPreviewOutputFolder(request, currentPath, vaultDir);
    const baseName = currentFile.basename ?? removeExtension(currentFile.name ?? currentFile.path);

    return joinNativePath(folder, `${baseName}${request.extension}`);
}

function getPreviewOutputFolder(
    request: BuildPreviewVariablesRequest,
    currentPath: string,
    vaultDir: string
): string {
    const settings = request.settings;
    if (settings?.defaultOutputFolderMode === 'custom' && settings.customOutputFolder) {
        return toAbsolutePath(settings.customOutputFolder, vaultDir);
    }
    if (settings?.defaultOutputFolderMode === 'last' && settings.lastOutputFolder) {
        return toAbsolutePath(settings.lastOutputFolder, vaultDir);
    }
    if (settings?.defaultOutputFolderMode === 'vault') {
        return vaultDir;
    }

    return dirname(currentPath);
}

function getPluginDir(app: App, manifest: PluginManifest, vaultDir: string): string {
    if (manifest.dir) {
        return toAbsolutePath(manifest.dir, vaultDir);
    }

    const vault = app.vault as typeof app.vault & {
        configDir?: string;
    };

    return joinNativePath(vaultDir, vault.configDir ?? '', 'plugins', manifest.id);
}

function getVaultDir(app: App): string {
    const adapter = app.vault.adapter as typeof app.vault.adapter & {
        getBasePath?: () => string;
    };

    return adapter.getBasePath?.() ?? '';
}

function getFullPath(app: App, path: string, vaultDir: string): string {
    const adapter = app.vault.adapter as typeof app.vault.adapter & {
        getFullPath?: (path: string) => string;
    };

    return adapter.getFullPath?.(path) ?? joinNativePath(vaultDir, path);
}

function toAbsolutePath(path: string, basePath: string): string {
    if (isAbsolutePath(path) || !basePath) return normalizePath(path);
    return joinNativePath(basePath, path);
}

function isAbsolutePath(path: string): boolean {
    return path.startsWith('/') ||
        path.startsWith('\\\\') ||
        /^[A-Za-z]:[\\/]/.test(path);
}

function joinNativePath(...parts: string[]): string {
    return normalizePath(joinPath(...parts));
}

function normalizePathVariables(variables: ExportVariables): ExportVariables {
    return {
        ...variables,
        vaultDir: normalizePath(variables.vaultDir),
        pluginDir: normalizePath(variables.pluginDir),
        luaFilterDir: normalizePath(variables.luaFilterDir),
        currentPath: normalizePath(variables.currentPath),
        currentDir: normalizePath(variables.currentDir),
        outputPath: normalizePath(variables.outputPath),
        outputDir: normalizePath(variables.outputDir),
        attachmentFolderPath: normalizePath(variables.attachmentFolderPath),
        embedDirs: normalizePathList(variables.embedDirs)
    };
}

function normalizePathList(value: string): string {
    const delimiter = getPlatform() === 'win32' ? ';' : ':';
    return value.split(delimiter)
        .map(path => normalizePath(path))
        .join(delimiter);
}

function normalizePath(path: string): string {
    if (getPlatform() !== 'win32') return path;
    return path.replace(/\//g, '\\');
}

function getPlatform(): string {
    const processLike = globalThis as typeof globalThis & {
        process?: { platform?: string };
    };

    return processLike.process?.platform ?? '';
}
