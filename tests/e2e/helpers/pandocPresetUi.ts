import { browser } from '@wdio/globals';

import {
    createOrReplaceFile,
    deleteFileIfExists,
    openFileInActiveLeaf
} from './pandocSyntaxParity';

export interface E2ePandocProfile {
    id: string;
    name: string;
    type: 'pandoc' | 'custom';
    extension: string;
    inputPath?: string;
    from?: string;
    to?: string;
    outputPath?: string;
    standalone?: boolean;
    resourcePaths?: string[];
    luaFilters?: string[];
    metadata?: Record<string, string>;
    extraArgs?: string[];
    commandTemplate?: string;
    shell?: boolean;
}

export interface PresetPanelState {
    title: string;
    selectedPresetId: string;
    selectedPresetName: string;
    optionLabels: string[];
    actionDisabled: Record<string, boolean>;
    nameValue: string;
    commandPreview: string;
    validationText: string;
    hasPresetIdField: boolean;
    presetFieldLabels: string[];
    outputFileName?: string;
    persistedProfiles: E2ePandocProfile[];
}

export const BUNDLED_FILTERS = [
    '${luaFilterDir}/FencedDivExtendedSyntax.lua',
    '${luaFilterDir}/CustomLabelList.lua'
];

export const COMMON_RESOURCE_PATHS = [
    '${currentDir}',
    '${attachmentFolderPath}',
    '${vaultDir}',
    '${embedDirs}'
];

export function defaultHtmlProfile(): E2ePandocProfile {
    return {
        id: 'html',
        name: 'HTML',
        type: 'pandoc',
        to: 'html',
        extension: '.html',
        standalone: true,
        resourcePaths: [...COMMON_RESOURCE_PATHS],
        luaFilters: [...BUNDLED_FILTERS],
        extraArgs: [
            '--embed-resources',
            '--metadata',
            'title=${currentFileName}',
            '--mathjax=https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js'
        ]
    };
}

export function modifiedHtmlProfile(): E2ePandocProfile {
    return {
        ...defaultHtmlProfile(),
        resourcePaths: ['/modified/html/assets', ...COMMON_RESOURCE_PATHS],
        extraArgs: [
            '--toc',
            ...(defaultHtmlProfile().extraArgs ?? [])
        ]
    };
}

export function defaultDocxProfile(): E2ePandocProfile {
    return {
        id: 'docx',
        name: 'DOCX',
        type: 'pandoc',
        to: 'docx',
        extension: '.docx',
        standalone: false,
        resourcePaths: [...COMMON_RESOURCE_PATHS],
        luaFilters: [...BUNDLED_FILTERS]
    };
}

export function researchHtmlProfile(): E2ePandocProfile {
    return {
        id: 'research-html',
        name: 'Research HTML',
        type: 'pandoc',
        inputPath: '${currentPath}',
        from: 'markdown',
        to: 'html',
        extension: '.html',
        outputPath: '${outputDir}/${currentFileName}-research${outputExtension}',
        standalone: false,
        resourcePaths: ['/research/assets'],
        luaFilters: [...BUNDLED_FILTERS],
        extraArgs: ['--toc']
    };
}

export function seedProfiles(): E2ePandocProfile[] {
    return [
        modifiedHtmlProfile(),
        defaultDocxProfile(),
        researchHtmlProfile()
    ];
}

export async function seedPandocExportSettings(
    profiles: E2ePandocProfile[],
    lastExportProfileId = profiles[0]?.id
): Promise<void> {
    await browser.execute(async (
        nextProfiles: E2ePandocProfile[],
        selectedProfileId: string | undefined
    ) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin?.settings) {
            throw new Error('Pandoc Extended Markdown plugin did not load.');
        }

        plugin.settings.pandocExport = {
            ...(plugin.settings.pandocExport ?? {}),
            enabled: true,
            pandocPath: '',
            defaultOutputFolderMode: 'current',
            customOutputFolder: '',
            lastOutputFolder: '',
            lastExportProfileId: selectedProfileId,
            showOverwriteConfirmation: false,
            openOutputFile: false,
            revealOutputFile: false,
            suggestRuntimeEnvVariables: false,
            profiles: JSON.parse(JSON.stringify(nextProfiles))
        };

        await plugin.saveSettings();
    }, profiles, lastExportProfileId);
}

export async function openCommandPresetPanel(): Promise<void> {
    await closeOpenModals();
    await browser.execute(() => {
        // @ts-ignore
        app.setting.open();
        // @ts-ignore
        app.setting.openTabById('pandoc-extended-markdown');
    });
    await browser.waitUntil(async () => await hasButton('Edit pandoc export'), {
        timeout: 10000,
        timeoutMsg: 'Expected Edit pandoc export settings button'
    });
    await clickGlobalButton('Edit pandoc export');
    await waitForPresetPanel('Pandoc export command');
}

export async function openExportPresetPanel(notePath: string): Promise<void> {
    await closeOpenModals();
    await createOrReplaceFile(notePath, '# Pandoc preset workflow\n');
    await openFileInActiveLeaf(notePath);
    await waitForActiveFile(notePath);
    await executeCommandBySuffix('pandoc-export');
    await waitForPresetPanel('Export with pandoc');
}

export async function getPresetPanelState(title: string): Promise<PresetPanelState> {
    return browser.execute((modalTitle: string) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        const modal = findModal(modalTitle);
        const select = modal.querySelector('.pem-pandoc-preset-section select') as HTMLSelectElement | null;
        const selectedOption = select?.selectedOptions[0];
        const actionButtons = Array.from(
            modal.querySelectorAll('.pem-pandoc-preset-actions button')
        ) as HTMLButtonElement[];
        const actions = Object.fromEntries(actionButtons.map(button => [
            actionKey(button.textContent ?? ''),
            button.disabled
        ]));
        const nameInput = findPresetNameInput(modal);
        const fieldLabels = Array.from(
            modal.querySelectorAll('.pem-pandoc-preset-field label')
        ).map(label => label.textContent ?? '');
        const outputInput = modal.querySelector(
            '.pem-pandoc-output-file-name-part input'
        ) as HTMLInputElement | null;

        return {
            title: modal.querySelector('.modal-title')?.textContent ?? '',
            selectedPresetId: select?.value ?? '',
            selectedPresetName: selectedOption?.textContent ?? '',
            optionLabels: Array.from(select?.options ?? []).map(option => option.textContent ?? ''),
            actionDisabled: actions,
            nameValue: nameInput?.value ?? '',
            commandPreview: modal.querySelector('.pem-pandoc-command-preview')?.textContent ?? '',
            validationText: modal.querySelector('.pem-pandoc-validation')?.textContent ?? '',
            hasPresetIdField: fieldLabels.some(label => label.trim().toLowerCase() === 'id'),
            presetFieldLabels: fieldLabels,
            outputFileName: outputInput?.value,
            persistedProfiles: JSON.parse(JSON.stringify(
                plugin.settings.pandocExport?.profiles ?? []
            ))
        };

        function findModal(expectedTitle: string): HTMLElement {
            const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
            const found = modals.find(item =>
                item.querySelector('.modal-title')?.textContent === expectedTitle);
            if (!found) throw new Error(`Modal not found: ${expectedTitle}`);
            return found;
        }

        function findPresetNameInput(root: HTMLElement): HTMLInputElement | null {
            const fields = Array.from(root.querySelectorAll('.pem-pandoc-preset-field')) as HTMLElement[];
            const field = fields.find(item =>
                item.querySelector('label')?.textContent === 'Name');
            return field?.querySelector('input') as HTMLInputElement | null;
        }

        function actionKey(label: string): string {
            return label.trim()
                .replace(/\s+([a-z])/g, (_, letter: string) => letter.toUpperCase())
                .replace(/^\w/, letter => letter.toLowerCase());
        }
    }, title);
}

export async function selectPreset(title: string, preset: string): Promise<void> {
    await browser.execute((modalTitle: string, presetNameOrId: string) => {
        const modal = findModal(modalTitle);
        const select = modal.querySelector('.pem-pandoc-preset-section select') as HTMLSelectElement | null;
        if (!select) throw new Error('Preset select not found.');
        const option = Array.from(select.options)
            .find(item => item.value === presetNameOrId || item.textContent === presetNameOrId);
        if (!option) throw new Error(`Preset not found: ${presetNameOrId}`);
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));

        function findModal(expectedTitle: string): HTMLElement {
            const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
            const found = modals.find(item =>
                item.querySelector('.modal-title')?.textContent === expectedTitle);
            if (!found) throw new Error(`Modal not found: ${expectedTitle}`);
            return found;
        }
    }, title, preset);
    await browser.waitUntil(async () =>
        (await getPresetPanelState(title)).selectedPresetName === preset ||
        (await getPresetPanelState(title)).selectedPresetId === preset, {
        timeout: 5000,
        timeoutMsg: `Expected selected preset ${preset}`
    });
}

export async function renamePreset(title: string, name: string): Promise<void> {
    await browser.execute((modalTitle: string, nextName: string) => {
        const modal = findModal(modalTitle);
        const fields = Array.from(modal.querySelectorAll('.pem-pandoc-preset-field')) as HTMLElement[];
        const field = fields.find(item => item.querySelector('label')?.textContent === 'Name');
        const input = field?.querySelector('input') as HTMLInputElement | null;
        if (!input) throw new Error('Preset name input not found.');
        input.value = nextName;
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        function findModal(expectedTitle: string): HTMLElement {
            const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
            const found = modals.find(item =>
                item.querySelector('.modal-title')?.textContent === expectedTitle);
            if (!found) throw new Error(`Modal not found: ${expectedTitle}`);
            return found;
        }
    }, title, name);
}

export async function clickPresetAction(title: string, label: string): Promise<void> {
    await browser.execute((modalTitle: string, buttonLabel: string) => {
        const modal = findModal(modalTitle);
        const buttons = Array.from(
            modal.querySelectorAll('.pem-pandoc-preset-actions button')
        ) as HTMLButtonElement[];
        const button = buttons.find(item => item.textContent === buttonLabel);
        if (!button) throw new Error(`Preset action not found: ${buttonLabel}`);
        button.click();

        function findModal(expectedTitle: string): HTMLElement {
            const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
            const found = modals.find(item =>
                item.querySelector('.modal-title')?.textContent === expectedTitle);
            if (!found) throw new Error(`Modal not found: ${expectedTitle}`);
            return found;
        }
    }, title, label);
    await browser.pause(50);
}

export async function editToFormat(title: string, format: string): Promise<void> {
    await editRowValue(title, 'to format', format);
}

export async function editResourcePath(title: string, value: string): Promise<void> {
    await editRowValue(title, '--resource-path', value);
}

export async function editOutputFileName(title: string, value: string): Promise<void> {
    await browser.execute((modalTitle: string, fileName: string) => {
        const modal = findModal(modalTitle);
        const input = modal.querySelector(
            '.pem-pandoc-output-file-name-part input'
        ) as HTMLInputElement | null;
        if (!input) throw new Error('Output file name input not found.');
        input.focus();
        input.dispatchEvent(new FocusEvent('focus'));
        input.value = fileName;
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        function findModal(expectedTitle: string): HTMLElement {
            const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
            const found = modals.find(item =>
                item.querySelector('.modal-title')?.textContent === expectedTitle);
            if (!found) throw new Error(`Modal not found: ${expectedTitle}`);
            return found;
        }
    }, title, value);
}

export async function clickSaveAndClose(): Promise<void> {
    await clickFooterButton('Pandoc export command', 'Save and close');
}

export async function clickCancel(title: string): Promise<void> {
    const label = title === 'Pandoc export command' ? 'Cancel changes' : 'Cancel';
    await clickFooterButton(title, label);
}

export async function getNoticeTexts(): Promise<string[]> {
    return browser.execute(() =>
        Array.from(document.querySelectorAll('.notice'))
            .map(notice => notice.textContent ?? '')
            .filter(Boolean)
    );
}

export async function waitForNoticeContaining(text: string): Promise<void> {
    await browser.waitUntil(async () =>
        (await getNoticeTexts()).some(notice => notice.includes(text)), {
        timeout: 5000,
        timeoutMsg: `Expected notice containing ${text}`
    });
}

export async function getPersistedProfiles(): Promise<E2ePandocProfile[]> {
    return browser.execute(() => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        return JSON.parse(JSON.stringify(plugin.settings.pandocExport?.profiles ?? []));
    });
}

export async function closeOpenModals(): Promise<void> {
    await browser.execute(() => {
        for (const button of Array.from(document.querySelectorAll('.modal-close-button'))) {
            (button as HTMLButtonElement).click();
        }
    });
}

export async function deleteVaultFileIfExists(path: string): Promise<void> {
    await deleteFileIfExists(path);
}

export async function installSettingsSaveHarness(): Promise<void> {
    await browser.execute(() => {
        type SaveCall = {
            resolved: boolean;
            sequence: number;
            resolve: () => void;
            snapshot: Record<string, unknown>;
        };
        type HarnessWindow = Window & {
            __pemPersistedSettings?: Record<string, unknown>;
            __pemPersistedSaveSequence?: number;
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
        const originalSaveSettings = plugin.saveSettings.bind(plugin);
        const calls: SaveCall[] = [];
        let sequence = 0;
        host.__pemSettingsSaveCalls = calls;
        host.__pemPersistedSettings = undefined;
        host.__pemPersistedSaveSequence = 0;
        host.__pemRestoreSettingsSave = () => {
            plugin.saveSettings = originalSaveSettings;
            delete host.__pemRestoreSettingsSave;
            delete host.__pemSettingsSaveCalls;
            delete host.__pemPersistedSaveSequence;
        };

        plugin.saveSettings = () => {
            sequence += 1;
            const callSequence = sequence;
            const snapshot = JSON.parse(JSON.stringify(plugin.settings));
            return new Promise<void>(resolve => {
                calls.push({
                    resolved: false,
                    sequence: callSequence,
                    snapshot,
                    resolve: () => {
                        if (callSequence >= (host.__pemPersistedSaveSequence ?? 0)) {
                            host.__pemPersistedSaveSequence = callSequence;
                            host.__pemPersistedSettings = snapshot;
                        }
                        resolve();
                    }
                });
            });
        };
    });
}

export async function restoreSettingsSaveHarness(): Promise<void> {
    await browser.execute(() => {
        type HarnessWindow = Window & {
            __pemRestoreSettingsSave?: () => void;
        };
        (window as HarnessWindow).__pemRestoreSettingsSave?.();
    });
}

export async function resolveSettingsSavesOldestLast(): Promise<void> {
    await browser.execute(async () => {
        type SaveCall = {
            resolved: boolean;
            sequence: number;
            resolve: () => void;
        };
        type HarnessWindow = Window & {
            __pemSettingsSaveCalls?: SaveCall[];
        };
        const delay = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
        const calls = (window as HarnessWindow).__pemSettingsSaveCalls;
        if (!calls) throw new Error('Settings save harness is not installed.');

        let idleRounds = 0;
        for (let safety = 0; safety < 30 && idleRounds < 2; safety += 1) {
            const pending = calls
                .filter(call => !call.resolved)
                .sort((a, b) => b.sequence - a.sequence);
            if (pending.length === 0) {
                idleRounds += 1;
                await delay(25);
                continue;
            }

            idleRounds = 0;
            pending[0].resolved = true;
            pending[0].resolve();
            await delay(25);
        }
    });
}

export async function getHarnessPersistedProfiles(): Promise<E2ePandocProfile[]> {
    return browser.execute(() => {
        type HarnessWindow = Window & {
            __pemPersistedSettings?: {
                pandocExport?: {
                    profiles?: E2ePandocProfile[];
                };
            };
        };
        return (window as HarnessWindow).__pemPersistedSettings
            ?.pandocExport
            ?.profiles ?? [];
    });
}

async function editRowValue(title: string, rowLabel: string, value: string): Promise<void> {
    await browser.execute((modalTitle: string, label: string, nextValue: string) => {
        const modal = findModal(modalTitle);
        const rows = Array.from(modal.querySelectorAll('.pem-pandoc-builder-row')) as HTMLElement[];
        const row = rows.find(item => {
            const visibleLabel = item.querySelector('.pem-pandoc-key-label')?.textContent;
            const keyInput = item.querySelector('.pem-pandoc-key-input') as HTMLInputElement | null;
            return visibleLabel === label || keyInput?.value === label;
        });
        if (!row) throw new Error(`Command row not found: ${label}`);
        const input = row.querySelector('.pem-pandoc-value-cell input') as HTMLInputElement | null;
        if (!input) throw new Error(`Command row input not found: ${label}`);
        input.focus();
        input.dispatchEvent(new FocusEvent('focus'));
        input.value = nextValue;
        input.dispatchEvent(new InputEvent('input', { bubbles: true }));

        function findModal(expectedTitle: string): HTMLElement {
            const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
            const found = modals.find(item =>
                item.querySelector('.modal-title')?.textContent === expectedTitle);
            if (!found) throw new Error(`Modal not found: ${expectedTitle}`);
            return found;
        }
    }, title, rowLabel, value);
    await browser.pause(50);
}

async function waitForPresetPanel(title: string): Promise<void> {
    await browser.waitUntil(async () => {
        const state = await browser.execute((modalTitle: string) => {
            const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
            const modal = modals.find(item =>
                item.querySelector('.modal-title')?.textContent === modalTitle);
            if (!modal) return { ready: false };
            return {
                ready: Boolean(modal.querySelector('.pem-pandoc-command-preview')) &&
                    Boolean(modal.querySelector('.pem-pandoc-preset-section select')) &&
                    modal.querySelectorAll('.pem-pandoc-builder-row').length > 0
            };
        }, title);
        return state.ready;
    }, {
        timeout: 10000,
        timeoutMsg: `Expected preset panel ${title}`
    });
}

async function hasButton(label: string): Promise<boolean> {
    return browser.execute((buttonLabel: string) =>
        Array.from(document.querySelectorAll('button'))
            .some(button => button.textContent === buttonLabel),
    label);
}

async function clickGlobalButton(label: string): Promise<void> {
    await browser.execute((buttonLabel: string) => {
        const button = Array.from(document.querySelectorAll('button'))
            .find(item => item.textContent === buttonLabel) as HTMLButtonElement | undefined;
        if (!button) throw new Error(`Button not found: ${buttonLabel}`);
        button.click();
    }, label);
}

async function clickFooterButton(title: string, label: string): Promise<void> {
    await browser.execute((modalTitle: string, buttonLabel: string) => {
        const modals = Array.from(document.querySelectorAll('.modal')) as HTMLElement[];
        const modal = modals.find(item =>
            item.querySelector('.modal-title')?.textContent === modalTitle);
        if (!modal) throw new Error(`Modal not found: ${modalTitle}`);
        const button = Array.from(modal.querySelectorAll('.pem-pandoc-command-footer button'))
            .find(item => item.textContent === buttonLabel) as HTMLButtonElement | undefined;
        if (!button) throw new Error(`Footer button not found: ${buttonLabel}`);
        button.click();
    }, title, label);
    await browser.pause(50);
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
