import { browser, expect } from '@wdio/globals';
import { execFileSync } from 'child_process';
import {
    mkdir,
    readFile,
    rm
} from 'fs/promises';
import { resolve } from 'path';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    openFileInActiveLeaf
} from '../helpers/pandocSyntaxParity';

const fixtureDir = resolve('tests/e2e/fixtures/pandoc-export');
const inputFixturePath = resolve(fixtureDir, 'extended-syntax.md');
const outputDir = resolve('tests/e2e/.tmp/pandoc-export-modal-close');
const vaultNotePath = 'pandoc-export-modal-close.md';
const profileId = 'e2e-html-fragment';

describe('Pandoc export modal', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
    });

    after(async () => {
        await restoreElectronOpenPath();
        await deleteFileIfExists(vaultNotePath);
        await rm(outputDir, { recursive: true, force: true });
    });

    it('closes after successful export even when opening the exported file hangs', async function () {
        const pandocPath = getPandocPath();
        if (!pandocPath) {
            this.skip();
        }

        await rm(outputDir, { recursive: true, force: true });
        await mkdir(outputDir, { recursive: true });
        await createOrReplaceFile(vaultNotePath, await readFile(inputFixturePath, 'utf8'));
        await openFileInActiveLeaf(vaultNotePath);
        await waitForActiveFile(vaultNotePath);
        await configurePandocExport(pandocPath);
        await makeElectronOpenPathHang();

        await executeCommandBySuffix('pandoc-export');
        await waitForExportModal(true);
        await clickExportButton();

        await browser.waitUntil(async () => !await hasExportModal(), {
            timeout: 10000,
            timeoutMsg: 'Expected Pandoc export modal to close after successful export'
        });
        expect(await hasExportModal()).toBe(false);
    });
});

function getPandocPath(): string | undefined {
    try {
        const pandocPath = execFileSync('which', ['pandoc'], { encoding: 'utf8' }).trim();
        execFileSync(pandocPath, ['--version'], { stdio: 'ignore' });
        return pandocPath;
    } catch {
        return undefined;
    }
}

async function configurePandocExport(pandocPath: string): Promise<void> {
    await browser.execute(async (
        executable: string,
        folder: string,
        profile: string
    ) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin?.settings) {
            throw new Error('Pandoc Extended Markdown plugin did not load.');
        }

        plugin.settings.pandocExport = {
            ...(plugin.settings.pandocExport ?? {}),
            enabled: true,
            pandocPath: executable,
            defaultOutputFolderMode: 'custom',
            customOutputFolder: folder,
            lastOutputFolder: folder,
            lastExportProfileId: profile,
            showOverwriteConfirmation: false,
            openOutputFile: true,
            revealOutputFile: false,
            showProgress: false,
            profiles: [{
                id: profile,
                name: 'E2E HTML fragment',
                type: 'pandoc',
                from: [
                    'markdown',
                    '+fancy_lists',
                    '+definition_lists',
                    '+fenced_divs',
                    '+superscript',
                    '+subscript',
                    '+wikilinks_title_after_pipe'
                ].join(''),
                to: 'html',
                extension: '.html',
                standalone: false,
                luaFilters: [
                    '${luaFilterDir}/FencedDivExtendedSyntax.lua',
                    '${luaFilterDir}/CustomLabelList.lua'
                ],
                resourcePaths: ['${currentDir}', '${vaultDir}']
            }]
        };

        await plugin.saveSettings();
    }, pandocPath, outputDir, profileId);
}

async function makeElectronOpenPathHang(): Promise<void> {
    await browser.execute(() => {
        const host = window as typeof window & {
            require?: (name: string) => {
                remote?: {
                    shell?: {
                        openPath?: (path: string) => Promise<string>;
                    };
                };
            };
            __pemRestoreOpenPath?: () => void;
        };
        const electron = host.require?.('electron');
        const shell = electron?.remote?.shell;
        const originalOpenPath = shell?.openPath;
        if (!shell || !originalOpenPath) {
            throw new Error('Electron shell.openPath is unavailable.');
        }

        host.__pemRestoreOpenPath = () => {
            shell.openPath = originalOpenPath;
        };
        shell.openPath = () => {
            return new Promise(() => undefined);
        };
    });
}

async function restoreElectronOpenPath(): Promise<void> {
    await browser.execute(() => {
        const host = window as typeof window & {
            __pemRestoreOpenPath?: () => void;
        };
        host.__pemRestoreOpenPath?.();
        delete host.__pemRestoreOpenPath;
    });
}

async function executeCommandBySuffix(suffix: string): Promise<void> {
    await browser.execute(async (commandSuffix: string) => {
        // @ts-ignore
        const commands = app.commands.commands ?? {};
        const commandId = Object.keys(commands).find(id =>
            id === commandSuffix || id.endsWith(`:${commandSuffix}`)
        );
        if (!commandId) {
            throw new Error(`Command not registered: ${commandSuffix}`);
        }

        const command = commands[commandId];
        if (typeof command.callback === 'function') {
            await command.callback();
            return;
        }

        // @ts-ignore
        await app.commands.executeCommandById(commandId);
    }, suffix);
}

async function waitForActiveFile(path: string): Promise<void> {
    await browser.waitUntil(async () => {
        return browser.execute((filePath: string) => {
            // @ts-ignore
            return app.workspace.getActiveFile()?.path === filePath;
        }, path);
    }, {
        timeout: 5000,
        timeoutMsg: `Expected active file ${path}`
    });
}

async function waitForExportModal(expected: boolean): Promise<void> {
    await browser.waitUntil(async () => await hasExportModal() === expected, {
        timeout: 5000,
        timeoutMsg: expected ? 'Expected Pandoc export modal to open' : 'Expected Pandoc export modal to close'
    });
}

async function hasExportModal(): Promise<boolean> {
    return browser.execute(() => {
        return Array.from(document.querySelectorAll('.modal-title'))
            .some(title => title.textContent === 'Export with pandoc');
    });
}

async function clickExportButton(): Promise<void> {
    await browser.execute(() => {
        const buttons = Array.from(document.querySelectorAll('.modal button'));
        const exportButton = buttons.find(button => button.textContent === 'Export') as HTMLButtonElement | undefined;
        if (!exportButton) {
            throw new Error('Export button not found.');
        }
        exportButton.click();
    });
}
