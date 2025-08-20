import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

export interface PandocListsSettings {
    strictPandocMode: boolean;
    autoRenumberLists: boolean;
}

export const DEFAULT_SETTINGS: PandocListsSettings = {
    strictPandocMode: false,
    autoRenumberLists: false
};

export class PandocListsSettingTab extends PluginSettingTab {
    plugin: Plugin & { settings: PandocListsSettings; saveSettings: () => Promise<void> };

    constructor(app: App, plugin: Plugin & { settings: PandocListsSettings; saveSettings: () => Promise<void> }) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Pandoc lists settings' });

        new Setting(containerEl)
            .setName('Strict pandoc mode')
            .setDesc('Enable strict pandoc formatting requirements. When enabled, lists must have empty lines before and after them, and capital letter lists require double spacing after markers.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.strictPandocMode)
                .onChange(async (value) => {
                    this.plugin.settings.strictPandocMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-renumber lists')
            .setDesc('Automatically renumber all list items when inserting a new item. This ensures proper sequential ordering of fancy lists (A, B, C... or i, ii, iii...) when you add items in the middle of a list.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoRenumberLists)
                .onChange(async (value) => {
                    this.plugin.settings.autoRenumberLists = value;
                    await this.plugin.saveSettings();
                }));
    }
}