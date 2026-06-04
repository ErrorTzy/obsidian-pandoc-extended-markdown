import { describe, expect, it } from '@jest/globals';

import {
    createCustomShellDisabledResult,
    DEFAULT_EXPORT_PROFILES,
    normalizePandocExportSettings,
    resolveDefaultOutputFolder,
    resolveExportOutputPath,
    selectExportProfile
} from '../../../src/pandoc/core';

describe('pandoc export planning core', () => {
    it('selects requested, last, then first profile in order', () => {
        const settings = normalizePandocExportSettings({
            lastExportProfileId: 'docx'
        });

        expect(selectExportProfile(settings, 'html')?.id).toBe('html');
        expect(selectExportProfile(settings)?.id).toBe('docx');
        expect(selectExportProfile({
            ...settings,
            lastExportProfileId: 'missing'
        })?.id).toBe(DEFAULT_EXPORT_PROFILES[0].id);
    });

    it('resolves output folder and file names without host APIs', () => {
        const settings = normalizePandocExportSettings({
            defaultOutputFolderMode: 'last',
            lastOutputFolder: '/last'
        });
        const profile = DEFAULT_EXPORT_PROFILES.find(profile => profile.id === 'html')!;

        expect(resolveDefaultOutputFolder({
            settings,
            currentFilePath: '/vault/folder/note.md',
            vaultDir: '/vault',
            fullCurrentPath: '/vault/folder/note.md'
        })).toBe('/last');
        expect(resolveExportOutputPath({
            currentFilePath: 'folder/note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note'
        }, profile, '/exports')).toBe('/exports/note.html');
    });

    it('models disabled custom shell profiles as failed process results', () => {
        expect(createCustomShellDisabledResult('echo ${outputPath}')).toMatchObject({
            executable: 'echo ${outputPath}',
            ok: false,
            error: 'Custom shell profile is not explicitly enabled.'
        });
    });
});
