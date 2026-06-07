import { describe, expect, it, jest } from '@jest/globals';

import {
    normalizePandocExportSettings
} from '../../../src/pandoc';
import {
    renderPandocExportSettingsSection
} from '../../../src/pandoc/gui/obsidian/settings/pandocExportSettingsSection';
import {
    PandocExportAdvancedSettingsModal
} from '../../../src/pandoc/gui/obsidian/settings/PandocExportAdvancedSettingsModal';
import type {
    ObsidianPandocGuiDependencies
} from '../../../src/pandoc/gui/obsidian/dependencies';

describe('Pandoc export settings section', () => {
    it('shows the custom output folder setting only when custom output is selected', async () => {
        const settings = normalizePandocExportSettings({
            defaultOutputFolderMode: 'current'
        });
        const saveSettings = jest.fn(async () => undefined);
        const container = document.createElement('div');

        renderPandocExportSettingsSection({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        }, container, createDependencies());

        expect(findSettingRow(container, 'Custom output folder')).toBeUndefined();

        const select = getSettingRow(container, 'Default output folder')
            .querySelector<HTMLSelectElement>('select');
        if (!select) throw new Error('Default output folder select not found.');
        fireSelectChange(select, 'custom');

        expect(getSettingRow(container, 'Custom output folder')).toBeTruthy();
        await flushPromises();
        expect(settings.defaultOutputFolderMode).toBe('custom');
        expect(saveSettings).toHaveBeenCalledTimes(1);

        fireSelectChange(select, 'vault');

        expect(findSettingRow(container, 'Custom output folder')).toBeUndefined();
    });

    it('selects the custom output folder through the folder browser', async () => {
        const settings = normalizePandocExportSettings({
            defaultOutputFolderMode: 'custom',
            customOutputFolder: '/old'
        });
        const saveSettings = jest.fn(async () => undefined);
        const dependencies = createDependencies({
            pathBrowser: {
                chooseFile: jest.fn(async () => undefined),
                chooseFolder: jest.fn(async () => '/exports')
            }
        });
        const container = document.createElement('div');

        renderPandocExportSettingsSection({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        }, container, dependencies);

        await clickButton(getSettingRow(container, 'Custom output folder'), 'Browse');

        expect(dependencies.pathBrowser?.chooseFolder).toHaveBeenCalledWith('/old');
        expect(settings.customOutputFolder).toBe('/exports');
        expect(getSettingRow(container, 'Custom output folder')
            .querySelector<HTMLInputElement>('input')?.value).toBe('/exports');
        expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    it('saves the latest custom output folder after an older save finishes', async () => {
        const settings = normalizePandocExportSettings({
            defaultOutputFolderMode: 'custom'
        });
        let persisted = '';
        const pendingSaves: Array<{
            value: string;
            resolve: () => void;
        }> = [];
        const saveSettings = jest.fn(() => new Promise<void>(resolve => {
            const value = settings.customOutputFolder;
            pendingSaves.push({
                value,
                resolve: () => {
                    persisted = value;
                    resolve();
                }
            });
        }));
        const container = document.createElement('div');

        renderPandocExportSettingsSection({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        }, container, createDependencies());

        const input = getSettingRow(container, 'Custom output folder')
            .querySelector<HTMLInputElement>('input');
        if (!input) throw new Error('Custom output folder input not found.');

        fireInput(input, '/');
        fireInput(input, '/t');
        fireInput(input, '/tm');
        fireInput(input, '/tmp');
        fireInput(input, '/tmp/');

        expect(pendingSaves.map(save => save.value)).toEqual(['/']);

        pendingSaves[0].resolve();
        await flushPromises();

        expect(pendingSaves.map(save => save.value)).toEqual(['/', '/tmp/']);

        pendingSaves[1].resolve();
        await flushPromises();

        expect(persisted).toBe('/tmp/');
        expect(saveSettings).toHaveBeenCalledTimes(2);
    });

    it('keeps advanced-only controls out of the main settings section', () => {
        const settings = normalizePandocExportSettings({
            enabled: true,
            env: { TEXINPUTS: '${pluginDir}/textemplate/:' }
        });
        const container = document.createElement('div');

        renderPandocExportSettingsSection({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings: async () => undefined
        }, container, createDependencies());

        expect(getSettingRow(container, 'Pandoc export (beta)')).toBeTruthy();
        expect(getSettingRow(container, 'Advanced Pandoc settings')).toBeTruthy();
        expect(findSettingRow(container, 'Pandoc export')).toBeUndefined();
        expect(findSettingRow(container, 'Confirm before replacing files')).toBeUndefined();
        expect(findSettingRow(container, 'Open output file after export')).toBeUndefined();
        expect(findSettingRow(container, 'Reveal output file after export')).toBeUndefined();
        expect(findSettingRow(container, 'Show progress notices')).toBeUndefined();
        expect(findSettingRow(container, 'Environment overrides')).toBeUndefined();
        expect(findSettingRow(container, 'Suggest runtime environment variables')).toBeUndefined();
        expect(container.querySelector('textarea')).toBeNull();
    });

    it('updates ODT add-on settings through injected install and remove dependencies', async () => {
        const settings = normalizePandocExportSettings({
            enabled: true
        });
        const saveSettings = jest.fn(async () => undefined);
        const dependencies = createDependencies();
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
        const container = document.createElement('div');

        renderPandocExportSettingsSection({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        }, container, dependencies);

        let odtRow = getSettingRow(container, 'ODT preview support');
        expect(odtRow.textContent).toContain('Not installed');
        expect(odtRow.querySelector('input[type="checkbox"]')).toBeNull();
        expect(getButton(odtRow, 'Install').disabled).toBe(false);
        expect(getButton(odtRow, 'Remove').disabled).toBe(true);

        await clickButton(container, 'Install');

        expect(dependencies.installOdtPreviewAddon).toHaveBeenCalledWith({
            installDir: '/vault/.obsidian/pandoc-preview-addons'
        });
        expect(settings.preview.odtAddon).toMatchObject({
            enabled: true,
            status: 'installed',
            installPath: '/addons/webodf-test'
        });
        expect(saveSettings).toHaveBeenCalledTimes(1);
        odtRow = getSettingRow(container, 'ODT preview support');
        expect(odtRow.textContent).toContain('Installed (test).');
        expect(getButton(odtRow, 'Install').disabled).toBe(true);
        expect(getButton(odtRow, 'Remove').disabled).toBe(false);

        await clickButton(container, 'Remove');

        expect(dependencies.removeOdtPreviewAddon).toHaveBeenCalledWith(expect.objectContaining({
            installPath: '/addons/webodf-test'
        }));
        expect(settings.preview.odtAddon).toMatchObject({
            enabled: false,
            status: 'not-installed'
        });
        expect(saveSettings).toHaveBeenCalledTimes(2);
        odtRow = getSettingRow(container, 'ODT preview support');
        expect(odtRow.textContent).toContain('Not installed');
        expect(getButton(odtRow, 'Install').disabled).toBe(false);
        expect(getButton(odtRow, 'Remove').disabled).toBe(true);

        confirmSpy.mockRestore();
    });

    it('saves and removes advanced environment rows from a local draft', async () => {
        const settings = normalizePandocExportSettings({
            env: {
                TEXINPUTS: '${pluginDir}/textemplate/:',
                REMOVE_ME: 'old'
            }
        });
        const saveSettings = jest.fn(async () => undefined);
        const modal = new PandocExportAdvancedSettingsModal({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        }, createDependencies());

        modal.open();
        getEnvRows(modal)[1].querySelector<HTMLButtonElement>('button')?.click();
        const inputs = getEnvRows(modal)[0].querySelectorAll<HTMLInputElement>('input');
        inputs[1].focus();
        fireInput(inputs[1], '${currentDir}/tex:');
        clickButtonSync(modal.contentEl, 'Add variable');
        const blankInputs = getEnvRows(modal)[1].querySelectorAll<HTMLInputElement>('input');
        fireInput(blankInputs[0], 'EMPTY_VALUE');
        fireInput(blankInputs[1], '');
        await clickButton(modal.contentEl, 'Save and close');

        expect(settings.env).toEqual({
            TEXINPUTS: '${currentDir}/tex:',
            EMPTY_VALUE: ''
        });
        expect(saveSettings).toHaveBeenCalledTimes(1);
        expect(modal.contentEl.textContent).toBe('');
    });

    it('discards advanced draft changes when cancelled', async () => {
        const settings = normalizePandocExportSettings({
            env: { TEXINPUTS: '${pluginDir}/textemplate/:' }
        });
        const saveSettings = jest.fn(async () => undefined);
        const modal = new PandocExportAdvancedSettingsModal({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        }, createDependencies());

        modal.open();
        clickButtonSync(modal.contentEl, 'Add variable');
        const inputs = getEnvRows(modal)[1].querySelectorAll<HTMLInputElement>('input');
        fireInput(inputs[0], 'NEW_VAR');
        fireInput(inputs[1], 'new');
        await clickButton(modal.contentEl, 'Cancel changes');

        expect(settings.env).toEqual({ TEXINPUTS: '${pluginDir}/textemplate/:' });
        expect(saveSettings).not.toHaveBeenCalled();
    });

    it('ignores blank env rows and rejects duplicate or nameless env rows', async () => {
        const settings = normalizePandocExportSettings();
        const saveSettings = jest.fn(async () => undefined);
        const plugin = {
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        };
        const validModal = new PandocExportAdvancedSettingsModal(plugin, createDependencies());

        validModal.open();
        clickButtonSync(validModal.contentEl, 'Add variable');
        clickButtonSync(validModal.contentEl, 'Add variable');
        fireInput(getEnvRows(validModal)[0].querySelectorAll<HTMLInputElement>('input')[0], 'PATH');
        fireInput(getEnvRows(validModal)[0].querySelectorAll<HTMLInputElement>('input')[1], '/bin');
        await clickButton(validModal.contentEl, 'Save and close');

        expect(settings.env).toEqual({ PATH: '/bin' });
        expect(saveSettings).toHaveBeenCalledTimes(1);

        const duplicateModal = new PandocExportAdvancedSettingsModal(plugin, createDependencies());
        duplicateModal.open();
        clickButtonSync(duplicateModal.contentEl, 'Add variable');
        const duplicateInputs = getEnvRows(duplicateModal)[1].querySelectorAll<HTMLInputElement>('input');
        fireInput(duplicateInputs[0], 'PATH');
        fireInput(duplicateInputs[1], '/other');
        await clickButton(duplicateModal.contentEl, 'Save and close');

        expect(settings.env).toEqual({ PATH: '/bin' });
        expect(saveSettings).toHaveBeenCalledTimes(1);

        const namelessModal = new PandocExportAdvancedSettingsModal(plugin, createDependencies());
        namelessModal.open();
        clickButtonSync(namelessModal.contentEl, 'Add variable');
        fireInput(getEnvRows(namelessModal)[1].querySelectorAll<HTMLInputElement>('input')[1], 'value');
        await clickButton(namelessModal.contentEl, 'Save and close');

        expect(settings.env).toEqual({ PATH: '/bin' });
        expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    it('suggests runtime env variables only from the advanced opt-in toggle', () => {
        const settings = normalizePandocExportSettings({
            env: { TEXINPUTS: '' },
            suggestRuntimeEnvVariables: false
        });
        const modal = new PandocExportAdvancedSettingsModal({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings: async () => undefined
        }, createDependencies({ runtimeEnv: { HOME: '/home/test' } }));

        modal.open();
        typeEnvValueForSuggestions(modal, '${H');
        expect(envSuggestionNames(modal)).not.toContain('${HOME}');

        const toggle = getSettingRow(modal.contentEl, 'Suggest runtime environment variables')
            .querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!toggle) throw new Error('Runtime env toggle not found.');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));

        typeEnvValueForSuggestions(modal, '${H');
        expect(envSuggestionNames(modal)).toContain('${HOME}');
    });
});

function createDependencies(
    overrides: Partial<ObsidianPandocGuiDependencies> = {}
): ObsidianPandocGuiDependencies {
    return {
        catalogProcess: {
            run: async () => createRunResult(),
            getVersion: async () => ({
                available: true,
                version: '3.1',
                result: createRunResult()
            })
        },
        catalogShellRunner: async () => createRunResult(),
        exportSystem: {
            runProcess: async () => createRunResult(),
            runShell: async () => createRunResult(),
            exists: async () => false,
            ensureDir: async () => undefined,
            readText: async () => '',
            readBinary: async () => new Uint8Array(),
            writeFile: async () => undefined,
            removeFile: async () => undefined,
            makeTempPath: async extension => `/tmp/preview${extension}`,
            platform: () => ({ os: 'linux', isDesktop: true }),
            pathDelimiter: () => ':'
        },
        exportUser: {
            confirmOverwrite: async path => path,
            openOutput: async () => undefined,
            revealOutput: async () => undefined
        },
        installOdtPreviewAddon: jest.fn(async () => ({
            enabled: true,
            status: 'installed',
            version: 'test',
            installPath: '/addons/webodf-test'
        })),
        makePreviewTempPath: async (extension, runId) => `/tmp/preview-${runId}${extension}`,
        removeOdtPreviewAddon: jest.fn(async () => ({
            enabled: false,
            status: 'not-installed'
        })),
        ...overrides
    };
}

function createApp() {
    return {
        workspace: {
            getActiveFile: () => null
        },
        vault: {
            adapter: {
                getBasePath: () => '/vault',
                getFullPath: (path: string) => `/vault/${path}`
            },
            config: {},
            configDir: '.obsidian'
        },
        metadataCache: {
            getCache: () => null,
            getFirstLinkpathDest: () => null
        }
    } as never;
}

function createRunResult() {
    return {
        executable: 'pandoc',
        args: [],
        exitCode: 0,
        signal: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        durationMs: 1,
        ok: true
    };
}

async function clickButton(container: HTMLElement, label: string): Promise<void> {
    clickButtonSync(container, label);
    await Promise.resolve();
    await Promise.resolve();
}

function clickButtonSync(container: HTMLElement, label: string): void {
    getButton(container, label).click();
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll('button'))
        .find(item => item.textContent === label);
    if (!button) throw new Error(`Button not found: ${label}`);

    return button;
}

function findSettingRow(container: HTMLElement, name: string): HTMLElement | undefined {
    const rows = Array.from(container.querySelectorAll<HTMLElement>('.setting-item'));
    return rows.find(item => item.querySelector('.setting-item-name')?.textContent === name);
}

function getSettingRow(container: HTMLElement, name: string): HTMLElement {
    const row = findSettingRow(container, name);
    if (!row) throw new Error(`Setting not found: ${name}`);

    return row;
}

function getEnvRows(modal: PandocExportAdvancedSettingsModal): HTMLElement[] {
    return Array.from(modal.contentEl.querySelectorAll<HTMLElement>('.pem-pandoc-env-row'))
        .filter(row => !row.classList.contains('pem-pandoc-env-header'));
}

function fireInput(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

function fireSelectChange(select: HTMLSelectElement, value: string): void {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

function typeEnvValueForSuggestions(
    modal: PandocExportAdvancedSettingsModal,
    value: string
): void {
    const input = getEnvRows(modal)[0]
        .querySelectorAll<HTMLInputElement>('input')[1];
    input.focus();
    fireInput(input, value);
}

function envSuggestionNames(modal: PandocExportAdvancedSettingsModal): string[] {
    return Array.from(modal.contentEl.querySelectorAll<HTMLElement>('.pem-pandoc-variable-suggestion-name'))
        .map(item => item.textContent ?? '');
}
