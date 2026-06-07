import { browser, expect } from '@wdio/globals';

describe('Pandoc export settings', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
    });

    afterEach(async () => {
        await restoreSettingsSaveHarness();
        await closeSettingsModal();
    });

    it('persists the full custom output folder after closing settings during pending saves', async () => {
        await installSettingsSaveHarness();
        await openPandocSettings();

        expect(await hasSettingRow('Custom output folder')).toBe(false);

        await selectDefaultOutputFolderMode('custom');
        await browser.waitUntil(async () => await hasSettingRow('Custom output folder'), {
            timeout: 5000,
            timeoutMsg: 'Expected custom output folder setting after selecting custom mode'
        });

        await typeCustomOutputFolder('/tmp/');
        await closeSettingsModal();
        await resolveSettingsSavesNewestFirst();

        expect(await getPersistedCustomOutputFolder()).toBe('/tmp/');
    });
});

async function openPandocSettings(): Promise<void> {
    await browser.execute(() => {
        for (const button of Array.from(document.querySelectorAll('.modal-close-button'))) {
            (button as HTMLButtonElement).click();
        }
        // @ts-ignore
        app.setting.open();
        // @ts-ignore
        app.setting.openTabById('pandoc-extended-markdown');
    });
    await browser.waitUntil(async () => await hasSettingRow('Default output folder'), {
        timeout: 10000,
        timeoutMsg: 'Expected Pandoc Extended Markdown settings tab'
    });
}

async function closeSettingsModal(): Promise<void> {
    await browser.execute(() => {
        for (const button of Array.from(document.querySelectorAll('.modal-close-button'))) {
            (button as HTMLButtonElement).click();
        }
    });
}

async function hasSettingRow(name: string): Promise<boolean> {
    return browser.execute((settingName: string) => {
        const rows = Array.from(document.querySelectorAll('.setting-item')) as HTMLElement[];
        return rows.some(row =>
            row.querySelector('.setting-item-name')?.textContent === settingName);
    }, name);
}

async function selectDefaultOutputFolderMode(mode: string): Promise<void> {
    await browser.execute((nextMode: string) => {
        const rows = Array.from(document.querySelectorAll('.setting-item')) as HTMLElement[];
        const row = rows.find(item =>
            item.querySelector('.setting-item-name')?.textContent === 'Default output folder');
        const select = row?.querySelector('select') as HTMLSelectElement | null;
        if (!select) throw new Error('Default output folder select not found.');
        select.value = nextMode;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }, mode);
}

async function typeCustomOutputFolder(value: string): Promise<void> {
    await browser.execute((folder: string) => {
        const rows = Array.from(document.querySelectorAll('.setting-item')) as HTMLElement[];
        const row = rows.find(item =>
            item.querySelector('.setting-item-name')?.textContent === 'Custom output folder');
        const input = row?.querySelector('input') as HTMLInputElement | null;
        if (!input) throw new Error('Custom output folder input not found.');

        for (let index = 1; index <= folder.length; index += 1) {
            const partial = folder.slice(0, index);
            input.value = partial;
            input.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
    }, value);
}

async function installSettingsSaveHarness(): Promise<void> {
    await browser.execute(() => {
        type SaveCall = {
            resolved: boolean;
            resolve: () => void;
            snapshot: Record<string, unknown>;
        };
        type HarnessWindow = Window & {
            __pemPersistedSettings?: Record<string, unknown>;
            __pemRestoreSettingsSave?: () => void;
            __pemSettingsSaveCalls?: SaveCall[];
        };
        const host = window as HarnessWindow;
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin?.settings) {
            throw new Error('Pandoc Extended Markdown plugin did not load.');
        }

        host.__pemRestoreSettingsSave?.();
        plugin.settings.pandocExport = {
            ...(plugin.settings.pandocExport ?? {}),
            enabled: true,
            defaultOutputFolderMode: 'current',
            customOutputFolder: ''
        };

        const originalSaveSettings = plugin.saveSettings.bind(plugin);
        const calls: SaveCall[] = [];
        host.__pemSettingsSaveCalls = calls;
        host.__pemPersistedSettings = undefined;
        host.__pemRestoreSettingsSave = () => {
            plugin.saveSettings = originalSaveSettings;
            delete host.__pemRestoreSettingsSave;
            delete host.__pemSettingsSaveCalls;
        };

        plugin.saveSettings = () => {
            const snapshot = JSON.parse(JSON.stringify(plugin.settings));
            plugin.settings = JSON.parse(JSON.stringify(plugin.settings));

            return new Promise<void>(resolve => {
                calls.push({
                    resolved: false,
                    snapshot,
                    resolve: () => {
                        host.__pemPersistedSettings = snapshot;
                        resolve();
                    }
                });
            });
        };
    });
}

async function restoreSettingsSaveHarness(): Promise<void> {
    await browser.execute(() => {
        type HarnessWindow = Window & {
            __pemRestoreSettingsSave?: () => void;
        };
        (window as HarnessWindow).__pemRestoreSettingsSave?.();
    });
}

async function resolveSettingsSavesNewestFirst(): Promise<void> {
    await browser.execute(async () => {
        type SaveCall = {
            resolved: boolean;
            resolve: () => void;
        };
        type HarnessWindow = Window & {
            __pemSettingsSaveCalls?: SaveCall[];
        };
        const delay = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
        const host = window as HarnessWindow;
        const calls = host.__pemSettingsSaveCalls;
        if (!calls) throw new Error('Settings save harness is not installed.');

        let idleRounds = 0;
        for (let safety = 0; safety < 20 && idleRounds < 2; safety += 1) {
            const pendingIndex = calls.reduce((lastIndex, call, index) =>
                call.resolved ? lastIndex : index, -1);
            if (pendingIndex === -1) {
                idleRounds += 1;
                await delay(25);
                continue;
            }

            idleRounds = 0;
            calls[pendingIndex].resolved = true;
            calls[pendingIndex].resolve();
            await delay(25);
        }
    });
}

async function getPersistedCustomOutputFolder(): Promise<string | undefined> {
    return browser.execute(() => {
        type HarnessWindow = Window & {
            __pemPersistedSettings?: {
                pandocExport?: {
                    customOutputFolder?: string;
                };
            };
        };
        return (window as HarnessWindow).__pemPersistedSettings
            ?.pandocExport
            ?.customOutputFolder;
    });
}
