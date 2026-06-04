import type { TFile } from 'obsidian';

import {
    buildExportVariables,
    compileProfileDraft,
    dirname,
    extname,
    joinPath
} from '../../../core';
import { buildOptionDisplayExportVariables } from '../workspace/previewVariables';
import {
    PandocExportManager
} from '../export';
import type {
    ObsidianPandocGuiDependencies
} from '../dependencies';
import type { PandocExportPluginLike } from './ExportModal';
import type {
    ExportProfile,
    ExportVariables,
    PandocOptionCatalog,
    ProfileDraft
} from '../../../core';

export function buildModalVariables(
    plugin: PandocExportPluginLike,
    currentFile: TFile,
    outputFolder: string,
    outputFileName: string,
    pathDelimiter = ':'
): ExportVariables {
    const pluginDir = getPluginDir(plugin);

    return buildExportVariables({
        vault: plugin.app.vault,
        metadataCache: plugin.app.metadataCache,
        currentFile,
        outputPath: joinPath(outputFolder, outputFileName),
        pluginDir,
        luaFilterDir: joinPath(pluginDir, 'lua_filter'),
        pathDelimiter
    });
}

export function buildModalDisplayVariables(
    plugin: PandocExportPluginLike,
    currentFile: TFile,
    outputFolder: string,
    outputFileName: string,
    draft: ProfileDraft,
    catalog?: PandocOptionCatalog,
    pathDelimiter = ':'
): ExportVariables {
    const profile = draft.type === 'pandoc' && catalog ?
        compileProfileDraft(draft, catalog) :
        undefined;
    const displayVariables = buildOptionDisplayExportVariables({
        app: plugin.app,
        manifest: plugin.manifest,
        settings: plugin.settings.pandocExport,
        extension: profile?.extension ?? draft.extension,
        pathDelimiter,
        platformOs: pathDelimiter === ';' ? 'windows' : undefined
    });
    const actualVariables = buildModalVariables(
        plugin,
        currentFile,
        outputFolder,
        outputFileName,
        pathDelimiter
    );

    return { ...displayVariables, ...actualVariables };
}

export function initialExportProfile(plugin: PandocExportPluginLike): ExportProfile {
    const settings = plugin.settings.pandocExport!;
    const id = selectedInitialProfileId(plugin);
    return settings.profiles.find(item => item.id === id) ?? settings.profiles[0];
}

export function selectedInitialProfileId(plugin: PandocExportPluginLike): string | undefined {
    const settings = plugin.settings.pandocExport;
    return settings?.lastExportProfileId ?? settings?.profiles[0]?.id;
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

export function createModalExportManager(
    plugin: PandocExportPluginLike,
    profile: ExportProfile,
    persist: boolean,
    dependencies: ObsidianPandocGuiDependencies
): PandocExportManager {
    const settings = plugin.settings.pandocExport!;
    return new PandocExportManager({
        app: plugin.app,
        manifest: plugin.manifest,
        settings: { ...settings, profiles: [profile] },
        saveSettings: persist ? () => plugin.saveSettings() : undefined,
        system: dependencies.exportSystem,
        platformEnvDefaults: dependencies.platformEnvDefaults,
        runtimeEnv: dependencies.runtimeEnv,
        user: dependencies.exportUser
    });
}

export function replaceExtension(fileName: string, extension: string): string {
    const index = fileName.lastIndexOf('.');
    if (index <= 0) {
        return `${fileName}${extension}`;
    }

    return `${fileName.slice(0, index)}${extension}`;
}
