import {
    Menu,
    Notice,
    Platform,
    Plugin,
    TAbstractFile,
    TFile
} from 'obsidian';

import { COMMANDS, MESSAGES } from '../../../../core/constants';
import { PandocExtendedMarkdownSettings } from '../../../../shared/types/settingsTypes';
import {
    createPandocExportRequestFromFile,
    PandocExportManager
} from '../export';
import type {
    ObsidianPandocGuiDependencies
} from '../dependencies';
import { PandocExportModal, PandocExportPluginLike } from '../modals/ExportModal';

export type PandocCommandPlugin = Plugin & PandocExportPluginLike & {
    settings: PandocExtendedMarkdownSettings;
};

export function registerPandocExportCommands(
    plugin: PandocCommandPlugin,
    dependencies: ObsidianPandocGuiDependencies
): void {
    if (!Platform.isDesktop) {
        return;
    }

    plugin.addCommand({
        id: COMMANDS.PANDOC_EXPORT,
        name: 'Export with pandoc',
        callback: () => openExportModalForActiveFile(plugin, dependencies)
    });

    plugin.addCommand({
        id: COMMANDS.PANDOC_EXPORT_PREVIOUS,
        name: 'Export with previous pandoc settings',
        callback: () => exportActiveFileWithPreviousSettings(plugin, dependencies)
    });

    plugin.registerEvent(plugin.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
        if (file instanceof TFile && isPandocExportEnabled(plugin)) {
            menu.addItem(item => item
                .setTitle('Export with pandoc')
                .setIcon('document')
                .onClick(() => new PandocExportModal(plugin, file, dependencies).open()));
        }
    }));
}

function openExportModalForActiveFile(
    plugin: PandocCommandPlugin,
    dependencies: ObsidianPandocGuiDependencies
): void {
    const file = plugin.app.workspace.getActiveFile();
    if (!file) {
        new Notice(MESSAGES.NO_ACTIVE_FILE);
        return;
    }
    if (!isPandocExportEnabled(plugin)) {
        new Notice('Pandoc export is disabled.');
        return;
    }

    new PandocExportModal(plugin, file, dependencies).open();
}

async function exportActiveFileWithPreviousSettings(
    plugin: PandocCommandPlugin,
    dependencies: ObsidianPandocGuiDependencies
): Promise<void> {
    const file = plugin.app.workspace.getActiveFile();
    const settings = plugin.settings.pandocExport;
    if (!file) {
        new Notice(MESSAGES.NO_ACTIVE_FILE);
        return;
    }
    if (!isPandocExportEnabled(plugin)) {
        new Notice('Pandoc export is disabled.');
        return;
    }
    if (!settings?.lastExportProfileId || !settings.lastOutputFolder) {
        new PandocExportModal(plugin, file, dependencies).open();
        return;
    }

    const manager = new PandocExportManager({
        app: plugin.app,
        manifest: plugin.manifest,
        settings,
        saveSettings: () => plugin.saveSettings(),
        system: dependencies.exportSystem,
        platformEnvDefaults: dependencies.platformEnvDefaults,
        user: dependencies.exportUser
    });
    const result = await manager.exportFile(createPandocExportRequestFromFile(file, {
        profileId: settings.lastExportProfileId,
        outputFolder: settings.lastOutputFolder
    }));

    new Notice(result.ok ? `Exported ${result.outputPath}` : result.error ?? 'Pandoc export failed.', 8000);
}

function isPandocExportEnabled(plugin: PandocCommandPlugin): boolean {
    return plugin.settings.pandocExport?.enabled === true;
}
