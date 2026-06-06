import { describe, expect, it } from '@jest/globals';

import {
    FALLBACK_PANDOC_CATALOG,
    PandocExportDraftController
} from '../../../src/pandoc/core';
import type {
    ExportProfile,
    ExportVariables,
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
    outputPath: '${outputDir}/custom-${currentFileName}.docx'
}];

function createVariables(overrides: Partial<ExportVariables> = {}): ExportVariables {
    return {
        vaultDir: '/vault',
        pluginDir: '/vault/.obsidian/plugins/pem',
        luaFilterDir: '/vault/.obsidian/plugins/pem/lua_filter',
        currentPath: '/vault/note.md',
        currentDir: '/vault',
        currentFileName: 'note',
        currentFileFullName: 'note.md',
        outputPath: '/exports/note.html',
        outputDir: '/exports',
        outputFileName: 'note',
        outputFileFullName: 'note.html',
        outputExtension: '.html',
        attachmentFolderPath: '/vault/assets',
        embedDirs: '/vault/assets',
        fromFormat: 'markdown',
        ...overrides
    };
}

describe('PandocExportDraftController', () => {
    it('initializes draft and output state from the selected profile', () => {
        const controller = createController({ initialProfileId: 'html' });

        expect(controller.currentDraft()).toMatchObject({
            id: 'html',
            type: 'pandoc'
        });
        expect(controller.currentOutputFolder()).toBe('/exports');
        expect(controller.currentOutputFileName()).toBe('note.html');
        expect(controller.currentOverwrite()).toBe(false);
    });

    it('switches profiles and updates the output file extension', () => {
        const controller = createController({ initialProfileId: 'html' });

        controller.selectProfile('docx');

        expect(controller.currentDraft().id).toBe('docx');
        expect(controller.currentOutputFileName()).toBe('note.docx');
    });

    it('resolves output target through the compiled profile template', () => {
        const controller = createController({ initialProfileId: 'docx' });

        const target = controller.outputTarget(createVariables({
            outputPath: '/exports/note.docx',
            outputFileFullName: 'note.docx',
            outputExtension: '.docx'
        }));

        expect(target).toEqual({
            outputFolder: '/exports',
            outputFileName: 'custom-note.docx'
        });
    });

    it('builds command preview and validates the current draft', () => {
        const controller = createController({ initialProfileId: 'html' });

        expect(controller.commandPreview(createVariables()).display).toContain('-t html');
        expect(controller.validationIssues(Object.keys(createVariables()))).toEqual([]);
    });

    it('creates an export request from current file data and rendered output target', () => {
        const controller = createController({ initialProfileId: 'docx' });

        const request = controller.exportRequest({
            path: '/vault/note.md',
            name: 'note.md',
            basename: 'note'
        }, createVariables({
            outputPath: '/exports/note.docx',
            outputFileFullName: 'note.docx',
            outputExtension: '.docx'
        }));

        expect(request).toEqual({
            currentFilePath: '/vault/note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note',
            profileId: 'docx',
            outputFolder: '/exports',
            outputFileName: 'custom-note.docx',
            overwrite: false
        });
    });

    it('records successful export state in settings', () => {
        const controller = createController({ initialProfileId: 'docx' });
        const settings: PandocExportSettings = {
            enabled: true,
            pandocPath: 'pandoc',
            defaultOutputFolderMode: 'current' as const,
            customOutputFolder: '',
            env: {},
            profiles,
            showOverwriteConfirmation: true,
            openOutputFile: false,
            revealOutputFile: false,
            suggestRuntimeEnvVariables: false,
            preview: {
                enabled: true,
                debounceMs: 700,
                odtAddon: {
                    enabled: true,
                    status: 'not-installed' as const
                }
            }
        };

        controller.recordSuccessfulExport(settings, '/exports/custom-note.docx');

        expect(settings.lastExportProfileId).toBe('docx');
        expect(settings.lastOutputFolder).toBe('/exports');
    });
});

function createController(
    overrides: Partial<ConstructorParameters<typeof PandocExportDraftController>[0]> = {}
): PandocExportDraftController {
    return new PandocExportDraftController({
        profiles,
        catalog: FALLBACK_PANDOC_CATALOG,
        currentFileBaseName: 'note',
        initialOutputFolder: '/exports',
        initialOverwrite: false,
        ...overrides
    });
}
