import {
    basename,
    dirname,
    joinPath,
    removeExtension
} from '../utils/pathUtils';
import { getPathExtension } from './outputExtension';
import { ExportVariables } from './types';

export interface ExportVariableFile {
    path: string;
    name?: string;
    basename?: string;
}

export interface ExportVariableAdapter {
    getBasePath?: () => string;
    getFullPath?: (path: string) => string;
}

export interface ExportVariableVault {
    adapter?: ExportVariableAdapter;
    config?: {
        attachmentFolderPath?: string;
        useMarkdownLinks?: boolean;
    };
}

export interface ExportVariableMetadataCache {
    getCache?: (path: string) => {
        frontmatter?: Record<string, unknown>;
        embeds?: Array<{ link: string }>;
    } | null;
    getFirstLinkpathDest?: (link: string, sourcePath: string) => ExportVariableFile | null;
}

export interface BuildExportVariablesRequest {
    vault?: ExportVariableVault;
    metadataCache?: ExportVariableMetadataCache;
    currentFile: ExportVariableFile;
    outputPath: string;
    pluginDir: string;
    luaFilterDir?: string;
    pathDelimiter?: string;
}

export function buildExportVariables(request: BuildExportVariablesRequest): ExportVariables {
    const adapter = request.vault?.adapter;
    const vaultDir = adapter?.getBasePath?.() ?? '';
    const currentPath = adapter?.getFullPath?.(request.currentFile.path) ??
        joinPath(vaultDir, request.currentFile.path);
    const currentDir = dirname(currentPath);
    const outputDir = dirname(request.outputPath);
    const outputFileFullName = basename(request.outputPath);
    const currentFileFullName = request.currentFile.name ?? basename(currentPath);
    const currentFileName = request.currentFile.basename ?? removeExtension(currentFileFullName);

    return {
        vaultDir,
        pluginDir: request.pluginDir,
        luaFilterDir: request.luaFilterDir ?? joinPath(request.pluginDir, 'lua_filter'),
        currentPath,
        currentDir,
        currentFileName,
        currentFileFullName,
        outputPath: request.outputPath,
        outputDir,
        outputFileName: removeExtension(outputFileFullName),
        outputFileFullName,
        outputExtension: getPathExtension(outputFileFullName),
        attachmentFolderPath: resolveAttachmentFolder(vaultDir, currentDir, request.vault),
        embedDirs: getEmbedDirs(request, vaultDir),
        fromFormat: request.vault?.config?.useMarkdownLinks ?
            'markdown' :
            'markdown+wikilinks_title_after_pipe',
        metadata: request.metadataCache?.getCache?.(request.currentFile.path)?.frontmatter
    };
}

function resolveAttachmentFolder(
    vaultDir: string,
    currentDir: string,
    vault?: ExportVariableVault
): string {
    const attachmentFolder = vault?.config?.attachmentFolderPath ?? '/';
    if (attachmentFolder === '/') {
        return vaultDir;
    }

    if (attachmentFolder.startsWith('.')) {
        return joinPath(currentDir, attachmentFolder.slice(1));
    }

    return joinPath(vaultDir, attachmentFolder);
}

function getEmbedDirs(request: BuildExportVariablesRequest, vaultDir: string): string {
    const cache = request.metadataCache;
    const embeds = cache?.getCache?.(request.currentFile.path)?.embeds ?? [];
    const dirs = new Set<string>();

    for (const embed of embeds) {
        const target = cache?.getFirstLinkpathDest?.(embed.link, request.currentFile.path);
        if (target?.path) {
            dirs.add(dirname(joinPath(vaultDir, target.path)));
        }
    }

    return Array.from(dirs).join(request.pathDelimiter ?? ':');
}
