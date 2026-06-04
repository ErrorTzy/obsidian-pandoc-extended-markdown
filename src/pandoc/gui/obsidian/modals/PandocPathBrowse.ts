import type { OptionValueKind } from '../../../core';

type ValueInput = HTMLInputElement | HTMLSelectElement;

type BrowseKind = 'file' | 'folder';

export interface PandocPathBrowser {
    chooseFile(defaultPath?: string): Promise<string | undefined>;
    chooseFolder(defaultPath?: string): Promise<string | undefined>;
}

export interface PandocBrowseButtonOptions {
    browser?: PandocPathBrowser;
}

export function addBrowseButton(
    container: HTMLElement,
    valueKind: OptionValueKind | undefined,
    input: ValueInput,
    onChoose: (value: string) => void,
    options: PandocBrowseButtonOptions = {}
): void {
    const browseKind = browseKindForValue(valueKind);
    if (!browseKind) return;

    createButton(container, 'Browse', () => {
        void choosePath(browseKind, input, onChoose, options.browser);
    });
}

export function addFolderBrowseButton(
    container: HTMLElement,
    input: ValueInput,
    onChoose: (value: string) => void,
    options: PandocBrowseButtonOptions = {}
): void {
    createButton(container, 'Browse', () => {
        void choosePath('folder', input, onChoose, options.browser);
    });
}

function browseKindForValue(valueKind: OptionValueKind | undefined): BrowseKind | undefined {
    if (valueKind === 'file') return 'file';
    if (valueKind === 'directory' || valueKind === 'pathList') return 'folder';
    return undefined;
}

async function choosePath(
    browseKind: BrowseKind,
    input: ValueInput,
    onChoose: (value: string) => void,
    browser: PandocPathBrowser | undefined
): Promise<void> {
    if (!browser) return;
    const selected = browseKind === 'file'
        ? await browser.chooseFile(input.value)
        : await browser.chooseFolder(input.value);
    if (!selected) return;
    input.value = selected;
    onChoose(selected);
}

function createButton(
    container: HTMLElement,
    text: string,
    onClick: () => void,
    label = text
): HTMLButtonElement {
    const button = container.createEl('button', { text, attr: { 'aria-label': label } });
    button.onclick = onClick;
    return button;
}
