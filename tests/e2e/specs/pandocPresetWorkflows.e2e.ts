import { browser, expect } from '@wdio/globals';

import {
    clickCancel,
    clickPresetAction,
    clickSaveAndClose,
    closeOpenModals,
    defaultHtmlProfile,
    deleteVaultFileIfExists,
    editResourcePath,
    editToFormat,
    getHarnessPersistedProfiles,
    getNoticeTexts,
    getPersistedProfiles,
    getPresetPanelState,
    getSavedDataProfiles,
    installSettingsSaveHarness,
    openCommandPresetPanel,
    openExportPresetPanel,
    renamePreset,
    researchHtmlProfile,
    resolveSettingsSavesInOrder,
    restoreSettingsSaveHarness,
    seedPandocExportSettings,
    seedProfiles,
    selectPreset,
    waitForNewNoticeContaining,
    waitForNoticeContaining
} from '../helpers/pandocPresetUi';
import type {
    E2ePandocProfile,
    PresetPanelState
} from '../helpers/pandocPresetUi';

const commandTitle = 'Pandoc export command';
const exportTitle = 'Export with pandoc';
const notePath = 'pandoc-preset-workflows.md';
const testVault = './tests/e2e/vaults/test-vault';

describe('Pandoc preset workflows', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: testVault
        });
    });

    afterEach(async () => {
        await restoreSettingsSaveHarness();
        await closeOpenModals();
    });

    after(async () => {
        await deleteVaultFileIfExists(notePath);
    });

    it('renders baseline preset state in both panels', async () => {
        await seedPandocExportSettings(seedProfiles(), 'html');

        await openCommandPresetPanel();
        await expectBaseline(await getPresetPanelState(commandTitle));
        await assertRestoreStates(commandTitle);

        await openExportPresetPanel(notePath);
        const exportState = await getPresetPanelState(exportTitle);
        await expectBaseline(exportState);
        expect(exportState.outputFileName).toBe('pandoc-preset-workflows.html');
        await assertRestoreStates(exportTitle);
    });

    it('creates, renames, saves, and deletes new presets from both panels', async () => {
        await runNewPresetWorkflow(commandTitle, async () => openCommandPresetPanel());
        await runNewPresetWorkflow(exportTitle, async () => openExportPresetPanel(notePath));
    });

    it('persists only the selected preset on Save current and shares it across panels', async () => {
        await seedPandocExportSettings(seedProfiles(), 'html');
        await openCommandPresetPanel();

        await renamePreset(commandTitle, 'Session HTML');
        await selectPreset(commandTitle, 'Research HTML');
        await renamePreset(commandTitle, 'Published Research');
        await clickPresetAction(commandTitle, 'Save current');
        await waitForNoticeContaining('Current pandoc preset saved.');

        let profiles = await getPersistedProfiles();
        expect(profileNamed(profiles, 'Published Research')?.id).toBe('research-html');
        expect(profileById(profiles, 'html')?.name).toBe('HTML');
        expect(profileNamed(profiles, 'Session HTML')).toBeUndefined();

        await selectPreset(commandTitle, 'Session HTML');
        expect((await getPresetPanelState(commandTitle)).selectedPresetName).toBe('Session HTML');
        await clickCancel(commandTitle);

        profiles = await getSavedDataProfiles();
        expect(profileNamed(profiles, 'Published Research')?.id).toBe('research-html');
        expect(profileById(profiles, 'html')?.name).toBe('HTML');

        await openCommandPresetPanel();
        let state = await getPresetPanelState(commandTitle);
        expect(state.optionLabels).toEqual(['HTML', 'DOCX', 'Published Research']);

        await openExportPresetPanel(notePath);
        state = await getPresetPanelState(exportTitle);
        expect(state.optionLabels).toEqual(['HTML', 'DOCX', 'Published Research']);
    });

    it('resets current edits to the last saved snapshot without mutating settings', async () => {
        await runResetWorkflow(commandTitle, async () => openCommandPresetPanel());
        await runResetWorkflow(exportTitle, async () => openExportPresetPanel(notePath));
    });

    it('restores modified built-in presets to shipped defaults and leaves user presets unrestorable', async () => {
        await seedPandocExportSettings(seedProfiles(), 'html');
        await openCommandPresetPanel();

        await clickPresetAction(commandTitle, 'Restore preset');
        let state = await getPresetPanelState(commandTitle);
        expect(state.nameValue).toBe('HTML');
        expect(state.commandPreview).not.toContain('--toc');
        expect(state.commandPreview).toContain('--embed-resources');
        expect(state.actionDisabled.restorePreset).toBe(true);

        await clickPresetAction(commandTitle, 'Save current');
        await waitForNoticeContaining('Current pandoc preset saved.');
        let profiles = await getPersistedProfiles();
        expectRestoredHtmlProfile(profileById(profiles, 'html'));

        await selectPreset(commandTitle, 'Research HTML');
        expect((await getPresetPanelState(commandTitle)).actionDisabled.restorePreset).toBe(true);

        await seedPandocExportSettings(seedProfiles(), 'html');
        await openExportPresetPanel(notePath);
        await clickPresetAction(exportTitle, 'Restore preset');
        state = await getPresetPanelState(exportTitle);
        expect(state.outputFileName).toBe('pandoc-preset-workflows.html');
        expect(state.commandPreview).not.toContain('--toc');
        await clickPresetAction(exportTitle, 'Save current');
        await waitForNoticeContaining('Current pandoc preset saved.');
        profiles = await getPersistedProfiles();
        expectRestoredHtmlProfile(profileById(profiles, 'html'));
    });

    it('applies delete semantics for command editor, export modal, and single-preset state', async () => {
        await seedPandocExportSettings(seedProfiles(), 'docx');
        await openCommandPresetPanel();
        await selectPreset(commandTitle, 'DOCX');
        await clickPresetAction(commandTitle, 'Delete current');
        let state = await getPresetPanelState(commandTitle);
        expect(state.optionLabels).toEqual(['HTML', 'Research HTML']);
        expect(state.selectedPresetName).toBe('HTML');
        expect(profileById(await getPersistedProfiles(), 'docx')).toBeDefined();

        await clickPresetAction(commandTitle, 'Save current');
        await waitForNoticeContaining('Current pandoc preset saved.');
        expect(profileById(await getPersistedProfiles(), 'docx')).toBeDefined();

        await clickCancel(commandTitle);
        await openCommandPresetPanel();
        expect((await getPresetPanelState(commandTitle)).optionLabels).toContain('DOCX');

        await selectPreset(commandTitle, 'DOCX');
        await clickPresetAction(commandTitle, 'Delete current');
        await clickSaveAndClose();
        await browser.waitUntil(async () => !await hasModal(commandTitle), {
            timeout: 5000,
            timeoutMsg: 'Expected command preset modal to close'
        });
        expect(profileById(await getPersistedProfiles(), 'docx')).toBeUndefined();

        await seedPandocExportSettings(seedProfiles(), 'docx');
        await openExportPresetPanel(notePath);
        await selectPreset(exportTitle, 'DOCX');
        await clickPresetAction(exportTitle, 'Delete current');
        await browser.waitUntil(async () =>
            !Boolean(profileById(await getPersistedProfiles(), 'docx')), {
            timeout: 5000,
            timeoutMsg: 'Expected export modal deletion to persist immediately'
        });
        state = await getPresetPanelState(exportTitle);
        expect(state.optionLabels).toEqual(['HTML', 'Research HTML']);
        expect(state.selectedPresetName).toBe('HTML');

        const singleProfile = [researchHtmlProfile()];
        await seedPandocExportSettings(singleProfile, 'research-html');
        await openCommandPresetPanel();
        expect((await getPresetPanelState(commandTitle)).actionDisabled.deleteCurrent).toBe(true);
        await clickPresetAction(commandTitle, 'Delete current');
        expect(await getPersistedProfiles()).toEqual(singleProfile);

        await openExportPresetPanel(notePath);
        expect((await getPresetPanelState(exportTitle)).actionDisabled.deleteCurrent).toBe(true);
        await clickPresetAction(exportTitle, 'Delete current');
        expect(await getPersistedProfiles()).toEqual(singleProfile);
    });

    it('survives multi-operation and cross-panel preset chains', async () => {
        await seedPandocExportSettings(seedProfiles(), 'html');
        await openCommandPresetPanel();

        await clickPresetAction(commandTitle, 'New preset');
        await renamePreset(commandTitle, 'Cross Panel HTML');
        await clickPresetAction(commandTitle, 'Save current');
        await waitForNoticeContaining('Current pandoc preset saved.');
        await editToFormat(commandTitle, 'docx');
        expect((await getPresetPanelState(commandTitle)).actionDisabled.resetCurrent).toBe(false);
        await clickPresetAction(commandTitle, 'Reset current');
        expect((await getPresetPanelState(commandTitle)).commandPreview).toContain('-t html');
        await selectPreset(commandTitle, 'HTML');
        await clickPresetAction(commandTitle, 'Restore preset');
        await selectPreset(commandTitle, 'DOCX');
        await clickPresetAction(commandTitle, 'Delete current');
        await clickSaveAndClose();

        let profiles = await getPersistedProfiles();
        expect(profileNamed(profiles, 'Cross Panel HTML')).toBeDefined();
        expect(profileById(profiles, 'docx')).toBeUndefined();
        expect(profileById(profiles, 'html')?.extraArgs).not.toContain('--toc');

        await openExportPresetPanel(notePath);
        let state = await getPresetPanelState(exportTitle);
        expect(state.optionLabels).toEqual(['HTML', 'Research HTML', 'Cross Panel HTML']);
        await selectPreset(exportTitle, 'Cross Panel HTML');
        await clickPresetAction(exportTitle, 'Delete current');

        profiles = await getPersistedProfiles();
        expect(profileNamed(profiles, 'Cross Panel HTML')).toBeUndefined();
        await openCommandPresetPanel();
        state = await getPresetPanelState(commandTitle);
        expect(state.optionLabels).toEqual(['HTML', 'Research HTML']);
    });

    it('updates export output filename extensions when presets change, reset, or restore', async () => {
        await seedPandocExportSettings(seedProfiles(), 'html');
        await openExportPresetPanel(notePath);
        expect((await getPresetPanelState(exportTitle)).outputFileName).toBe('pandoc-preset-workflows.html');

        await selectPreset(exportTitle, 'DOCX');
        expect((await getPresetPanelState(exportTitle)).outputFileName).toBe('pandoc-preset-workflows.docx');

        await selectPreset(exportTitle, 'Research HTML');
        let state = await getPresetPanelState(exportTitle);
        expect(state.outputFileName).toBe('pandoc-preset-workflows-research.html');
        expect(state.commandPreview).toContain('pandoc-preset-workflows-research.html');

        await editToFormat(exportTitle, 'docx');
        state = await getPresetPanelState(exportTitle);
        expect(state.outputFileName).toBe('pandoc-preset-workflows-research.docx');
        expect(state.commandPreview).toContain('pandoc-preset-workflows-research.docx');

        await clickPresetAction(exportTitle, 'Reset current');
        state = await getPresetPanelState(exportTitle);
        expect(state.outputFileName).toBe('pandoc-preset-workflows-research.html');
        expect(state.commandPreview).toContain('pandoc-preset-workflows-research.html');

        await selectPreset(exportTitle, 'HTML');
        await clickPresetAction(exportTitle, 'Restore preset');
        state = await getPresetPanelState(exportTitle);
        expect(state.outputFileName).toBe('pandoc-preset-workflows.html');
    });

    it('blocks blank, duplicate, and invalid selected preset saves without mutating settings', async () => {
        await runValidationWorkflow(commandTitle, async () => openCommandPresetPanel());
        await runValidationWorkflow(exportTitle, async () => openExportPresetPanel(notePath));
    });

    it('flushes the latest rapid Save current snapshot after a pending save', async () => {
        await seedPandocExportSettings(seedProfiles(), 'research-html');
        await installSettingsSaveHarness();
        await openCommandPresetPanel();
        await selectPreset(commandTitle, 'Research HTML');

        await renamePreset(commandTitle, 'Rapid one');
        await clickPresetAction(commandTitle, 'Save current');
        await renamePreset(commandTitle, 'Rapid two');
        await clickPresetAction(commandTitle, 'Save current');
        await resolveSettingsSavesInOrder();

        const profiles = await getHarnessPersistedProfiles();
        expect(profileById(profiles, 'research-html')?.name).toBe('Rapid two');
    });
});

async function expectBaseline(state: PresetPanelState): Promise<void> {
    expect(state.hasPresetIdField).toBe(false);
    expect(state.presetFieldLabels).toEqual(['Preset', 'Name']);
    expect(state.optionLabels).toEqual(['HTML', 'DOCX', 'Research HTML']);
    expect(state.selectedPresetName).toBe('HTML');
    expect(state.actionDisabled).toEqual(expect.objectContaining({
        newPreset: false,
        saveCurrent: false,
        resetCurrent: true,
        deleteCurrent: false,
        restorePreset: false
    }));
    expect(state.nameValue).toBe('HTML');
    expect(state.commandPreview).toContain('--toc');
    expect(state.commandPreview).toContain('/modified/html/assets');
    expect(state.persistedProfiles.map(profile => profile.id)).toEqual(['html', 'docx', 'research-html']);
}

async function assertRestoreStates(title: string): Promise<void> {
    await selectPreset(title, 'HTML');
    expect((await getPresetPanelState(title)).actionDisabled.restorePreset).toBe(false);
    await selectPreset(title, 'DOCX');
    expect((await getPresetPanelState(title)).actionDisabled.restorePreset).toBe(true);
    await selectPreset(title, 'Research HTML');
    expect((await getPresetPanelState(title)).actionDisabled.restorePreset).toBe(true);
}

async function runNewPresetWorkflow(
    title: string,
    openPanel: () => Promise<void>
): Promise<void> {
    await seedPandocExportSettings(seedProfiles(), 'html');
    await openPanel();

    await clickPresetAction(title, 'New preset');
    await clickPresetAction(title, 'New preset');
    let state = await getPresetPanelState(title);
    expect(state.optionLabels).toEqual(['HTML', 'DOCX', 'Research HTML', 'New preset', 'New preset 2']);
    expect(state.selectedPresetName).toBe('New preset 2');

    await renamePreset(title, '  Field Report  ');
    await clickPresetAction(title, 'Save current');
    await waitForNoticeContaining('Current pandoc preset saved.');

    let profiles = await getPersistedProfiles();
    const saved = profileNamed(profiles, 'Field Report');
    expect(saved?.id).toBe('new-preset-2');
    expect(new Set(profiles.map(profile => profile.id)).size).toBe(profiles.length);
    expect(profileNamed(profiles, 'New preset')).toBeUndefined();

    const persistedBeforeDelete = JSON.stringify(profiles);
    await clickPresetAction(title, 'New preset');
    state = await getPresetPanelState(title);
    expect(state.selectedPresetName).toBe('New preset 2');
    await clickPresetAction(title, 'Delete current');
    expect((await getPresetPanelState(title)).optionLabels).not.toContain('New preset 2');
    profiles = await getPersistedProfiles();
    expect(JSON.stringify(profiles)).toBe(persistedBeforeDelete);
}

async function runResetWorkflow(
    title: string,
    openPanel: () => Promise<void>
): Promise<void> {
    await seedPandocExportSettings(seedProfiles(), 'html');
    await openPanel();
    const originalProfiles = JSON.stringify(await getPersistedProfiles());

    await renamePreset(title, 'Edited HTML');
    await editToFormat(title, 'docx');
    await editResourcePath(title, '/tmp/pandoc-reset-assets');

    let state = await getPresetPanelState(title);
    expect(state.actionDisabled.resetCurrent).toBe(false);
    expect(state.commandPreview).toContain('-t docx');
    expect(state.commandPreview).toContain('/tmp/pandoc-reset-assets');
    if (title === exportTitle) {
        expect(state.outputFileName).toBe('pandoc-preset-workflows.docx');
    }
    expect(JSON.stringify(await getPersistedProfiles())).toBe(originalProfiles);

    await clickPresetAction(title, 'Reset current');
    state = await getPresetPanelState(title);
    expect(state.nameValue).toBe('HTML');
    expect(state.actionDisabled.resetCurrent).toBe(true);
    expect(state.commandPreview).toContain('-t html');
    expect(state.commandPreview).toContain('/modified/html/assets');
    expect(state.commandPreview).not.toContain('/tmp/pandoc-reset-assets');
    if (title === exportTitle) {
        expect(state.outputFileName).toBe('pandoc-preset-workflows.html');
    }
    expect(JSON.stringify(await getPersistedProfiles())).toBe(originalProfiles);
}

async function runValidationWorkflow(
    title: string,
    openPanel: () => Promise<void>
): Promise<void> {
    await seedPandocExportSettings(seedProfiles(), 'html');
    await openPanel();
    const originalProfiles = JSON.stringify(await getPersistedProfiles());

    await renamePreset(title, '   ');
    await expectSaveBlocked(title, 'Save current', 'Preset name is required.');
    expect(JSON.stringify(await getPersistedProfiles())).toBe(originalProfiles);
    if (title === commandTitle) {
        const noticeCount = (await getNoticeTexts()).length;
        await clickSaveAndClose();
        await waitForNewNoticeContaining('Pandoc preset error(s) before saving.', noticeCount);
        expect(await hasModal(commandTitle)).toBe(true);
        await waitForValidationContaining(title, 'Preset name is required.');
    }

    await renamePreset(title, 'HTML');
    await selectPreset(title, 'Research HTML');
    await renamePreset(title, ' html ');
    await expectSaveBlocked(title, 'Save current', 'Preset name "html" is already used.');
    expect(JSON.stringify(await getPersistedProfiles())).toBe(originalProfiles);

    await renamePreset(title, 'Research HTML');
    await editToFormat(title, '');
    let state = await getPresetPanelState(title);
    expect(state.actionDisabled.resetCurrent).toBe(false);
    await expectSaveBlocked(title, 'Save current', 'to format is required.');
    state = await getPresetPanelState(title);
    expect(state.actionDisabled.resetCurrent).toBe(false);
    expect(JSON.stringify(await getPersistedProfiles())).toBe(originalProfiles);
}

async function expectSaveBlocked(
    title: string,
    action: string,
    validationText: string
): Promise<void> {
    const noticeCount = (await getNoticeTexts()).length;
    await clickPresetAction(title, action);
    await waitForNewNoticeContaining('Pandoc preset error(s) before saving.', noticeCount);
    await waitForValidationContaining(title, validationText);
}

async function waitForValidationContaining(title: string, text: string): Promise<void> {
    await browser.waitUntil(async () =>
        (await getPresetPanelState(title)).validationText.includes(text), {
        timeout: 5000,
        timeoutMsg: `Expected validation text containing ${text}`
    });
}

function profileById(profiles: E2ePandocProfile[], id: string): E2ePandocProfile | undefined {
    return profiles.find(profile => profile.id === id);
}

function profileNamed(profiles: E2ePandocProfile[], name: string): E2ePandocProfile | undefined {
    return profiles.find(profile => profile.name === name);
}

function expectRestoredHtmlProfile(profile: E2ePandocProfile | undefined): void {
    const expected = defaultHtmlProfile();
    expect(profile?.id).toBe(expected.id);
    expect(profile?.name).toBe(expected.name);
    expect(profile?.to).toBe(expected.to);
    expect(profile?.extension).toBe(expected.extension);
    expect(profile?.standalone).toBe(expected.standalone);
    expect(profile?.resourcePaths).toEqual(expected.resourcePaths);
    expect(profile?.luaFilters).toEqual(expected.luaFilters);
    expect(profile?.extraArgs).toEqual(expected.extraArgs);
    expect(profile?.extraArgs).not.toContain('--toc');
}

async function hasModal(title: string): Promise<boolean> {
    return browser.execute((modalTitle: string) =>
        Array.from(document.querySelectorAll('.modal-title'))
            .some(item => item.textContent === modalTitle),
    title);
}
