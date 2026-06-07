import { describe, expect, it } from '@jest/globals';

import {
    DEFAULT_PANDOC_EXPORT_SETTINGS,
    FALLBACK_PANDOC_CATALOG,
    PandocCoreExportController
} from '../../../src/pandoc/core';
import type {
    ExportProfile,
    PandocExportRequest,
    PandocExportSettings
} from '../../../src/pandoc/core';

const profiles: ExportProfile[] = [{
    id: 'html',
    name: 'HTML',
    type: 'pandoc',
    extension: '.html',
    to: 'html',
    outputPath: '${outputPath}'
}, {
    id: 'docx',
    name: 'DOCX',
    type: 'pandoc',
    extension: '.docx',
    to: 'docx',
    outputPath: '${outputPath}'
}];

describe('PandocCoreExportController', () => {
    it('loads the catalog and selects profile drafts', async () => {
        const controller = createController();

        await expect(controller.loadCatalog()).resolves.toBe(FALLBACK_PANDOC_CATALOG);
        await expect(controller.selectProfile('docx')).resolves.toMatchObject({
            id: 'docx',
            type: 'pandoc'
        });
        expect(controller.currentProfile()).toMatchObject({
            id: 'docx',
            extension: '.docx'
        });
    });

    it('edits option rows and output target state', async () => {
        const controller = createController();
        const row = controller.currentDraft().optionRows.find(item => item.key === '-t');
        if (!row) throw new Error('Expected a to-format row.');

        await controller.editOptionRow(row.id, {
            value: 'markdown',
            enabled: false
        });
        await controller.setOutputTarget({
            fileName: 'custom.md',
            folder: '/custom',
            overwrite: true
        });

        expect(row).toMatchObject({
            value: 'markdown',
            enabled: false
        });
        expect(controller.currentOutputFileName()).toBe('custom.md');
        expect(controller.currentOutputFolder()).toBe('/custom');
        expect(controller.currentOverwrite()).toBe(true);
    });

    it('manages preset drafts while preserving the active export profile', async () => {
        const controller = createController();

        const draft = controller.addPreset();
        draft.name = 'Temporary HTML';
        expect(controller.selectedDraftId()).toBe(draft.id);
        expect(controller.currentProfile()).toMatchObject({
            id: draft.id,
            name: 'Temporary HTML'
        });

        const savedProfiles = controller.saveSelectedPreset();
        expect(savedProfiles.map(item => item.name)).toContain('Temporary HTML');

        controller.currentDraft().name = 'Edited temporary HTML';
        expect(controller.canResetSelectedPreset()).toBe(true);
        expect(controller.resetSelectedPreset()).toBe(true);
        expect(controller.currentDraft().name).toBe('Temporary HTML');

        await controller.selectProfile('docx');
        expect(controller.deleteSelectedPreset()).toBe(true);
        expect(controller.saveAllPresets().map(item => item.id)).toEqual(['html', draft.id]);
        expect(controller.currentProfile().id).toBe('html');
    });

    it('delegates preview, export, and cancel callbacks when supplied', async () => {
        let cancelled = false;
        const controller = createController({
            callbacks: {
                cancel: async () => {
                    cancelled = true;
                },
                export: async () => ({ ok: true, outputPath: '/exports/note.html' }),
                refreshPreview: async () => ({
                    artifact: {
                        filePath: '/tmp/preview.html',
                        kind: 'html',
                        label: 'HTML preview'
                    }
                })
            }
        });

        await expect(controller.refreshPreview()).resolves.toMatchObject({
            artifact: { kind: 'html' }
        });
        await expect(controller.export()).resolves.toMatchObject({
            ok: true,
            outputPath: '/exports/note.html'
        });
        await controller.cancel();
        expect(cancelled).toBe(true);
    });

    it('returns explicit errors when preview and export callbacks are not configured', async () => {
        const controller = createController();

        await expect(controller.refreshPreview()).resolves.toMatchObject({
            error: 'Pandoc preview is not configured.'
        });
        await expect(controller.export()).resolves.toMatchObject({
            ok: false,
            error: 'Pandoc export is not configured.'
        });
    });

    it('ignores stale disabled preview settings and blocks preview through validation', async () => {
        const staleDisabled = createController({
            runtime: {
                settings: createSettings({ preview: { enabled: false } }),
                getExportRequest: createRequest,
                getValidationIssues: () => [],
                renderPreview: async () => ({
                    artifact: {
                        filePath: '/tmp/preview.html',
                        kind: 'html',
                        label: 'HTML preview'
                    }
                })
            }
        });
        await expect(staleDisabled.refreshPreview()).resolves.toMatchObject({
            artifact: { kind: 'html' }
        });

        const invalid = createController({
            runtime: {
                settings: createSettings(),
                getExportRequest: createRequest,
                getValidationIssues: () => [{ severity: 'error', message: 'Invalid option' }],
                renderPreview: async () => ({})
            }
        });
        await expect(invalid.refreshPreview()).resolves.toMatchObject({
            error: 'Fix command errors before previewing.'
        });
    });

    it('coordinates export runtime hooks, persistence, progress, and notices', async () => {
        const events: string[] = [];
        const settings = createSettings();
        const controller = createController({
            runtime: {
                settings,
                user: {
                    showError: message => events.push(`error:${message}`),
                    showSuccess: message => events.push(`success:${message}`),
                    showProgress: message => {
                        events.push(`progress:${message}`);
                        return {
                            update: next => events.push(`progress:${next}`),
                            close: () => events.push('progress:close')
                        };
                    }
                },
                cleanupPreview: async () => events.push('cleanup'),
                getExportRequest: createRequest,
                getValidationIssues: () => [],
                runExport: async () => ({ ok: true, outputPath: '/exports/note.html' }),
                saveSettings: async () => events.push('save')
            }
        });

        await expect(controller.export()).resolves.toMatchObject({
            ok: true,
            outputPath: '/exports/note.html'
        });
        expect(settings.lastExportProfileId).toBe('html');
        expect(settings.lastOutputFolder).toBe('/exports');
        expect(events).toEqual([
            'cleanup',
            'progress:Exporting with Pandoc...',
            'save',
            'success:Exported /exports/note.html',
            'progress:close'
        ]);
    });

    it('reports validation errors through the runtime user port before export', async () => {
        const events: string[] = [];
        const controller = createController({
            runtime: {
                settings: createSettings(),
                user: {
                    showError: message => events.push(message),
                    showProgress: () => ({ update: () => undefined, close: () => undefined }),
                    showSuccess: () => undefined
                },
                getExportRequest: createRequest,
                getValidationIssues: () => [{ severity: 'error', message: 'Invalid option' }],
                runExport: async () => ({ ok: true, outputPath: '/exports/note.html' })
            }
        });

        await expect(controller.export()).resolves.toMatchObject({
            ok: false,
            error: 'Fix 1 Pandoc export error(s) before exporting.'
        });
        expect(events).toEqual(['Fix 1 Pandoc export error(s) before exporting.']);
    });
});

function createController(
    overrides: Partial<ConstructorParameters<typeof PandocCoreExportController>[0]> = {}
): PandocCoreExportController {
    return new PandocCoreExportController({
        profiles,
        catalog: FALLBACK_PANDOC_CATALOG,
        currentFileBaseName: 'note',
        initialOutputFolder: '/exports',
        initialOverwrite: false,
        ...overrides
    });
}

function createSettings(
    overrides: Partial<PandocExportSettings> & {
        preview?: Partial<PandocExportSettings['preview']>;
    } = {}
): PandocExportSettings {
    return {
        ...DEFAULT_PANDOC_EXPORT_SETTINGS,
        enabled: true,
        profiles,
        ...overrides,
        preview: {
            ...DEFAULT_PANDOC_EXPORT_SETTINGS.preview,
            ...overrides.preview
        }
    };
}

function createRequest(): PandocExportRequest {
    return {
        currentFilePath: 'note.md',
        currentFileName: 'note.md',
        currentFileBaseName: 'note',
        outputFolder: '/exports',
        outputFileName: 'note.html',
        profileId: 'html'
    };
}
