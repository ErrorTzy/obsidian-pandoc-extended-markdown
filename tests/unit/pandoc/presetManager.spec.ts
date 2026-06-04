import { describe, expect, it } from '@jest/globals';

import {
    DEFAULT_EXPORT_PROFILES,
    FALLBACK_PANDOC_CATALOG,
    PandocPresetManager,
    validateProfileDraftNames
} from '../../../src/pandoc';
import type { ExportProfile } from '../../../src/pandoc/core/export/types';

describe('Pandoc preset manager', () => {
    it('creates new presets with unique user-facing names and hidden ids', () => {
        const manager = new PandocPresetManager([
            profile('new-preset', 'New preset')
        ]);

        const draft = manager.addPreset();

        expect(draft.name).toBe('New preset 2');
        expect(draft.id).toBe('new-preset-2');
    });

    it('validates duplicate preset names without relying on visible ids', () => {
        const manager = new PandocPresetManager([
            profile('html', 'HTML'),
            profile('custom-html', 'HTML')
        ]);

        expect(validateProfileDraftNames(manager.visibleDrafts())).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'error',
                message: 'Preset name "HTML" is already used.'
            })
        ]));
    });

    it('saves only the selected preset when saving current', () => {
        const manager = new PandocPresetManager([
            profile('html', 'HTML'),
            profile('docx', 'DOCX')
        ]);
        manager.visibleDrafts()[0].name = 'Unsaved HTML';
        manager.select('docx');
        manager.selectedDraft()!.name = 'Saved DOCX';

        const profiles = manager.saveSelected(FALLBACK_PANDOC_CATALOG);

        expect(profiles.find(item => item.id === 'html')?.name).toBe('HTML');
        expect(profiles.find(item => item.id === 'docx')?.name).toBe('Saved DOCX');
    });

    it('keeps pending deletions out of save current but includes them in save all', () => {
        const manager = new PandocPresetManager([
            profile('html', 'HTML'),
            profile('docx', 'DOCX')
        ]);

        manager.select('html');
        expect(manager.deleteSelected()).toBe(true);
        expect(manager.saveSelected(FALLBACK_PANDOC_CATALOG).map(item => item.id))
            .toEqual(['html', 'docx']);
        expect(manager.saveAll(FALLBACK_PANDOC_CATALOG).map(item => item.id))
            .toEqual(['docx']);
    });

    it('resets a saved preset to the last saved snapshot', () => {
        const manager = new PandocPresetManager([
            profile('html', 'HTML')
        ]);
        manager.selectedDraft()!.name = 'Edited HTML';

        expect(manager.canResetSelected()).toBe(true);
        expect(manager.resetSelected()).toBe(true);
        expect(manager.selectedDraft()!.name).toBe('HTML');
    });

    it('restores a selected built-in preset to the shipped default', () => {
        const defaultHtml = DEFAULT_EXPORT_PROFILES.find(item => item.id === 'html');
        expect(defaultHtml?.type).toBe('pandoc');
        if (defaultHtml?.type !== 'pandoc') return;

        const manager = new PandocPresetManager([
            { ...defaultHtml, extraArgs: ['--toc'] }
        ]);

        expect(manager.canRestoreSelected()).toBe(true);
        expect(manager.restoreSelected()).toBe(true);
        expect(manager.saveAll(FALLBACK_PANDOC_CATALOG)[0]).toMatchObject({
            id: 'html',
            name: 'HTML',
            extraArgs: defaultHtml.extraArgs
        });
    });
});

function profile(id: string, name: string): ExportProfile {
    return {
        id,
        name,
        type: 'pandoc',
        to: 'html',
        extension: '.html'
    };
}
