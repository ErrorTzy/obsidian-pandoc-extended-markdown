import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

export interface PandocListsSettings {
    strictPandocMode: boolean;
}

export const DEFAULT_SETTINGS: PandocListsSettings = {
    strictPandocMode: false
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
    }
}