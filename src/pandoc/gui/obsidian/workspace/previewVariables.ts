import type { App, PluginManifest, TFile } from 'obsidian';

import {
    basename,
    buildExportVariables,
    dirname,
    getPathExtension,
    joinPath,
    removeExtension
} from '../../../core';
import type {
    ExportVariableFile,
    ExportVariables,
    PandocExportSettings
} from '../../../core';

export interface BuildPreviewVariablesRequest {
    app: App;
    manifest: PluginManifest;
    settings?: PandocExportSettings;
    extension: string;
    pathDelimiter?: string;
    platformOs?: 'linux' | 'mac' | 'windows' | 'unknown';
}

interface FileLike {
    path: string;
    name?: string;
    basename?: string;
}

interface VaultConfigLike {
    attachmentFolderPath?: string;
    useMarkdownLinks?: boolean;
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
        luaFilterDir: joinNativePath(pluginDir, 'lua_filter'),
        pathDelimiter: getPathDelimiter(request)
    }), request);
}

export function buildOptionDisplayExportVariables(
    request: BuildPreviewVariablesRequest
): ExportVariables {
    const currentFile = getPreviewFile(request.app);
    const vaultConfig = getVaultConfig(request.app);
    const vaultDir = getVaultDir(request.app);
    const currentPath = currentFile.path;
    const currentDir = dirname(currentPath);
    const outputPath = getDisplayOutputPath(request, currentFile, currentDir, vaultDir);
    const pluginDir = getDisplayPluginDir(request.app, request.manifest, vaultDir);

    return {
        vaultDir: normalizePath(vaultDir, request),
        pluginDir: normalizePath(pluginDir, request),
        luaFilterDir: normalizePath(joinPath(pluginDir, 'lua_filter'), request),
        currentPath: normalizePath(currentPath, request),
        currentDir: normalizePath(currentDir, request),
        currentFileName: currentFile.basename ?? removeExtension(currentFile.name ?? currentFile.path),
        currentFileFullName: currentFile.name ?? basename(currentFile.path),
        outputPath: normalizePath(outputPath, request),
        outputDir: normalizePath(dirname(outputPath), request),
        outputFileName: removeExtension(basename(outputPath)),
        outputFileFullName: basename(outputPath),
        outputExtension: getPathExtension(outputPath),
        attachmentFolderPath: normalizePath(getDisplayAttachmentFolder(request.app, currentDir, vaultDir), request),
        embedDirs: normalizePathList(getDisplayEmbedDirs(request.app, currentFile, request), request),
        fromFormat: vaultConfig.useMarkdownLinks ?
            'markdown' :
            'markdown+wikilinks_title_after_pipe',
        metadata: request.app.metadataCache?.getCache?.(currentFile.path)?.frontmatter
    };
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

function getDisplayOutputPath(
    request: BuildPreviewVariablesRequest,
    currentFile: ExportVariableFile,
    currentDir: string,
    vaultDir: string
): string {
    const folder = getDisplayOutputFolder(request, currentDir, vaultDir);
    const baseName = currentFile.basename ?? removeExtension(currentFile.name ?? currentFile.path);

    return joinPath(folder, `${baseName}${request.extension}`);
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

function getDisplayOutputFolder(
    request: BuildPreviewVariablesRequest,
    currentDir: string,
    vaultDir: string
): string {
    const settings = request.settings;
    if (settings?.defaultOutputFolderMode === 'custom' && settings.customOutputFolder) {
        return settings.customOutputFolder;
    }
    if (settings?.defaultOutputFolderMode === 'last' && settings.lastOutputFolder) {
        return settings.lastOutputFolder;
    }
    if (settings?.defaultOutputFolderMode === 'vault') {
        return vaultDir;
    }

    return currentDir;
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

function getDisplayPluginDir(app: App, manifest: PluginManifest, vaultDir: string): string {
    if (manifest.dir) {
        return manifest.dir;
    }

    const vault = app.vault as typeof app.vault & {
        configDir?: string;
    };

    return joinPath(vault.configDir ?? '', 'plugins', manifest.id) || vaultDir;
}

function getDisplayAttachmentFolder(app: App, currentDir: string, vaultDir: string): string {
    const attachmentFolder = getVaultConfig(app).attachmentFolderPath ?? '/';
    if (attachmentFolder === '/') {
        return vaultDir;
    }

    if (attachmentFolder.startsWith('.')) {
        return joinPath(currentDir, attachmentFolder.replace(/^\.[\\/]?/, ''));
    }

    return attachmentFolder;
}

function getDisplayEmbedDirs(
    app: App,
    currentFile: ExportVariableFile,
    request: Pick<BuildPreviewVariablesRequest, 'pathDelimiter'>
): string {
    const cache = app.metadataCache;
    const embeds = cache?.getCache?.(currentFile.path)?.embeds ?? [];
    const dirs = new Set<string>();

    for (const embed of embeds) {
        const target = cache?.getFirstLinkpathDest?.(embed.link, currentFile.path);
        if (target?.path) {
            dirs.add(dirname(target.path));
        }
    }

    return Array.from(dirs).join(getPathDelimiter(request));
}

function getVaultConfig(app: App): VaultConfigLike {
    const vault = app.vault as typeof app.vault & {
        config?: VaultConfigLike;
    };

    return vault.config ?? {};
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

function normalizePathVariables(
    variables: ExportVariables,
    request: Pick<BuildPreviewVariablesRequest, 'pathDelimiter' | 'platformOs'>
): ExportVariables {
    return {
        ...variables,
        vaultDir: normalizePath(variables.vaultDir, request),
        pluginDir: normalizePath(variables.pluginDir, request),
        luaFilterDir: normalizePath(variables.luaFilterDir, request),
        currentPath: normalizePath(variables.currentPath, request),
        currentDir: normalizePath(variables.currentDir, request),
        outputPath: normalizePath(variables.outputPath, request),
        outputDir: normalizePath(variables.outputDir, request),
        attachmentFolderPath: normalizePath(variables.attachmentFolderPath, request),
        embedDirs: normalizePathList(variables.embedDirs, request)
    };
}

function normalizePathList(value: string, request: Pick<BuildPreviewVariablesRequest, 'pathDelimiter' | 'platformOs'>): string {
    const delimiter = getPathDelimiter(request);
    return value.split(delimiter)
        .map(path => normalizePath(path, request))
        .join(delimiter);
}

function normalizePath(
    path: string,
    request: Pick<BuildPreviewVariablesRequest, 'platformOs'> = {}
): string {
    if (request.platformOs !== 'windows') return path;
    return path.replace(/\//g, '\\');
}

function getPathDelimiter(request: Pick<BuildPreviewVariablesRequest, 'pathDelimiter'>): string {
    return request.pathDelimiter ?? ':';
}
