import {
    App,
    Modal,
    Notice,
    PluginManifest,
    TFile
} from 'obsidian';

import { PandocExtendedMarkdownSettings } from '../shared/types/settingsTypes';
import { ElectronPandocDesktopAdapter } from './desktopAdapter';
import {
    buildModalDisplayVariables,
    buildModalVariables,
    createModalExportManager,
    createModalExportRequest,
    currentFileFolder,
    initialExportProfile,
    outputExtension,
    persistModalLastExport,
    replaceExtension
} from './ExportModalContext';
import { PandocFormatEditorModal } from './PandocFormatEditor';
import { PandocOptionSearchModal } from './PandocOptionSearchModal';
import {
    renderCommandPreview,
    renderExportTarget,
    renderFooter,
    renderPresetOptions,
    renderPreviewPane,
    renderValidation
} from './ExportModalRenderers';
import { renderPandocRows } from './PandocCommandRows';
import {
    buildProfileDraftPreview,
    compileProfileDraft,
    createProfileDraft,
    hasValidationErrors,
    PandocCatalogService,
    validateProfileDraft
} from './gui-core';
import { PandocPreviewManager } from './previewManager';
import { buildTemplateVariableContext } from './templateVariables';
import type { ExportProfile } from './types';
import type {
    PandocOptionCatalog,
    ProfileDraft,
    ValidationIssue
} from './gui-core';

export interface PandocExportPluginLike {
    app: App;
    manifest: PluginManifest;
    settings: PandocExtendedMarkdownSettings;
    saveSettings: () => Promise<void>;
}
export class PandocExportModal extends Modal {
    private readonly plugin: PandocExportPluginLike;
    private readonly currentFile: TFile;
    private catalog?: PandocOptionCatalog;
    private draft?: ProfileDraft;
    private optionIndex = 0;
    private outputFolder = '';
    private outputFileName = '';
    private overwrite = false;
    private previewEl?: HTMLElement;
    private previewStatusEl?: HTMLElement;
    private previewBodyEl?: HTMLElement;
    private previewManager?: PandocPreviewManager;
    private refreshTimer?: number;
    private previewInFlight = false;
    private previewQueued = false;

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

        this.modalEl.addClass('pem-pandoc-export-preview-modal');
        this.titleEl.setText('Export with pandoc');
        this.outputFolder = settings.lastOutputFolder ?? currentFileFolder(this.plugin, this.currentFile);
        this.overwrite = !settings.showOverwriteConfirmation;
        this.renderLoading();
        void this.loadCatalog();
    }

    onClose(): void {
        window.clearTimeout(this.refreshTimer);
        void this.previewManager?.cleanup();
        this.modalEl.removeClass('pem-pandoc-export-preview-modal');
        this.contentEl.empty();
    }

    private async loadCatalog(): Promise<void> {
        const settings = this.plugin.settings.pandocExport;
        this.catalog = await new PandocCatalogService().loadCatalog({
            pandocPath: settings?.pandocPath
        });
        this.draft = createProfileDraft(initialExportProfile(this.plugin));
        this.outputFileName = `${this.currentFile.basename}${this.currentExtension()}`;
        this.render();
        this.refreshPreviewDebounced(0);
    }

    private renderLoading(): void {
        this.contentEl.empty();
        this.contentEl.createEl('p', { text: 'Loading pandoc options...' });
    }

    private render(): void {
        const content = this.contentEl;
        content.empty();
        if (!this.catalog || !this.draft) {
            this.renderLoading();
            return;
        }

        const layout = content.createDiv({ cls: 'pem-pandoc-export-preview-layout' });
        const previewPane = renderPreviewPane(layout, () => this.refreshPreviewDebounced(0));
        this.previewStatusEl = previewPane.statusEl;
        this.previewBodyEl = previewPane.bodyEl;
        const builder = layout.createDiv({ cls: 'pem-pandoc-command-builder pem-pandoc-export-builder' });
        this.previewEl = renderCommandPreview(builder, this.commandPreviewDisplay());
        renderPresetOptions(
            builder,
            this.plugin.settings.pandocExport?.profiles ?? [],
            this.draft.id,
            profileId => this.selectProfile(profileId)
        );
        renderExportTarget(builder, {
            outputFileName: this.outputFileName,
            outputFolder: this.outputFolder,
            overwrite: this.overwrite
        }, {
            onFileNameChange: value => {
                this.outputFileName = value;
                this.updateAfterDraftChange();
            },
            onFolderChange: value => {
                this.outputFolder = value;
                this.updateAfterDraftChange();
            },
            onChooseFolder: () => this.chooseOutputFolder(),
            onOverwriteChange: value => {
                this.overwrite = value;
            }
        });
        if (this.draft.type === 'pandoc') {
            this.renderCommandRows(builder, this.draft);
        }
        renderValidation(builder, this.currentValidationIssues());
        renderFooter(
            content,
            () => this.close(),
            () => {
                void this.export();
            }
        );
    }

    private renderCommandRows(container: HTMLElement, draft: ProfileDraft): void {
        renderPandocRows(container, draft, this.catalog!, {
            nextOptionIndex: () => this.optionIndex++,
            getVariables: () => this.buildVariables(),
            getDisplayVariables: current => this.buildDisplayVariables(current),
            getTemplateVariableContext: current => this.buildTemplateContext(current),
            getDisplayTemplateVariableContext: current => this.buildDisplayTemplateContext(current),
            openFormatEditor: (row, spec, current) => {
                new PandocFormatEditorModal(this.app, {
                    draft: current,
                    row,
                    spec,
                    catalog: this.catalog!,
                    getVariables: editorDraft => this.buildDisplayVariables(editorDraft),
                    onApply: value => {
                        row.value = value;
                        this.updateAfterDraftChange();
                        this.render();
                    }
                }).open();
            },
            openOptionSearch: onChoose => {
                new PandocOptionSearchModal(
                    this.app,
                    this.catalog!,
                    option => {
                        onChoose(option);
                        this.updateAfterDraftChange();
                    },
                    option => !['from', 'to', 'output'].includes(option.mapsTo ?? '')
                ).open();
            },
            render: () => {
                this.render();
                this.refreshPreviewDebounced();
            },
            updatePreview: () => this.updateAfterDraftChange()
        });
    }

    private selectProfile(profileId: string): void {
        const profile = this.plugin.settings.pandocExport?.profiles
            .find(item => item.id === profileId);
        if (!profile) return;

        this.draft = createProfileDraft(profile);
        this.outputFileName = replaceExtension(this.outputFileName, this.currentExtension());
        this.render();
        this.refreshPreviewDebounced(0);
    }

    private updateAfterDraftChange(): void {
        this.updateCommandPreview();
        this.refreshPreviewDebounced();
    }

    private updateCommandPreview(): void {
        if (!this.previewEl || !this.draft || !this.catalog) return;
        this.previewEl.setText(this.commandPreviewDisplay());
    }

    private commandPreviewDisplay(): string {
        if (!this.draft || !this.catalog) return '';
        return buildProfileDraftPreview(
            this.draft,
            this.catalog,
            this.buildTemplateContext(this.draft).variables
        ).display;
    }

    private async chooseOutputFolder(): Promise<void> {
        const selected = await new ElectronPandocDesktopAdapter().chooseFolder(this.outputFolder);
        if (selected) {
            this.outputFolder = selected;
            this.render();
            this.refreshPreviewDebounced();
        }
    }

    private refreshPreviewDebounced(delay = this.previewDelayMs()): void {
        window.clearTimeout(this.refreshTimer);
        this.refreshTimer = window.setTimeout(() => {
            void this.refreshPreview();
        }, delay);
    }

    private async refreshPreview(): Promise<void> {
        if (!this.previewBodyEl || !this.draft || !this.catalog) return;
        if (this.previewInFlight) {
            this.previewQueued = true;
            this.setPreviewStatus('Preview pending');
            return;
        }
        if (this.plugin.settings.pandocExport?.preview.enabled === false) {
            this.setPreviewStatus('Preview disabled');
            this.setPreviewMessage('Enable Pandoc preview in settings to render this pane.');
            return;
        }
        const issues = this.currentValidationIssues();
        if (hasValidationErrors(issues)) {
            this.setPreviewMessage('Fix command errors before previewing.');
            return;
        }

        const profile = this.currentProfile();
        if (profile.type !== 'pandoc') {
            this.setPreviewMessage('Preview is available for Pandoc profiles only.');
            return;
        }

        this.setPreviewStatus('Refreshing...');
        this.previewBodyEl.empty();
        this.previewBodyEl.createEl('p', { cls: 'pem-pandoc-preview-message', text: 'Rendering preview...' });

        const manager = this.getPreviewManager();
        this.previewInFlight = true;
        try {
            const result = await manager.refresh({
                request: createModalExportRequest(
                    this.currentFile,
                    profile,
                    this.outputFolder,
                    this.outputFileName,
                    this.overwrite
                ),
                to: profile.to,
                extension: outputExtension(this.outputFileName, profile.extension),
                container: this.previewBodyEl
            });
            if (!result) return;
            this.setPreviewStatus(result.ok ? 'Preview ready' : 'Preview failed');
            if (!result.ok) this.setPreviewMessage(result.error ?? 'Pandoc preview failed.');
        } catch (error) {
            this.setPreviewStatus('Preview failed');
            this.setPreviewMessage(error instanceof Error ? error.message : String(error));
        } finally {
            this.previewInFlight = false;
            if (this.previewQueued) {
                this.previewQueued = false;
                this.refreshPreviewDebounced(0);
            }
        }
    }

    private async export(): Promise<void> {
        if (!this.draft || !this.catalog) return;
        const errors = this.currentValidationIssues().filter(issue => issue.severity === 'error');
        if (errors.length > 0) {
            new Notice(`Fix ${errors.length} Pandoc export error(s) before exporting.`);
            return;
        }

        await this.previewManager?.cleanup();
        const profile = this.currentProfile();
        const manager = createModalExportManager(this.plugin, profile, true);
        const result = await manager.exportFile(createModalExportRequest(
            this.currentFile,
            profile,
            this.outputFolder,
            this.outputFileName,
            this.overwrite
        ));

        if (result.ok) {
            await persistModalLastExport(this.plugin, profile, result.outputPath);
            new Notice(`Exported ${result.outputPath}`);
            this.close();
            return;
        }

        new Notice(result.error ?? 'Pandoc export failed.', 8000);
    }

    private currentProfile(): ExportProfile {
        if (!this.draft || !this.catalog) {
            throw new Error('Pandoc export draft is not ready.');
        }

        return compileProfileDraft(this.draft, this.catalog);
    }

    private getPreviewManager(): PandocPreviewManager {
        if (!this.previewManager) {
            this.previewManager = new PandocPreviewManager({
                exportManager: {
                    previewFile: (request, outputPath) =>
                        createModalExportManager(this.plugin, this.currentProfile(), false)
                            .previewFile(request, outputPath),
                    convertPreviewFile: (inputPath, outputPath, to, cwd) =>
                        createModalExportManager(this.plugin, this.currentProfile(), false)
                            .convertPreviewFile(inputPath, outputPath, to, cwd)
                },
                settings: this.plugin.settings.pandocExport!
            });
        }
        return this.previewManager;
    }

    private currentValidationIssues(): ValidationIssue[] {
        if (!this.draft || !this.catalog) return [];
        return validateProfileDraft(this.draft, this.catalog, this.knownTemplateNames(this.draft));
    }

    private buildTemplateContext(draft: ProfileDraft) {
        return buildTemplateVariableContext(this.buildVariables(), {
            includeRuntimeEnv: this.plugin.settings.pandocExport?.suggestRuntimeEnvVariables === true
        });
    }

    private buildDisplayTemplateContext(draft: ProfileDraft) {
        return buildTemplateVariableContext(this.buildDisplayVariables(draft), {
            includeRuntimeEnv: this.plugin.settings.pandocExport?.suggestRuntimeEnvVariables === true
        });
    }

    private knownTemplateNames(draft: ProfileDraft): string[] {
        const context = this.buildTemplateContext(draft);
        return [...context.builtInNames, ...context.runtimeEnvNames];
    }

    private buildVariables() {
        return buildModalVariables(
            this.plugin,
            this.currentFile,
            this.outputFolder,
            this.outputFileName
        );
    }

    private buildDisplayVariables(draft: ProfileDraft) {
        return buildModalDisplayVariables(
            this.plugin,
            this.currentFile,
            this.outputFolder,
            this.outputFileName,
            draft,
            this.catalog
        );
    }

    private currentExtension(): string { return this.currentProfile().extension; }

    private previewDelayMs(): number { return this.plugin.settings.pandocExport?.preview.debounceMs ?? 700; }

    private setPreviewStatus(text: string): void { this.previewStatusEl?.setText(text); }

    private setPreviewMessage(text: string): void {
        this.previewBodyEl?.empty(); this.previewBodyEl?.createEl('p', { cls: 'pem-pandoc-preview-message', text });
    }

}
