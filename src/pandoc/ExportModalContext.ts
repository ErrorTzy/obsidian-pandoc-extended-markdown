import type { TFile } from 'obsidian';

import { compileProfileDraft } from './gui-core';
import { dirname, extname, joinPath } from './pathUtils';
import { buildOptionDisplayExportVariables } from './previewVariables';
import { buildExportVariables } from './variables';
import {
    createPandocExportRequestFromFile,
    PandocExportManager
} from './PandocExportManager';
import type { PandocExportPluginLike } from './ExportModal';
import type { ExportProfile, ExportVariables, PandocExportRequest } from './types';
import type { PandocOptionCatalog, ProfileDraft } from './gui-core';

export function buildModalVariables(
    plugin: PandocExportPluginLike,
    currentFile: TFile,
    outputFolder: string,
    outputFileName: string
): ExportVariables {
    const pluginDir = getPluginDir(plugin);

    return buildExportVariables({
        vault: plugin.app.vault,
        metadataCache: plugin.app.metadataCache,
        currentFile,
        outputPath: joinPath(outputFolder, outputFileName),
        pluginDir,
        luaFilterDir: joinPath(pluginDir, 'lua_filter')
    });
}

export function buildModalDisplayVariables(
    plugin: PandocExportPluginLike,
    currentFile: TFile,
    outputFolder: string,
    outputFileName: string,
    draft: ProfileDraft,
    catalog?: PandocOptionCatalog
): ExportVariables {
    const profile = draft.type === 'pandoc' && catalog ?
        compileProfileDraft(draft, catalog) :
        undefined;
    const displayVariables = buildOptionDisplayExportVariables({
        app: plugin.app,
        manifest: plugin.manifest,
        settings: plugin.settings.pandocExport,
        extension: profile?.extension ?? draft.extension
    });
    const actualVariables = buildModalVariables(plugin, currentFile, outputFolder, outputFileName);

    return { ...displayVariables, ...actualVariables };
}

export function initialExportProfile(plugin: PandocExportPluginLike): ExportProfile {
    const settings = plugin.settings.pandocExport!;
    const id = settings.lastExportProfileId ?? settings.profiles[0]?.id;
    return settings.profiles.find(item => item.id === id) ?? settings.profiles[0];
}

export function currentFileFolder(plugin: PandocExportPluginLike, currentFile: TFile): string {
    const adapter = plugin.app.vault.adapter as typeof plugin.app.vault.adapter & {
        getFullPath?: (path: string) => string;
    };
    return dirname(adapter.getFullPath?.(currentFile.path) ?? currentFile.path);
}

export function getPluginDir(plugin: PandocExportPluginLike): string {
    const adapter = plugin.app.vault.adapter as typeof plugin.app.vault.adapter & {
        getBasePath?: () => string;
    };
    const vaultDir = adapter.getBasePath?.() ?? '';
    if (plugin.manifest.dir) {
        return joinPath(vaultDir, plugin.manifest.dir);
    }

    const vault = plugin.app.vault as typeof plugin.app.vault & { configDir?: string };
    return joinPath(vaultDir, vault.configDir ?? '', 'plugins', plugin.manifest.id);
}

export function outputExtension(fileName: string, fallback: string): string {
    return extname(fileName) || fallback;
}

export function createModalExportRequest(
    currentFile: TFile,
    profile: ExportProfile,
    outputFolder: string,
    outputFileName: string,
    overwrite: boolean
): PandocExportRequest {
    return createPandocExportRequestFromFile(currentFile, {
        profileId: profile.id,
        outputFolder,
        outputFileName,
        overwrite
    });
}

export function createModalExportManager(
    plugin: PandocExportPluginLike,
    profile: ExportProfile,
    persist: boolean
): PandocExportManager {
    const settings = plugin.settings.pandocExport!;
    return new PandocExportManager({
        app: plugin.app,
        manifest: plugin.manifest,
        settings: { ...settings, profiles: [profile] },
        saveSettings: persist ? () => plugin.saveSettings() : undefined
    });
}

export async function persistModalLastExport(
    plugin: PandocExportPluginLike,
    profile: ExportProfile,
    outputPath?: string
): Promise<void> {
    const settings = plugin.settings.pandocExport;
    if (!settings || !outputPath) return;
    settings.lastExportProfileId = profile.id;
    settings.lastOutputFolder = dirname(outputPath);
    await plugin.saveSettings();
}

export function replaceExtension(fileName: string, extension: string): string {
    const index = fileName.lastIndexOf('.');
    if (index <= 0) {
        return `${fileName}${extension}`;
    }

    return `${fileName.slice(0, index)}${extension}`;
}
