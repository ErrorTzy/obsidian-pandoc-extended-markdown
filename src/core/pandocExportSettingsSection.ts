import { Notice, Platform, Setting } from 'obsidian';
import type { App, PluginManifest } from 'obsidian';

import { PandocService } from '../pandoc';
import { PandocExtendedMarkdownSettings } from '../shared/types/settingsTypes';
import { PandocProfileEditorModal } from '../pandoc/PandocProfileEditorModal';

export interface PandocExportSettingsPlugin {
    app: App;
    manifest: PluginManifest;
    settings: PandocExtendedMarkdownSettings;
    saveSettings: () => Promise<void>;
}

export function renderPandocExportSettingsSection(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement
): void {
    const settings = plugin.settings.pandocExport;
    if (!settings) return;

    new Setting(containerEl)
        .setName('Pandoc export')
        .setDesc(Platform.isDesktop ?
            'Optional desktop-only export backend using Pandoc.' :
            'Pandoc export is available on desktop only.')
        .setHeading();

    if (!Platform.isDesktop) {
        return;
    }

    new Setting(containerEl)
        .setName('Enable pandoc export')
        .addToggle(toggle => toggle
            .setValue(settings.enabled)
            .onChange(async value => {
                settings.enabled = value;
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Pandoc path')
        .setDesc('Leave blank to use pandoc from path.')
        .addText(text => text
            .setPlaceholder('Pandoc')
            .setValue(settings.pandocPath)
            .onChange(async value => {
                settings.pandocPath = value;
                await plugin.saveSettings();
            }))
        .addButton(button => button
            .setButtonText('Check')
            .onClick(async () => {
                const version = await new PandocService().getVersion({
                    pandocPath: settings.pandocPath
                });
                new Notice(version.available ?
                    `Pandoc ${version.version} found` :
                    'Pandoc was not found');
            }));

    new Setting(containerEl)
        .setName('Default output folder')
        .addDropdown(dropdown => dropdown
            .addOptions({
                current: 'Current file folder',
                last: 'Last export folder',
                vault: 'Vault root',
                custom: 'Custom folder'
            })
            .setValue(settings.defaultOutputFolderMode)
            .onChange(async value => {
                settings.defaultOutputFolderMode = value as typeof settings.defaultOutputFolderMode;
                await plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Custom output folder')
        .addText(text => text
            .setValue(settings.customOutputFolder)
            .onChange(async value => {
                settings.customOutputFolder = value;
                await plugin.saveSettings();
            }));

    renderBooleanSettings(plugin, containerEl);
    renderJsonSettings(plugin, containerEl);
}

function renderBooleanSettings(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement
): void {
    const settings = plugin.settings.pandocExport;
    if (!settings) return;

    const toggles: Array<[string, keyof typeof settings]> = [
        ['Confirm before replacing files', 'showOverwriteConfirmation'],
        ['Open output file after export', 'openOutputFile'],
        ['Reveal output file after export', 'revealOutputFile'],
        ['Show progress notices', 'showProgress']
    ];

    for (const [name, key] of toggles) {
        new Setting(containerEl)
            .setName(name)
            .addToggle(toggle => toggle
                .setValue(Boolean(settings[key]))
                .onChange(async value => {
                    settings[key] = value as never;
                    await plugin.saveSettings();
                }));
    }
}

function renderJsonSettings(
    plugin: PandocExportSettingsPlugin,
    containerEl: HTMLElement
): void {
    const settings = plugin.settings.pandocExport;
    if (!settings) return;

    new Setting(containerEl)
        .setName('Environment overrides')
        .setDesc('JSON object. Values support simple ${name} variables.')
        .addTextArea(text => text
            .setValue(JSON.stringify(settings.env, null, 2))
            .onChange(async value => {
                await updateJson(value, object => {
                    settings.env = object as Record<string, string>;
                }, plugin);
            }));

    new Setting(containerEl)
        .setName('Export profiles')
        .setDesc('Open the structured pandoc profile editor.')
        .addButton(button => button
            .setButtonText('Edit pandoc export')
            .onClick(() => new PandocProfileEditorModal(plugin).open()));
}

async function updateJson(
    value: string,
    update: (parsed: unknown) => void,
    plugin: PandocExportSettingsPlugin
): Promise<void> {
    try {
        update(JSON.parse(value));
        await plugin.saveSettings();
    } catch {
        new Notice('Invalid JSON; changes were not saved.');
    }
}
