import {
    App,
    Modal,
    Notice,
    PluginManifest,
    TFile
} from 'obsidian';

import { PandocExtendedMarkdownSettings } from '../../../../shared/types/settingsTypes';
import {
    buildModalDisplayVariables,
    buildModalVariables,
    createModalExportManager,
    currentFileFolder,
    initialOutputFolder,
    selectedInitialProfileId
} from './ExportModalContext';
import { PandocExportModalActions } from './ExportModalActions';
import { PandocFormatEditorModal } from './PandocFormatEditor';
import { PandocOptionSearchModal } from './PandocOptionSearchModal';
import type {
    ObsidianPandocGuiDependencies
} from '../dependencies';
import {
    renderCommandPreview,
    renderFooter,
    renderPreviewPane,
    renderValidation
} from './ExportModalRenderers';
import {
    renderExportModalOutputActions
} from './ExportModalOutputActions';
import {
    renderExportModalPresetOptions
} from './ExportModalPresetActions';
import { renderPandocRows } from './PandocCommandRows';
import {
    buildTemplateVariableContext,
    PandocCatalogService,
    PandocCoreExportController
} from '../../../core';
import {
    ObsidianPandocUserInteractionPort
} from '../notices/userInteractionPort';
import type {
    ExportProfile,
    PandocOptionCatalog,
    PandocExportRequest,
    ProfileDraft,
    ValidationIssue
} from '../../../core';

export interface PandocExportPluginLike {
    app: App;
    manifest: PluginManifest;
    settings: PandocExtendedMarkdownSettings;
    saveSettings: () => Promise<void>;
}
export class PandocExportModal extends Modal {
    private readonly plugin: PandocExportPluginLike;
    private readonly currentFile: TFile;
    private readonly dependencies: ObsidianPandocGuiDependencies;
    private readonly actions: PandocExportModalActions;
    private catalog?: PandocOptionCatalog;
    private controller?: PandocCoreExportController;
    private previewEl?: HTMLElement;
    private previewStatusEl?: HTMLElement;
    private previewRefreshButtonEl?: HTMLButtonElement;
    private previewBodyEl?: HTMLElement;
    private commandOptionsOpen = false;

    constructor(
        plugin: PandocExportPluginLike,
        currentFile: TFile,
        dependencies: ObsidianPandocGuiDependencies
    ) {
        super(plugin.app);
        this.plugin = plugin;
        this.currentFile = currentFile;
        this.dependencies = dependencies;
        this.actions = new PandocExportModalActions({
            plugin,
            dependencies,
            getController: () => this.controller,
            getPreviewBodyEl: () => this.previewBodyEl,
            getProfile: () => this.currentProfile(),
            setPreviewStatus: text => this.setPreviewStatus(text),
            setPreviewMessage: text => this.setPreviewMessage(text),
            close: () => this.close()
        });
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
        this.renderLoading();
        void this.loadCatalog();
    }

    onClose(): void {
        void this.actions.cleanup();
        this.modalEl.removeClass('pem-pandoc-export-preview-modal');
        this.contentEl.empty();
    }

    private async loadCatalog(): Promise<void> {
        const settings = this.plugin.settings.pandocExport;
        this.catalog = await new PandocCatalogService({
            service: this.dependencies.catalogProcess,
            shellRunner: this.dependencies.catalogShellRunner
        }).loadCatalog({
            pandocPath: settings?.pandocPath
        });
        this.controller = new PandocCoreExportController({
            profiles: settings?.profiles ?? [],
            catalog: this.catalog,
            currentFileBaseName: this.currentFile.basename,
            initialProfileId: selectedInitialProfileId(this.plugin),
            initialOutputFolder: initialOutputFolder(this.plugin, this.currentFile),
            initialOverwrite: !settings?.showOverwriteConfirmation,
            commandPreviewPlatform: this.commandPreviewPlatform(),
            runtime: {
                settings: settings!,
                user: new ObsidianPandocUserInteractionPort({
                    createNotice: (message, timeout) => new Notice(message, timeout)
                }),
                cleanupPreview: async () => {
                    await this.actions.cleanup();
                },
                getExportRequest: () => this.currentExportRequest(),
                getValidationIssues: () => this.currentValidationIssues(),
                renderPreview: request => this.actions.renderPreview(request),
                runExport: request =>
                    createModalExportManager(
                        this.plugin,
                        this.currentProfile(),
                        false,
                        this.dependencies
                    )
                        .exportFile(request),
                saveSettings: () => this.plugin.saveSettings()
            }
        });
        this.render();
        this.actions.refreshPreviewDebounced(0);
    }

    private renderLoading(): void {
        this.contentEl.empty();
        this.contentEl.createEl('p', { text: 'Loading pandoc options...' });
    }

    private render(): void {
        const content = this.contentEl;
        content.empty();
        if (!this.catalog || !this.controller) {
            this.renderLoading();
            return;
        }

        const draft = this.controller.currentDraft();
        const layout = content.createDiv({ cls: 'pem-pandoc-export-preview-layout' });
        const previewPane = renderPreviewPane(layout, () => this.actions.refreshPreviewDebounced(0));
        this.previewStatusEl = previewPane.statusEl;
        this.previewRefreshButtonEl = previewPane.refreshButtonEl;
        this.previewBodyEl = previewPane.bodyEl;
        const builder = layout.createDiv({ cls: 'pem-pandoc-command-builder pem-pandoc-export-builder' });
        this.previewEl = renderCommandPreview(builder, this.commandPreviewDisplay());
        renderExportModalOutputActions(builder, this.plugin, this.controller);
        renderExportModalPresetOptions(builder, {
            plugin: this.plugin,
            controller: this.controller,
            catalog: this.catalog,
            knownTemplateNames: draft => this.knownTemplateNames(draft),
            selectProfile: profileId => {
                void this.selectProfile(profileId);
            },
            onDraftChange: () => this.updateAfterDraftChange(),
            render: () => this.render(),
            refreshPreviewNow: () => this.actions.refreshPreviewDebounced(0)
        });
        if (draft.type === 'pandoc') {
            this.renderCommandRows(builder, draft);
        }
        renderValidation(builder, this.currentValidationIssues());
        renderFooter(
            content,
            () => this.close(),
            () => {
                void this.actions.export();
            }
        );
    }

    private renderCommandRows(container: HTMLElement, draft: ProfileDraft): void {
        renderPandocRows(
            container,
            draft,
            this.catalog!,
            {
                nextOptionIndex: () => this.controller!.nextOptionIndex(),
                getVariables: () => this.buildVariables(),
                getDisplayVariables: current => this.buildDisplayVariables(current),
                getTemplateVariableContext: current => this.buildTemplateContext(current),
                getDisplayTemplateVariableContext: current => this.buildDisplayTemplateContext(current),
                pathBrowser: this.dependencies.pathBrowser,
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
                    this.actions.refreshPreviewDebounced();
                },
                updatePreview: () => this.updateAfterDraftChange()
            },
            {
                open: this.commandOptionsOpen,
                onToggle: open => {
                    this.commandOptionsOpen = open;
                }
            }
        );
    }

    private async selectProfile(profileId: string): Promise<void> {
        if (!this.controller) return;

        try {
            await this.controller.selectProfile(profileId);
        } catch {
            return;
        }

        this.render();
        this.actions.refreshPreviewDebounced(0);
    }

    private updateAfterDraftChange(): void {
        this.updateCommandPreview();
        this.refreshTemplateDisplays();
        this.actions.refreshPreviewDebounced();
    }

    private updateCommandPreview(): void {
        if (!this.previewEl || !this.controller || !this.catalog) return;
        this.previewEl.setText(this.commandPreviewDisplay());
    }

    private refreshTemplateDisplays(): void {
        this.contentEl
            .querySelectorAll<HTMLInputElement>('.pem-pandoc-string-input')
            .forEach(input => input.dispatchEvent(new Event('pem-pandoc-refresh-display')));
    }

    private commandPreviewDisplay(): string {
        if (!this.controller || !this.catalog) return '';
        const draft = this.controller.currentDraft();
        return this.controller.commandPreview(this.buildTemplateContext(draft).variables).display;
    }

    private currentProfile(): ExportProfile {
        if (!this.controller || !this.catalog) {
            throw new Error('Pandoc export draft is not ready.');
        }

        return this.controller.currentProfile();
    }

    private currentExportRequest(): PandocExportRequest {
        const outputFileName = this.controller?.outputFileNameForProfile() ??
            `${this.currentFile.basename}${this.currentProfile().extension}`;
        const variables = buildTemplateVariableContext(buildModalVariables(
            this.plugin,
            this.currentFile,
            this.controller?.currentOutputFolder() ?? currentFileFolder(this.plugin, this.currentFile),
            outputFileName,
            this.pathDelimiter()
        ), {
            includeRuntimeEnv: this.plugin.settings.pandocExport?.suggestRuntimeEnvVariables === true,
            runtimeEnv: this.dependencies.runtimeEnv
        }).variables;
        return this.controller!.exportRequest(this.currentFile, variables);
    }

    private currentValidationIssues(): ValidationIssue[] {
        if (!this.controller || !this.catalog) return [];
        const draft = this.controller.currentDraft();
        return this.controller.validationIssues(this.knownTemplateNames(draft));
    }

    private buildTemplateContext(draft: ProfileDraft) {
        return buildTemplateVariableContext(this.buildVariables(), {
            includeRuntimeEnv: this.plugin.settings.pandocExport?.suggestRuntimeEnvVariables === true,
            runtimeEnv: this.dependencies.runtimeEnv
        });
    }

    private buildDisplayTemplateContext(draft: ProfileDraft) {
        return buildTemplateVariableContext(this.buildDisplayVariables(draft), {
            includeRuntimeEnv: this.plugin.settings.pandocExport?.suggestRuntimeEnvVariables === true,
            runtimeEnv: this.dependencies.runtimeEnv
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
            this.controller?.currentOutputFolder() ?? currentFileFolder(this.plugin, this.currentFile),
            this.outputFileNameForVariables(),
            this.pathDelimiter()
        );
    }

    private buildDisplayVariables(draft: ProfileDraft) {
        return buildModalDisplayVariables(
            this.plugin,
            this.currentFile,
            this.controller?.currentOutputFolder() ?? currentFileFolder(this.plugin, this.currentFile),
            this.outputFileNameForVariables(),
            draft,
            this.catalog,
            this.pathDelimiter()
        );
    }

    private outputFileNameForVariables(): string {
        return this.controller?.outputFileNameForProfile() ?? `${this.currentFile.basename}.html`;
    }

    private commandPreviewPlatform(): 'posix' | 'windows' {
        return this.dependencies.exportSystem.platform().os === 'windows' ? 'windows' : 'posix';
    }

    private pathDelimiter(): string {
        return this.dependencies.exportSystem.pathDelimiter();
    }

    private setPreviewStatus(text: string): void {
        this.previewStatusEl?.setText(text);
        this.updatePreviewRefreshButton(text);
    }

    private updatePreviewRefreshButton(status: string): void {
        if (!this.previewRefreshButtonEl) return;

        const loading = status === 'Refreshing...' || status === 'Preview pending';
        this.previewRefreshButtonEl.disabled = loading;
        this.previewRefreshButtonEl.classList.toggle('is-loading', loading);
        this.previewRefreshButtonEl.setText(loading ? '' : 'Refresh');
        this.previewRefreshButtonEl.setAttribute('aria-label', loading ? status : 'Refresh');
    }

    private setPreviewMessage(text: string): void {
        this.previewBodyEl?.empty(); this.previewBodyEl?.createEl('p', { cls: 'pem-pandoc-preview-message', text });
    }

}
