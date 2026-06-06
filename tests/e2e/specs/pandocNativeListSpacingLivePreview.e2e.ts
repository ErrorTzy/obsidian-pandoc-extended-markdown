import { browser, expect } from '@wdio/globals';

interface NativeListLineState {
    text: string;
    className: string;
    paddingInlineStart: string;
    textIndent: string;
    markerText: string;
    markerColor: string;
    markerFontSize: string;
}

const filePath = 'pandoc-native-list-spacing-live-preview.md';

const content = [
    'Intro paragraph',
    '- invalid dash',
    '* invalid star',
    '+ invalid plus',
    'After unordered paragraph',
    '',
    '- valid dash',
    '* valid star',
    '+ valid plus',
    '',
    'Before ordered paragraph',
    '1. invalid ordered one',
    '2. invalid ordered two',
    'After ordered paragraph'
].join('\n');

describe('Pandoc native list spacing in Live Preview', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await setSyntaxSettings({ enforcePandocListSpacing: true });
        await createOrReplaceFile(filePath, content);
    });

    after(async () => {
        await setSyntaxSettings({ enforcePandocListSpacing: false });
        await deleteFileIfExists(filePath);
    });

    it('renders native list markers as plain text when Pandoc spacing is invalid', async () => {
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(1);

        await browser.waitUntil(async () => {
            const lines = await getNativeListLines();
            return lines.some(line => line.text.includes('- invalid dash')) &&
                lines.some(line => line.text.includes('1. invalid ordered one'));
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected native list lines in Live Preview'
        });

        const lines = await getNativeListLines();
        const invalidLines = lines.filter(line => line.text.includes('invalid'));
        const validLines = lines.filter(line => line.text.includes('valid') && !line.text.includes('invalid'));

        expect(invalidLines).toHaveLength(5);
        expect(validLines).toHaveLength(3);

        for (const line of invalidLines) {
            expect(line.className).toContain('pem-pandoc-invalid-native-list');
            expect(parseFloat(line.paddingInlineStart)).toBeLessThan(2);
            expect(parseFloat(line.textIndent)).toBeGreaterThanOrEqual(0);
            expect(line.markerText).not.toBe('');
            expect(line.markerColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(parseFloat(line.markerFontSize)).toBeGreaterThan(0);
        }

        for (const line of validLines) {
            expect(line.className).toContain('HyperMD-list-line');
            expect(line.className).not.toContain('pem-pandoc-invalid-native-list');
            expect(parseFloat(line.paddingInlineStart)).toBeGreaterThan(2);
        }
    });
});

async function getNativeListLines(): Promise<NativeListLineState[]> {
    return browser.execute((): NativeListLineState[] => {
        const source = document.querySelector('.markdown-source-view');
        const targetText = [
            '- invalid dash',
            '* invalid star',
            '+ invalid plus',
            '- valid dash',
            '* valid star',
            '+ valid plus',
            '1. invalid ordered one',
            '2. invalid ordered two'
        ];

        return Array.from(source?.querySelectorAll('.cm-line') ?? [])
            .map(line => {
                const element = line as HTMLElement;
                const text = element.textContent ?? '';
                const marker = element.querySelector(
                    '.cm-formatting-list-ul, .cm-formatting-list-ol, .list-bullet'
                ) as HTMLElement | null;
                const markerStyle = marker
                    ? window.getComputedStyle(marker)
                    : null;
                const lineStyle = window.getComputedStyle(element);

                return {
                    text,
                    className: element.className,
                    paddingInlineStart: lineStyle.paddingInlineStart,
                    textIndent: lineStyle.textIndent,
                    markerText: marker?.textContent?.trim() ?? '',
                    markerColor: markerStyle?.color ?? '',
                    markerFontSize: markerStyle?.fontSize ?? ''
                };
            })
            .filter(line => targetText.some(text => line.text.includes(text)));
    });
}

async function setSyntaxSettings(settings: Partial<{
    enforcePandocListSpacing: boolean;
}>): Promise<void> {
    await browser.execute(async (nextSettings) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            Object.assign(plugin.settings, nextSettings);
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, settings);
    await browser.pause(300);
}

async function createOrReplaceFile(path: string, data: string): Promise<void> {
    await browser.execute(async (filePath: string, content: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, content);
            return;
        }
        // @ts-ignore
        await app.vault.create(filePath, content);
    }, path, data);
}

async function openFileInActiveLeaf(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            await app.workspace.getLeaf().openFile(file);
        }
    }, path);
}

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'source',
            source: false
        };
        await leaf.setViewState(state);
        // @ts-ignore
        app.workspace.updateOptions();
    });
    await browser.pause(500);
}

async function moveCursorToLine(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const cm = leaf?.view?.editor?.cm;
        if (!cm) return;
        const line = cm.state.doc.line(targetLineNumber);
        cm.dispatch({ selection: { anchor: line.from } });
        cm.focus();
    }, lineNumber);
    await browser.pause(250);
}

async function deleteFileIfExists(path: string): Promise<void> {
    await browser.execute(async (filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            await app.vault.delete(file);
        }
    }, path);
}
