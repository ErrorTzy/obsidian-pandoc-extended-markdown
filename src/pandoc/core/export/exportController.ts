import type {
    PandocExportController,
    PandocOptionRowPatch,
    PandocOutputTarget,
    PandocPreviewPlan,
    PandocUserInteractionPort
} from '../ports';
import type {
    CommandPreview,
    PandocOptionCatalog,
    ProfileDraft,
    ValidationIssue
} from '../types';
import {
    extname
} from '../utils/pathUtils';
import {
    hasValidationErrors
} from '../validation';
import type {
    ExportProfile,
    ExportVariables,
    PandocExportRequest,
    PandocExportResult,
    PandocExportSettings
} from './types';
import {
    PandocExportDraftController
} from './exportDraftController';
import type {
    PandocExportDraftControllerConfig,
    PandocExportDraftCurrentFile
} from './exportDraftController';

export interface PandocExportControllerCallbacks {
    cancel?: () => Promise<void>;
    export?: () => Promise<PandocExportResult>;
    refreshPreview?: () => Promise<PandocPreviewPlan>;
}

export interface PandocControllerPreviewRequest {
    request: PandocExportRequest;
    to: string;
    extension: string;
}

export interface PandocExportControllerRuntime {
    settings: PandocExportSettings;
    user?: Pick<PandocUserInteractionPort, 'showError' | 'showProgress' | 'showSuccess'>;
    cleanupPreview?: () => Promise<void>;
    getExportRequest?: () => PandocExportRequest;
    getValidationIssues?: () => ValidationIssue[];
    renderPreview?: (request: PandocControllerPreviewRequest) => Promise<PandocPreviewPlan>;
    runExport?: (request: PandocExportRequest) => Promise<PandocExportResult>;
    saveSettings?: () => Promise<void>;
}

export interface PandocCoreExportControllerConfig extends PandocExportDraftControllerConfig {
    callbacks?: PandocExportControllerCallbacks;
    runtime?: PandocExportControllerRuntime;
}

export class PandocCoreExportController implements PandocExportController {
    private readonly callbacks: PandocExportControllerCallbacks;
    private readonly catalog: PandocOptionCatalog;
    private readonly draftController: PandocExportDraftController;
    private readonly runtime?: PandocExportControllerRuntime;

    constructor(config: PandocCoreExportControllerConfig) {
        this.callbacks = config.callbacks ?? {};
        this.catalog = config.catalog;
        this.draftController = new PandocExportDraftController(config);
        this.runtime = config.runtime;
    }

    loadCatalog(): Promise<PandocOptionCatalog> {
        return Promise.resolve(this.catalog);
    }

    selectProfile(profileId: string): Promise<ProfileDraft> {
        const draft = this.draftController.selectProfile(profileId);
        if (!draft) {
            return Promise.reject(new Error('Pandoc export profile not found.'));
        }

        return Promise.resolve(draft);
    }

    editOptionRow(rowId: string, patch: PandocOptionRowPatch): Promise<ProfileDraft> {
        const row = this.currentDraft().optionRows.find(item => item.id === rowId);
        if (!row) {
            return Promise.reject(new Error('Pandoc option row not found.'));
        }

        Object.assign(row, patch);
        return Promise.resolve(this.currentDraft());
    }

    setOutputTarget(target: PandocOutputTarget): Promise<void> {
        if (target.folder !== undefined) {
            this.draftController.updateOutputFolder(target.folder);
        }
        if (target.fileName !== undefined) {
            this.draftController.updateOutputFileName(target.fileName);
        }
        if (target.overwrite !== undefined) {
            this.draftController.setOverwrite(target.overwrite);
        }

        return Promise.resolve();
    }

    async refreshPreview(): Promise<PandocPreviewPlan> {
        if (!this.runtime) {
            return this.callbacks.refreshPreview?.() ?? {
                error: 'Pandoc preview is not configured.'
            };
        }
        if (this.runtime.settings.preview.enabled === false) {
            return { error: 'Enable Pandoc preview in settings to render this pane.' };
        }
        if (hasValidationErrors(this.runtime.getValidationIssues?.() ?? [])) {
            return { error: 'Fix command errors before previewing.' };
        }

        const profile = this.currentProfile();
        if (profile.type !== 'pandoc') {
            return { profile, error: 'Preview is available for Pandoc profiles only.' };
        }
        if (!this.runtime.renderPreview || !this.runtime.getExportRequest) {
            return { profile, error: 'Pandoc preview is not configured.' };
        }

        const request = this.runtime.getExportRequest();
        return this.runtime.renderPreview({
            request,
            to: profile.to,
            extension: extname(request.outputFileName ?? '') || profile.extension
        });
    }

    async export(): Promise<PandocExportResult> {
        if (!this.runtime) {
            return this.callbacks.export?.() ?? {
                ok: false,
                error: 'Pandoc export is not configured.'
            };
        }

        const errors = (this.runtime.getValidationIssues?.() ?? [])
            .filter(issue => issue.severity === 'error');
        if (errors.length > 0) {
            return this.failExport(`Fix ${errors.length} Pandoc export error(s) before exporting.`);
        }
        if (!this.runtime.runExport || !this.runtime.getExportRequest) {
            return this.failExport('Pandoc export is not configured.');
        }

        await this.runtime.cleanupPreview?.();
        const progress = this.runtime.user?.showProgress('Exporting with Pandoc...');

        try {
            const result = await this.runtime.runExport(this.runtime.getExportRequest());
            if (!result.ok) {
                return this.failExport(result.error ?? 'Pandoc export failed.', result);
            }

            this.recordSuccessfulExport(this.runtime.settings, result.outputPath);
            await this.runtime.saveSettings?.();
            this.runtime.user?.showSuccess(`Exported ${result.outputPath}`);
            return result;
        } finally {
            progress?.close();
        }
    }

    cancel(): Promise<void> {
        return this.callbacks.cancel?.() ?? Promise.resolve();
    }

    commandPreview(variables: ExportVariables): CommandPreview {
        return this.draftController.commandPreview(variables);
    }

    currentDraft(): ProfileDraft {
        return this.draftController.currentDraft();
    }

    visibleDrafts(): ProfileDraft[] {
        return this.draftController.visibleDrafts();
    }

    selectedDraftId(): string {
        return this.draftController.selectedDraftId();
    }

    addPreset(): ProfileDraft {
        return this.draftController.addPreset();
    }

    deleteSelectedPreset(): boolean {
        return this.draftController.deleteSelectedPreset();
    }

    resetSelectedPreset(): boolean {
        return this.draftController.resetSelectedPreset();
    }

    restoreSelectedPreset(): boolean {
        return this.draftController.restoreSelectedPreset();
    }

    canDeleteSelectedPreset(): boolean {
        return this.draftController.canDeleteSelectedPreset();
    }

    canResetSelectedPreset(): boolean {
        return this.draftController.canResetSelectedPreset();
    }

    canRestoreSelectedPreset(): boolean {
        return this.draftController.canRestoreSelectedPreset();
    }

    saveSelectedPreset(): ExportProfile[] {
        return this.draftController.saveSelectedPreset();
    }

    saveAllPresets(): ExportProfile[] {
        return this.draftController.saveAllPresets();
    }

    currentOutputFileName(): string {
        return this.draftController.currentOutputFileName();
    }

    currentOutputFolder(): string {
        return this.draftController.currentOutputFolder();
    }

    currentOverwrite(): boolean {
        return this.draftController.currentOverwrite();
    }

    currentProfile(): ExportProfile {
        return this.draftController.currentProfile();
    }

    exportRequest(
        currentFile: PandocExportDraftCurrentFile,
        variables: ExportVariables
    ): PandocExportRequest {
        return this.draftController.exportRequest(currentFile, variables);
    }

    nextOptionIndex(): number {
        return this.draftController.nextOptionIndex();
    }

    outputFileNameForProfile(): string {
        return this.draftController.outputFileNameForProfile();
    }

    recordSuccessfulExport(settings: PandocExportSettings, outputPath?: string): void {
        this.draftController.recordSuccessfulExport(settings, outputPath);
    }

    validationIssues(knownTemplateNames: string[]): ValidationIssue[] {
        return this.draftController.validationIssues(knownTemplateNames);
    }

    private failExport(message: string, result?: PandocExportResult): PandocExportResult {
        this.runtime?.user?.showError(message);
        return result ?? {
            ok: false,
            error: message
        };
    }
}
