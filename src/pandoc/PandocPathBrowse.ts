import { ElectronPandocDesktopAdapter } from './desktopAdapter';
import type { OptionValueKind } from './gui-core';

type ValueInput = HTMLInputElement | HTMLSelectElement;

type BrowseKind = 'file' | 'folder';

export function addBrowseButton(
    container: HTMLElement,
    valueKind: OptionValueKind | undefined,
    input: ValueInput,
    onChoose: (value: string) => void
): void {
    const browseKind = browseKindForValue(valueKind);
    if (!browseKind) return;

    createButton(container, 'Browse', () => {
        void choosePath(browseKind, input, onChoose);
    });
}

export function addFolderBrowseButton(
    container: HTMLElement,
    input: ValueInput,
    onChoose: (value: string) => void
): void {
    createButton(container, 'Browse', () => {
        void choosePath('folder', input, onChoose);
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
    onChoose: (value: string) => void
): Promise<void> {
    const desktop = new ElectronPandocDesktopAdapter();
    const selected = browseKind === 'file'
        ? await desktop.chooseFile(input.value)
        : await desktop.chooseFolder(input.value);
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
