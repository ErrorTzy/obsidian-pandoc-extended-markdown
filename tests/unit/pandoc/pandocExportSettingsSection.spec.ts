import { describe, expect, it, jest } from '@jest/globals';

import {
    normalizePandocExportSettings
} from '../../../src/pandoc';
import {
    renderPandocExportSettingsSection
} from '../../../src/pandoc/gui/obsidian/settings/pandocExportSettingsSection';
import type {
    ObsidianPandocGuiDependencies
} from '../../../src/pandoc/gui/obsidian/dependencies';

describe('Pandoc export settings section', () => {
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

        container.innerHTML = '';
        renderPandocExportSettingsSection({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as never,
            settings: { pandocExport: settings } as never,
            saveSettings
        }, container, dependencies);

        await clickButton(container, 'Remove');

        expect(dependencies.removeOdtPreviewAddon).toHaveBeenCalledWith(expect.objectContaining({
            installPath: '/addons/webodf-test'
        }));
        expect(settings.preview.odtAddon).toMatchObject({
            enabled: false,
            status: 'not-installed'
        });
        expect(saveSettings).toHaveBeenCalledTimes(2);

        confirmSpy.mockRestore();
    });
});

function createDependencies(): ObsidianPandocGuiDependencies {
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
        }))
    };
}

function createApp() {
    return {
        vault: {
            adapter: {
                getBasePath: () => '/vault'
            },
            configDir: '.obsidian'
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
    const button = Array.from(container.querySelectorAll('button'))
        .find(item => item.textContent === label);
    if (!button) throw new Error(`Button not found: ${label}`);

    button.click();
    await Promise.resolve();
}
