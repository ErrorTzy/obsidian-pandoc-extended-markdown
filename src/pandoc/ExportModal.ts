import {
    App,
    Modal,
    Notice,
    PluginManifest,
    Setting,
    TFile
} from 'obsidian';

import { PandocExtendedMarkdownSettings } from '../shared/types/settingsTypes';
import { ElectronPandocDesktopAdapter } from './desktopAdapter';
import {
    createPandocExportRequestFromFile,
    PandocExportManager
} from './PandocExportManager';
import { splitCommandLineArgs } from './argParser';

export interface PandocExportPluginLike {
    app: App;
    manifest: PluginManifest;
    settings: PandocExtendedMarkdownSettings;
    saveSettings: () => Promise<void>;
}

export class PandocExportModal extends Modal {
    private readonly plugin: PandocExportPluginLike;
    private readonly currentFile: TFile;

    constructor(plugin: PandocExportPluginLike, currentFile: TFile) {
        super(plugin.app);
        this.plugin = plugin;
        this.currentFile = currentFile;
    }

    onOpen(): void {
        const settings = this.plugin.settings.pandocExport;
        if (!settings?.enabled) {
            new Notice('Pandoc export is disabled.');
            this.close();
            return;
        }

        const content = this.contentEl;
        content.empty();
        this.titleEl.setText('Export with pandoc');

        let profileId = settings.lastExportProfileId ?? settings.profiles[0]?.id;
        let profile = settings.profiles.find(item => item.id === profileId) ?? settings.profiles[0];
        let outputFolder = settings.lastOutputFolder ?? this.getCurrentFolder();
        let outputFileName = `${this.currentFile.basename}${profile?.extension ?? '.html'}`;
        let overwrite = !settings.showOverwriteConfirmation;
        let extraArgs = '';

        new Setting(content)
            .setName('Profile')
            .addDropdown(dropdown => dropdown
                .addOptions(Object.fromEntries(settings.profiles.map(item => [item.id, item.name])))
                .setValue(profileId ?? '')
                .onChange(value => {
                    profileId = value;
                    profile = settings.profiles.find(item => item.id === profileId) ?? profile;
                    outputFileName = replaceExtension(outputFileName, profile.extension);
                    fileNameInput?.setValue(outputFileName);
                }));

        let fileNameInput: { setValue: (value: string) => unknown } | undefined;
        new Setting(content)
            .setName('Output file')
            .addText(text => {
                fileNameInput = text;
                text.setValue(outputFileName)
                    .onChange(value => {
                        outputFileName = value;
                    });
            });

        let folderInput: { setValue: (value: string) => unknown } | undefined;
        new Setting(content)
            .setName('Output folder')
            .addText(text => {
                folderInput = text;
                text.setValue(outputFolder).onChange(value => {
                    outputFolder = value;
                });
            })
            .addExtraButton(button => button
                .setIcon('folder')
                .setTooltip('Choose folder')
                .onClick(async () => {
                    const selected = await new ElectronPandocDesktopAdapter().chooseFolder(outputFolder);
                    if (selected) {
                        outputFolder = selected;
                        folderInput?.setValue(selected);
                    }
                }));

        new Setting(content)
            .setName('Extra pandoc arguments')
            .addText(text => text
                .setPlaceholder('--citeproc')
                .onChange(value => {
                    extraArgs = value;
                }));

        new Setting(content)
            .setName('Replace existing file')
            .addToggle(toggle => toggle
                .setValue(overwrite)
                .onChange(value => {
                    overwrite = value;
                }));

        new Setting(content)
            .addButton(button => button
                .setButtonText('Export')
                .setCta()
                .onClick(async () => {
                    await this.export(profileId, outputFolder, outputFileName, overwrite, extraArgs);
                }));
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async export(
        profileId: string | undefined,
        outputFolder: string,
        outputFileName: string,
        overwrite: boolean,
        extraArgs: string
    ): Promise<void> {
        const settings = this.plugin.settings.pandocExport;
        if (!settings) return;

        const manager = new PandocExportManager({
            app: this.plugin.app,
            manifest: this.plugin.manifest,
            settings,
            saveSettings: () => this.plugin.saveSettings()
        });
        const result = await manager.exportFile(createPandocExportRequestFromFile(this.currentFile, {
            profileId,
            outputFolder,
            outputFileName,
            overwrite,
            extraArgs: splitCommandLineArgs(extraArgs)
        }));

        if (result.ok) {
            new Notice(`Exported ${result.outputPath}`);
            this.close();
            return;
        }

        new Notice(result.error ?? 'Pandoc export failed.', 8000);
    }

    private getCurrentFolder(): string {
        const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & {
            getFullPath?: (path: string) => string;
        };
        const fullPath = adapter.getFullPath?.(this.currentFile.path) ?? this.currentFile.path;
        const separator = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));

        return separator > 0 ? fullPath.slice(0, separator) : '';
    }
}

function replaceExtension(fileName: string, extension: string): string {
    const index = fileName.lastIndexOf('.');
    if (index <= 0) {
        return `${fileName}${extension}`;
    }

    return `${fileName.slice(0, index)}${extension}`;
}
