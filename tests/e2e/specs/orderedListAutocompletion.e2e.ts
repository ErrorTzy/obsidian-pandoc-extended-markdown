import { browser, expect } from '@wdio/globals';

type OrderedListMarkerStyle =
    | 'decimal-period'
    | 'decimal-one-paren'
    | 'lower-alpha-period'
    | 'lower-alpha-one-paren'
    | 'lower-roman-period'
    | 'lower-roman-one-paren'
    | 'upper-alpha-period'
    | 'upper-alpha-one-paren'
    | 'upper-roman-period'
    | 'upper-roman-one-paren';

interface OrderedStyleCase {
    style: OrderedListMarkerStyle;
    label: string;
}

const INDENT = '    ';
const DEFAULT_ORDERED_LIST_MARKER_ORDER: OrderedListMarkerStyle[] = [
    'decimal-period',
    'lower-alpha-period',
    'lower-roman-period',
    'upper-alpha-period',
    'upper-roman-period',
    'decimal-one-paren',
    'lower-alpha-one-paren',
    'lower-roman-one-paren',
    'upper-alpha-one-paren',
    'upper-roman-one-paren'
];

const ORDERED_STYLE_CASES: OrderedStyleCase[] = [
    { style: 'decimal-period', label: 'decimal period' },
    { style: 'lower-alpha-period', label: 'lower alpha period' },
    { style: 'lower-roman-period', label: 'lower roman period' },
    { style: 'upper-alpha-period', label: 'upper alpha period' },
    { style: 'upper-roman-period', label: 'upper roman period' },
    { style: 'decimal-one-paren', label: 'decimal parenthesis' },
    { style: 'lower-alpha-one-paren', label: 'lower alpha parenthesis' },
    { style: 'lower-roman-one-paren', label: 'lower roman parenthesis' },
    { style: 'upper-alpha-one-paren', label: 'upper alpha parenthesis' },
    { style: 'upper-roman-one-paren', label: 'upper roman parenthesis' }
];

describe('Ordered list autocompletion behavior', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await configureOrderedListSettings();
    });

    for (const styleCase of ORDERED_STYLE_CASES) {
        describe(`${styleCase.label} root lists`, () => {
            beforeEach(async () => {
                await configureOrderedListSettings();
            });

            it('continues the root level, creates a fresh child level, continues the child level, and returns to root with Enter', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'enter-workflow');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`
                ].join('\n'));
                await placeCursorAtDocumentEnd();

                await pressKey('Enter');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${marker(root, 3)} `
                ].join('\n'));

                await pressKey('Tab');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} `
                ].join('\n'));

                await pressText('child');
                await pressKey('Enter');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${INDENT}${marker(child, 2)} `
                ].join('\n'));

                await pressKey('Enter');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${marker(root, 3)} `
                ].join('\n'));
            });

            it('outdents an empty child item to the root level and continues the root ordinal with Shift+Tab', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'shift-tab-empty-child');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(4);

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${marker(root, 3)} `
                ].join('\n'));
            });

            it('outdents a non-empty child item to the root level while preserving content with Shift+Tab', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'shift-tab-non-empty-child');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} child`
                ].join('\n'));
                await placeCursorAtDocumentEnd();

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${marker(root, 3)} child`
                ].join('\n'));
            });

            it('continues an existing target-level child sequence under the same parent when Tab creates a sibling', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'tab-existing-target-sibling');

                await openEditableDocument(path, [
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${marker(root, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(3);

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${INDENT}${marker(child, 2)} `
                ].join('\n'));
            });

            it('starts a new child sequence under the current parent instead of continuing an earlier parent subtree', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'tab-current-parent-scope');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} xxx`,
                    `${marker(root, 3)} xxx`,
                    `${marker(root, 4)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(6);

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} xxx`,
                    `${marker(root, 3)} xxx`,
                    `${INDENT}${marker(child, 1)} `
                ].join('\n'));
            });

            it('renumbers descendants in a moved subtree when auto-renumber lists is enabled', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const grandchild = nextStyle(child);
                const path = filePathFor(styleCase, 'tab-moved-subtree-renumber-enabled');

                await openEditableDocument(path, [
                    `${marker(root, 1)} parent`,
                    `${marker(root, 2)} mover`,
                    `${INDENT}${marker(child, 5)} child`,
                    `${INDENT}${marker(child, 7)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Tab', 600);

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} mover`,
                    `${INDENT}${INDENT}${marker(grandchild, 1)} child`,
                    `${INDENT}${INDENT}${marker(grandchild, 2)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
            });

            it('keeps descendant ordinals in a moved subtree when auto-renumber lists is disabled', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const grandchild = nextStyle(child);
                const path = filePathFor(styleCase, 'tab-moved-subtree-renumber-disabled');

                await configureOrderedListSettings({ autoRenumberLists: false });
                await openEditableDocument(path, [
                    `${marker(root, 1)} parent`,
                    `${marker(root, 2)} mover`,
                    `${INDENT}${marker(child, 5)} child`,
                    `${INDENT}${marker(child, 7)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Tab', 600);

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} mover`,
                    `${INDENT}${INDENT}${marker(grandchild, 5)} child`,
                    `${INDENT}${INDENT}${marker(grandchild, 7)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
            });

            it('preserves the current ordered marker style when ordered marker cycling is disabled', async () => {
                const root = styleCase.style;
                const path = filePathFor(styleCase, 'tab-cycling-disabled');

                await configureOrderedListSettings({ enableOrderedListMarkerCycling: false });
                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${INDENT}${marker(root, 1)} `
                ].join('\n'));
            });

            it('removes an empty top-level ordered marker with Enter', async () => {
                const root = styleCase.style;
                const path = filePathFor(styleCase, 'enter-empty-top-level');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Enter');

                expect(await getEditorText()).toBe(`${marker(root, 1)} xxx\n`);
            });
        });
    }
});

async function configureOrderedListSettings(
    overrides: Partial<Record<string, boolean | OrderedListMarkerStyle[]>> = {}
): Promise<void> {
    await browser.execute(async (settingsOverrides, orderedListMarkerOrder) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin) {
            // @ts-ignore
            await app.plugins.enablePlugin('pandoc-extended-markdown');
        }

        // @ts-ignore
        const enabledPlugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (enabledPlugin?.settings) {
            Object.assign(enabledPlugin.settings, {
                enableFancyLists: true,
                enableOrderedListMarkerCycling: true,
                autoRenumberLists: true,
                orderedListMarkerOrder
            }, settingsOverrides);
            await enabledPlugin.saveSettings();
        }
    }, overrides, DEFAULT_ORDERED_LIST_MARKER_ORDER);
}

async function openEditableDocument(filePath: string, content: string): Promise<void> {
    await browser.execute(async (path, data) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
            // @ts-ignore
            await app.vault.modify(file, data);
        } else {
            // @ts-ignore
            await app.vault.create(path, data);
        }
    }, filePath, content);

    await browser.execute(async (path) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            return;
        }

        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'source',
            source: false
        };
        await leaf.setViewState(state);
    }, filePath);

    const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await contentEl.waitForExist({ timeout: 5000 });
    await contentEl.click();
    await browser.pause(300);
}

async function placeCursorAtDocumentEnd(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        cm.dispatch({
            selection: { anchor: cm.state.doc.length }
        });
        cm.focus();
    });
}

async function placeCursorAtLineAfterMarker(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber) => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(targetLineNumber);
        const markerMatch = line.text.match(/^(\s*)(\d+|[A-Za-z]+)([.)])(\s+)/);
        if (!markerMatch) {
            return;
        }

        cm.dispatch({
            selection: {
                anchor: line.from + markerMatch[0].length
            }
        });
        cm.focus();
    }, lineNumber);
}

async function getEditorText(): Promise<string> {
    return browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        return cm?.state.doc.toString() ?? '';
    });
}

async function pressKey(key: string, pauseMs = 300): Promise<void> {
    await browser.keys(key);
    await browser.pause(pauseMs);
}

async function pressText(text: string, pauseMs = 300): Promise<void> {
    await browser.keys(text);
    await browser.pause(pauseMs);
}

async function pressShiftTab(pauseMs = 300): Promise<void> {
    await browser.keys(['Shift', 'Tab', 'NULL']);
    await browser.pause(pauseMs);
}

function filePathFor(styleCase: OrderedStyleCase, scenario: string): string {
    return `ordered-list-autocompletion-${styleCase.style}-${scenario}.md`;
}

function nextStyle(style: OrderedListMarkerStyle): OrderedListMarkerStyle {
    const index = DEFAULT_ORDERED_LIST_MARKER_ORDER.indexOf(style);
    return DEFAULT_ORDERED_LIST_MARKER_ORDER[(index + 1) % DEFAULT_ORDERED_LIST_MARKER_ORDER.length];
}

function marker(style: OrderedListMarkerStyle, ordinal: number): string {
    const delimiter = style.endsWith('one-paren') ? ')' : '.';

    if (style.startsWith('decimal')) {
        return `${ordinal}${delimiter}`;
    }

    if (style.includes('roman')) {
        return `${toRoman(ordinal, style.startsWith('upper'))}${delimiter}`;
    }

    return `${toAlpha(ordinal, style.startsWith('upper'))}${delimiter}`;
}

function toAlpha(ordinal: number, isUpperCase: boolean): string {
    let value = ordinal;
    let result = '';

    while (value > 0) {
        value -= 1;
        result = String.fromCharCode('a'.charCodeAt(0) + (value % 26)) + result;
        value = Math.floor(value / 26);
    }

    return isUpperCase ? result.toUpperCase() : result;
}

function toRoman(ordinal: number, isUpperCase: boolean): string {
    const pairs: Array<[number, string]> = [
        [1000, 'm'],
        [900, 'cm'],
        [500, 'd'],
        [400, 'cd'],
        [100, 'c'],
        [90, 'xc'],
        [50, 'l'],
        [40, 'xl'],
        [10, 'x'],
        [9, 'ix'],
        [5, 'v'],
        [4, 'iv'],
        [1, 'i']
    ];
    let value = ordinal;
    let result = '';

    for (const [amount, symbol] of pairs) {
        while (value >= amount) {
            result += symbol;
            value -= amount;
        }
    }

    return isUpperCase ? result.toUpperCase() : result;
}
