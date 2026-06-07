import { Notice, Platform, Setting } from 'obsidian';
import type { App, PluginManifest } from 'obsidian';

import { PandocExtendedMarkdownSettings } from '../../../../shared/types/settingsTypes';
import { PandocExportAdvancedSettingsModal } from './PandocExportAdvancedSettingsModal';
import { PandocProfileEditorModal } from '../modals/PandocProfileEditorModal';
import { addFolderBrowseButton } from '../modals/PandocPathBrowse';
import type {
    ObsidianPandocGuiDependencies
} from '../dependencies';
import {
    WEBODF_ADDON_VERSION
} from '../workspace/odtPreviewAddon';
import { joinPath } from '../../../core';
import type { PandocExportSettings } from '../../../core';

export interface PandocExportSettingsPlugin {
    app: App;
    manifest: PluginManifest;
    settings: PandocExtendedMarkdownSettings;
    saveSettings: () => Promise<void>;
}

type QueuedSettingsSave = () => Promise<void>;

export function renderPandocExportSettingsSection(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    dependencies: ObsidianPandocGuiDependencies
): void {
    if (!plugin.settings.pandocExport) return;
    const saveSettings = createQueuedSettingsSave(plugin);

    new Setting(containerEl)
        .setName('Pandoc export (beta)')
        .setDesc(Platform.isDesktop ?
            'Optional desktop-only export backend using Pandoc.' :
            'Pandoc export is available on desktop only.')
        .setHeading();

    if (!Platform.isDesktop) {
        return;
    }

    renderEnablePandocExportSetting(plugin, containerEl, saveSettings);
    renderPandocPathSetting(plugin, containerEl, dependencies, saveSettings);
    renderOutputFolderSettings(plugin, containerEl, dependencies, saveSettings);
    renderOdtAddonSettings(plugin, containerEl, dependencies);
    renderAdvancedSettings(plugin, containerEl, dependencies);
    renderProfileSettings(plugin, containerEl, dependencies);
}

function renderEnablePandocExportSetting(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    saveSettings: QueuedSettingsSave
): void {
    new Setting(containerEl)
        .setName('Enable pandoc export')
        .addToggle(toggle => toggle
            .setValue(plugin.settings.pandocExport?.enabled ?? false)
            .onChange(async value => {
                updatePandocExportSettings(plugin, settings => {
                    settings.enabled = value;
                });
                await saveSettings();
            }));
}

function renderPandocPathSetting(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    dependencies: ObsidianPandocGuiDependencies,
    saveSettings: QueuedSettingsSave
): void {
    new Setting(containerEl)
        .setName('Pandoc path')
        .setDesc('Leave blank to use pandoc from path.')
        .addText(text => text
            .setPlaceholder('Pandoc')
            .setValue(plugin.settings.pandocExport?.pandocPath ?? '')
            .onChange(async value => {
                updatePandocExportSettings(plugin, settings => {
                    settings.pandocPath = value;
                });
                await saveSettings();
            }))
        .addButton(button => button
            .setButtonText('Check')
            .onClick(async () => {
                const settings = plugin.settings.pandocExport;
                const version = await dependencies.catalogProcess?.getVersion({
                    pandocPath: settings?.pandocPath ?? ''
                });
                new Notice(version?.available ?
                    `Pandoc ${version.version} found` :
                    'Pandoc was not found');
            }));
}

function renderOutputFolderSettings(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    dependencies: ObsidianPandocGuiDependencies,
    saveSettings: QueuedSettingsSave
): void {
    const customOutputFolderContainer = document.createElement('div');
    const renderCustomOutputFolder = (): void => {
        customOutputFolderContainer.innerHTML = '';
        renderCustomOutputFolderSetting(
            plugin,
            customOutputFolderContainer,
            dependencies,
            saveSettings
        );
    };

    new Setting(containerEl)
        .setName('Default output folder')
        .addDropdown(dropdown => dropdown
            .addOptions({
                current: 'Current file folder',
                last: 'Last export folder',
                vault: 'Vault root',
                custom: 'Custom folder'
            })
            .setValue(plugin.settings.pandocExport?.defaultOutputFolderMode ?? 'current')
            .onChange(async value => {
                updatePandocExportSettings(plugin, settings => {
                    settings.defaultOutputFolderMode = value as typeof settings.defaultOutputFolderMode;
                });
                renderCustomOutputFolder();
                await saveSettings();
            }));

    containerEl.appendChild(customOutputFolderContainer);
    renderCustomOutputFolder();
}

function renderCustomOutputFolderSetting(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    dependencies: ObsidianPandocGuiDependencies,
    saveSettings: QueuedSettingsSave
): void {
    const settings = plugin.settings.pandocExport;
    if (!settings || settings.defaultOutputFolderMode !== 'custom') return;

    new Setting(containerEl)
        .setName('Custom output folder')
        .addText(text => {
            text
                .setValue(settings.customOutputFolder)
                .onChange(async value => {
                    updatePandocExportSettings(plugin, currentSettings => {
                        currentSettings.customOutputFolder = value;
                    });
                    await saveSettings();
                });
            addFolderBrowseButton(
                text.inputEl.parentElement ?? containerEl,
                text.inputEl,
                value => {
                    updatePandocExportSettings(plugin, currentSettings => {
                        currentSettings.customOutputFolder = value;
                    });
                    void saveSettings();
                },
                { browser: dependencies.pathBrowser }
            );
        });
}

function updatePandocExportSettings(
    plugin: PandocExportSettingsPlugin,
    update: (settings: PandocExportSettings) => void
): void {
    const settings = plugin.settings.pandocExport;
    if (!settings) return;
    update(settings);
}

function createQueuedSettingsSave(plugin: PandocExportSettingsPlugin): QueuedSettingsSave {
    let pending = false;
    let running = false;
    let currentSave = Promise.resolve();

    return () => {
        pending = true;
        if (!running) {
            running = true;
            currentSave = (async () => {
                try {
                    while (pending) {
                        pending = false;
                        await plugin.saveSettings();
                    }
                } finally {
                    running = false;
                }
            })();
        }

        return currentSave;
    };
}

function renderOdtAddonSettings(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    dependencies: ObsidianPandocGuiDependencies
): void {
    const settings = plugin.settings.pandocExport;
    if (!settings?.preview.odtAddon) return;

    const wrapper = document.createElement('div');
    containerEl.appendChild(wrapper);

    const render = (): void => {
        wrapper.innerHTML = '';
        const addon = settings.preview.odtAddon;

        new Setting(wrapper)
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .setName('ODT preview support')
            .setDesc(odtAddonStatusText(addon))
            .addButton(button => button
                .setButtonText('Install')
                .setDisabled(addon.status === 'installed')
                .onClick(async () => {
                    if (settings.preview.odtAddon.status === 'installed') return;
                    if (!confirmOdtAddonInstall()) return;
                    const result = await dependencies.installOdtPreviewAddon({
                        installDir: getAddonInstallDir(plugin)
                    });
                    settings.preview.odtAddon = result;
                    await plugin.saveSettings();
                    render();
                    new Notice(result.status === 'installed' ?
                        'ODT preview support installed.' :
                        result.lastError ?? 'ODT preview support install failed.');
                }))
            .addButton(button => button
                .setButtonText('Remove')
                .setDisabled(addon.status !== 'installed')
                .onClick(async () => {
                    const currentAddon = settings.preview.odtAddon;
                    if (currentAddon.status !== 'installed') return;
                    settings.preview.odtAddon = await dependencies.removeOdtPreviewAddon(currentAddon);
                    await plugin.saveSettings();
                    render();
                    // eslint-disable-next-line obsidianmd/ui/sentence-case
                    new Notice('ODT preview support removed.');
                }));
    };

    render();
}

function odtAddonStatusText(addon: NonNullable<PandocExportSettingsPlugin['settings']['pandocExport']>['preview']['odtAddon']): string {
    if (addon.status === 'installed') {
        return `Installed${addon.version ? ` (${addon.version})` : ''}.`;
    }
    if (addon.status === 'failed') {
        return `Install failed${addon.lastError ? `: ${addon.lastError}` : '.'}`;
    }
    return 'Not installed. ODT preview falls back to Pandoc-generated HTML.';
}

function confirmOdtAddonInstall(): boolean {
    // eslint-disable-next-line no-alert
    return window.confirm([
        `Install WebODF ${WEBODF_ADDON_VERSION} for enhanced ODT preview support?`,
        '',
        'WebODF is licensed under the AGPL. It is not bundled with this MIT-licensed plugin.',
        'The plugin will download the pinned archive, verify its SHA-256 checksum, and store it as add-on data.',
        'If you do not install it, ODT preview will continue to use the Pandoc fallback.'
    ].join('\n'));
}

function getAddonInstallDir(plugin: PandocExportSettingsPlugin): string {
    const adapter = plugin.app.vault.adapter as typeof plugin.app.vault.adapter & {
        getBasePath?: () => string;
    };
    const vault = plugin.app.vault as typeof plugin.app.vault & {
        configDir?: string;
    };

    return joinPath(
        adapter.getBasePath?.() ?? '',
        vault.configDir ?? '',
        'pandoc-preview-addons'
    );
}

function renderAdvancedSettings(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    dependencies: ObsidianPandocGuiDependencies
): void {
    new Setting(containerEl)
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        .setName('Advanced Pandoc settings')
        .setDesc('Edit process environment variables and template suggestion privacy options.')
        .addButton(button => button
            .setButtonText('Open advanced')
            .onClick(() => new PandocExportAdvancedSettingsModal(plugin, dependencies).open()));
}

function renderProfileSettings(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement,
    dependencies: ObsidianPandocGuiDependencies
): void {
    new Setting(containerEl)
        .setName('Export profiles')
        .setDesc('Open the structured pandoc profile editor.')
        .addButton(button => button
            .setButtonText('Edit pandoc export')
            .onClick(() => new PandocProfileEditorModal(plugin, dependencies).open()));
}
