import {
    Notice
} from 'obsidian';

import {
    renderPresetOptions
} from './ExportModalRenderers';
import {
    validateProfileDraft,
    validateProfileDraftNames
} from '../../../core';
import type {
    PandocCoreExportController,
    PandocOptionCatalog,
    ProfileDraft,
    ValidationIssue
} from '../../../core';
import type {
    PandocExportPluginLike
} from './ExportModal';

export interface ExportModalPresetActionsContext {
    plugin: PandocExportPluginLike;
    controller: PandocCoreExportController;
    catalog: PandocOptionCatalog;
    knownTemplateNames(draft: ProfileDraft): string[];
    selectProfile(profileId: string): void;
    onDraftChange(): void;
    render(): void;
    refreshPreviewNow(): void;
}

export function renderExportModalPresetOptions(
    container: HTMLElement,
    context: ExportModalPresetActionsContext
): void {
    renderPresetOptions(container, {
        drafts: context.controller.visibleDrafts(),
        selectedId: context.controller.selectedDraftId(),
        canDelete: context.controller.canDeleteSelectedPreset(),
        canReset: context.controller.canResetSelectedPreset(),
        canRestore: context.controller.canRestoreSelectedPreset()
    }, {
        onSelect: profileId => context.selectProfile(profileId),
        onNameChange: value => {
            context.controller.currentDraft().name = value;
            context.onDraftChange();
        },
        onNewPreset: () => {
            context.controller.addPreset();
            rerenderAndRefresh(context);
        },
        onSaveCurrent: () => {
            void saveCurrentPreset(context);
        },
        onResetCurrent: () => {
            context.controller.resetSelectedPreset();
            rerenderAndRefresh(context);
        },
        onDeleteCurrent: () => {
            void deleteCurrentPreset(context);
        },
        onRestorePreset: () => {
            context.controller.restoreSelectedPreset();
            rerenderAndRefresh(context);
        }
    });
}

async function saveCurrentPreset(context: ExportModalPresetActionsContext): Promise<void> {
    const errors = currentPresetValidationIssues(context)
        .filter(issue => issue.severity === 'error');
    if (errors.length > 0) {
        new Notice(`Fix ${errors.length} Pandoc preset error(s) before saving.`);
        return;
    }

    const settings = context.plugin.settings.pandocExport;
    if (!settings) return;
    settings.profiles = context.controller.saveSelectedPreset();
    await context.plugin.saveSettings();
    new Notice('Current pandoc preset saved.');
    rerenderAndRefresh(context);
}

async function deleteCurrentPreset(context: ExportModalPresetActionsContext): Promise<void> {
    if (!context.controller.deleteSelectedPreset()) {
        new Notice('At least one export preset is required.');
        return;
    }

    const settings = context.plugin.settings.pandocExport;
    if (!settings) return;
    settings.profiles = context.controller.saveAllPresets();
    await context.plugin.saveSettings();
    rerenderAndRefresh(context);
}

function currentPresetValidationIssues(
    context: ExportModalPresetActionsContext
): ValidationIssue[] {
    const draft = context.controller.currentDraft();
    return [
        ...validateProfileDraftNames(context.controller.visibleDrafts()),
        ...validateProfileDraft(draft, context.catalog, context.knownTemplateNames(draft))
    ];
}

function rerenderAndRefresh(context: ExportModalPresetActionsContext): void {
    context.render();
    context.refreshPreviewNow();
}
