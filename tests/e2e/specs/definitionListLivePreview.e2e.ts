import { browser, expect } from '@wdio/globals';

type DefinitionListRenderMode = 'live' | 'reading';

const definitionListCssSnippetName = 'pem-definition-list-css-hooks';
const definitionListCssSnippetPath = `.obsidian/snippets/${definitionListCssSnippetName}.css`;

describe('Definition list live preview', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await browser.execute(() => {
            // @ts-ignore
            const plugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (!plugin) {
                // @ts-ignore
                return app.plugins.enablePlugin('pandoc-extended-markdown');
            }
            if (plugin?.settings) {
                plugin.settings.enableDefinitionLists = true;
                plugin.saveSettings();
                // @ts-ignore
                app.workspace.updateOptions();
            }
        });
    });

    it('aligns definition items with ordinary unordered list items in live preview', async () => {
        const filePath = 'definition-list-live-preview-alignment.md';
        const content = `plain text

- ordinary lists

Definition term
: definition list

- ordinary lists

plain text`;

        try {
            await createOrReplaceFile(filePath, content);
            await openFileInActiveLeaf(filePath);
            await ensureLivePreviewMode();
            await waitForDefinitionMarkerWidget();

            await browser.waitUntil(async () => {
                const state = await getDefinitionListAlignmentState();
                return state.ready;
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected ordinary and definition list text to render in live preview'
            });

            const state = await getDefinitionListAlignmentState();

            expect(state.ready).toBe(true);
            expect(state.termToPlainDelta).toBeLessThanOrEqual(1);
            expect(state.definitionToOrdinaryDelta).toBeLessThanOrEqual(1);
        } finally {
            await deleteFileIfExists(filePath);
        }
    });

    it('aligns definition descriptions with ordinary unordered list items in reading mode', async () => {
        const filePath = 'definition-list-reading-mode-alignment.md';
        const content = `plain text

- ordinary lists

Definition term
: definition list

- ordinary lists

plain text`;

        try {
            await createOrReplaceFile(filePath, content);
            await openFileInActiveLeaf(filePath);
            await ensureReadingMode();

            await browser.waitUntil(async () => {
                const state = await getReadingModeDefinitionListAlignmentState();
                return state.ready;
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected ordinary and definition list text to render in reading mode'
            });

            const state = await getReadingModeDefinitionListAlignmentState();

            expect(state.ready).toBe(true);
            expect(state.termToPlainDelta).toBeLessThanOrEqual(1);
            expect(state.definitionToOrdinaryDelta).toBeLessThanOrEqual(1);
        } finally {
            await deleteFileIfExists(filePath);
        }
    });

    it('shows source definition marker text when a selection range intersects it', async () => {
        const filePath = 'definition-list-live-preview-selection.md';
        const content = 'Description Term\n: details1';

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await waitForDefinitionMarkerWidget();

        const beforeSelection = await getDefinitionMarkerRenderState();

        expect(beforeSelection.markerWidgets).toBeGreaterThanOrEqual(1);
        expect(beforeSelection.cursorMarkers).toBe(0);

        await browser.execute(() => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            const view = leaf?.view;
            const cm = view?.editor?.cm;
            if (!cm) {
                return;
            }

            const termLine = cm.state.doc.line(1);
            const definitionLine = cm.state.doc.line(2);
            cm.dispatch({
                selection: {
                    anchor: termLine.from,
                    head: definitionLine.from + 2
                }
            });
            cm.focus();
        });

        await browser.waitUntil(async () => {
            const state = await getDefinitionMarkerRenderState();
            return state.cursorMarkers >= 1 && state.markerWidgets === 0;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected selected definition marker to render as source text'
        });

        const selectedState = await getDefinitionMarkerRenderState();

        expect(selectedState.definitionLineText).toContain(': details1');
        expect(selectedState.cursorMarkerText).toContain(':');
        expect(selectedState.markerWidgets).toBe(0);

        await deleteFileIfExists(filePath);
    });

    for (const mode of ['live', 'reading'] as const) {
        it(`allows custom CSS snippets to style definition lists in ${mode} mode`, async () => {
            const filePath = `definition-list-custom-css-${mode}.md`;
            const content = `Custom Term
: Custom definition text`;

            try {
                await createOrReplaceFile(filePath, content);
                await openFileInActiveLeaf(filePath);

                if (mode === 'live') {
                    await ensureLivePreviewMode();
                } else {
                    await ensureReadingMode();
                }

                await enableDefinitionListCssSnippet();
                await waitForDefinitionListCssState(mode);

                const state = await getDefinitionListCssState(mode);

                expect(hasColor(state.list.backgroundColor, '240, 250, 255')).toBe(true);
                expect(hasColor(state.list.borderLeftColor, '12, 34, 56')).toBe(true);
                expect(Number.parseFloat(state.list.borderLeftWidth)).toBeGreaterThanOrEqual(2);
                expect(state.list.borderRadius).toContain('7px');
                expect(hasColor(state.term.color, '120, 20, 20')).toBe(true);
                expect(state.term.fontSize).toBe('20px');
                expect(state.term.fontStyle).toBe('italic');
                expect(Number.parseInt(state.term.fontWeight, 10)).toBeGreaterThanOrEqual(700);
                expect(state.term.textDecorationLine).toContain('underline');
                expect(state.term.textAlign).toBe('center');
                expect(hasColor(state.definition.color, '20, 80, 120')).toBe(true);
                expect(state.definition.fontSize).toBe('18px');
                expect(state.definition.fontStyle).toBe('italic');
                expect(Number.parseInt(state.definition.fontWeight, 10)).toBeGreaterThanOrEqual(600);
                expect(state.definition.textDecorationLine).toContain('underline');
                expect(state.definition.textAlign).toBe('right');
                expect(hasColor(state.markerColor, '90, 10, 140')).toBe(true);
            } finally {
                await disableDefinitionListCssSnippet();
                await deleteFileIfExists(filePath);
            }
        });
    }
});

async function getDefinitionListAlignmentState(): Promise<{
    ready: boolean;
    ordinaryContentLeft: number;
    definitionContentLeft: number;
    termContentLeft: number;
    plainContentLeft: number;
    definitionToOrdinaryDelta: number;
    termToPlainDelta: number;
    lineDiagnostics: string[];
}> {
    return browser.execute(() => {
        const lines = Array.from(document.querySelectorAll('.cm-line')) as HTMLElement[];
        const ordinaryLine = lines.find(line => line.textContent?.includes('ordinary lists')) ?? null;
        const definitionLine = lines.find(line => line.textContent?.includes('definition list')) ?? null;
        const termLine = lines.find(line => line.textContent?.includes('Definition term')) ?? null;
        const plainLine = lines.find(line => line.textContent?.trim() === 'plain text') ?? null;

        const getTextLeft = (line: HTMLElement | null, text: string): number => {
            if (!line) {
                return Number.NaN;
            }

            const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                const textContent = node.textContent ?? '';
                const index = textContent.indexOf(text);
                if (index >= 0) {
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + text.length);
                    const rect = range.getBoundingClientRect();
                    range.detach();
                    return rect.left;
                }
                node = walker.nextNode();
            }

            return Number.NaN;
        };

        const ordinaryContentLeft = getTextLeft(ordinaryLine, 'ordinary lists');
        const definitionContentLeft = getTextLeft(definitionLine, 'definition list');
        const termContentLeft = getTextLeft(termLine, 'Definition term');
        const plainContentLeft = getTextLeft(plainLine, 'plain text');
        const positions = [
            ordinaryContentLeft,
            definitionContentLeft,
            termContentLeft,
            plainContentLeft
        ];
        const ready = positions.every(value => Number.isFinite(value) && value > 0);

        return {
            ready,
            ordinaryContentLeft,
            definitionContentLeft,
            termContentLeft,
            plainContentLeft,
            definitionToOrdinaryDelta: ready ? Math.abs(definitionContentLeft - ordinaryContentLeft) : Number.POSITIVE_INFINITY,
            termToPlainDelta: ready ? Math.abs(termContentLeft - plainContentLeft) : Number.POSITIVE_INFINITY,
            lineDiagnostics: lines
                .filter(line => /plain text|ordinary lists|Definition term|definition list/.test(line.textContent ?? ''))
                .map(line => `${line.className}: ${line.textContent}`)
        };
    });
}

async function waitForDefinitionMarkerWidget(): Promise<void> {
    await browser.waitUntil(async () => {
        const state = await getDefinitionMarkerRenderState();
        return state.markerWidgets >= 1;
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected definition marker widget in live preview'
    });
}

async function getReadingModeDefinitionListAlignmentState(): Promise<{
    ready: boolean;
    ordinaryContentLeft: number;
    definitionContentLeft: number;
    termContentLeft: number;
    plainContentLeft: number;
    definitionToOrdinaryDelta: number;
    termToPlainDelta: number;
    diagnostics: string[];
}> {
    return browser.execute(() => {
        const preview = document.querySelector('.markdown-preview-view') as HTMLElement | null;
        const ordinaryItems = Array.from(preview?.querySelectorAll('ul > li') ?? []) as HTMLElement[];
        const ordinaryItem = ordinaryItems.find(item => item.textContent?.includes('ordinary lists')) ?? null;
        const definitionDesc = preview?.querySelector('.pem-list-definition-desc') as HTMLElement | null;
        const definitionTerm = preview?.querySelector('.pem-definition-term') as HTMLElement | null;
        const plainParagraph = Array.from(preview?.querySelectorAll('p') ?? [])
            .find(paragraph => paragraph.textContent?.trim() === 'plain text') as HTMLElement | undefined;

        const getTextLeft = (element: HTMLElement | null | undefined, text: string): number => {
            if (!element) {
                return Number.NaN;
            }

            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                const textContent = node.textContent ?? '';
                const index = textContent.indexOf(text);
                if (index >= 0) {
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + text.length);
                    const rect = range.getBoundingClientRect();
                    range.detach();
                    return rect.left;
                }
                node = walker.nextNode();
            }

            return Number.NaN;
        };

        const ordinaryContentLeft = getTextLeft(ordinaryItem, 'ordinary lists');
        const definitionContentLeft = getTextLeft(definitionDesc, 'definition list');
        const termContentLeft = getTextLeft(definitionTerm, 'Definition term');
        const plainContentLeft = getTextLeft(plainParagraph, 'plain text');
        const positions = [
            ordinaryContentLeft,
            definitionContentLeft,
            termContentLeft,
            plainContentLeft
        ];
        const ready = positions.every(value => Number.isFinite(value) && value > 0);

        return {
            ready,
            ordinaryContentLeft,
            definitionContentLeft,
            termContentLeft,
            plainContentLeft,
            definitionToOrdinaryDelta: ready ? Math.abs(definitionContentLeft - ordinaryContentLeft) : Number.POSITIVE_INFINITY,
            termToPlainDelta: ready ? Math.abs(termContentLeft - plainContentLeft) : Number.POSITIVE_INFINITY,
            diagnostics: [
                `ordinary=${ordinaryItem?.outerHTML ?? ''}`,
                `definition=${definitionDesc?.outerHTML ?? ''}`,
                `term=${definitionTerm?.outerHTML ?? ''}`,
                `plain=${plainParagraph?.outerHTML ?? ''}`
            ]
        };
    });
}

async function getDefinitionMarkerRenderState(): Promise<{
    markerWidgets: number;
    cursorMarkers: number;
    definitionLineText: string;
    cursorMarkerText: string;
}> {
    return browser.execute(() => {
        const definitionLine = Array.from(document.querySelectorAll('.cm-line'))
            .find(line => line.textContent?.includes('details1')) as HTMLElement | undefined;
        const cursorMarkers = Array.from(document.querySelectorAll('.cm-pem-definition-marker-cursor')) as HTMLElement[];

        return {
            markerWidgets: document.querySelectorAll('.cm-line .pem-list-marker').length,
            cursorMarkers: cursorMarkers.length,
            definitionLineText: definitionLine?.textContent ?? '',
            cursorMarkerText: cursorMarkers.map(marker => marker.textContent ?? '').join('')
        };
    });
}

async function createOrReplaceFile(path: string, content: string): Promise<void> {
    await browser.execute(async (filePath: string, data: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            await app.vault.modify(existing, data);
        } else {
            // @ts-ignore
            await app.vault.create(filePath, data);
        }
    }, path, content);
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
    await browser.pause(500);
}

async function ensureLivePreviewMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        if (!leaf) {
            return;
        }

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

async function ensureReadingMode(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        if (!leaf) {
            return;
        }

        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'preview'
        };
        await leaf.setViewState(state);
        // @ts-ignore
        app.workspace.updateOptions();
    });
    await browser.pause(500);
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

async function enableDefinitionListCssSnippet(): Promise<void> {
    await browser.execute(async (snippetName: string, snippetPath: string) => {
        const snippetCss = `
.markdown-preview-view .pem-definition-list,
.markdown-source-view.mod-cm6 .cm-pem-definition-term,
.markdown-source-view.mod-cm6 .cm-pem-definition-paragraph {
    --pem-definition-list-bg: rgb(240, 250, 255);
    --pem-definition-list-border-color: rgb(12, 34, 56);
    --pem-definition-list-border-radius: 7px;
    --pem-definition-list-border-width: 3px;
    --pem-definition-term-align: center;
    --pem-definition-term-color: rgb(120, 20, 20);
    --pem-definition-term-font-size: 20px;
    --pem-definition-term-font-style: italic;
    --pem-definition-term-font-weight: 700;
    --pem-definition-term-text-decoration: underline;
    --pem-definition-desc-align: right;
    --pem-definition-desc-color: rgb(20, 80, 120);
    --pem-definition-desc-font-size: 18px;
    --pem-definition-desc-font-style: italic;
    --pem-definition-desc-font-weight: 600;
    --pem-definition-desc-marker-color: rgb(90, 10, 140);
    --pem-definition-desc-text-decoration: underline;
}
`;

        // @ts-ignore
        if (!await app.vault.adapter.exists('.obsidian')) {
            // @ts-ignore
            await app.vault.adapter.mkdir('.obsidian');
        }
        // @ts-ignore
        if (!await app.vault.adapter.exists('.obsidian/snippets')) {
            // @ts-ignore
            await app.vault.adapter.mkdir('.obsidian/snippets');
        }
        // @ts-ignore
        await app.vault.adapter.write(snippetPath, snippetCss);

        // @ts-ignore Obsidian's public typings do not expose the custom CSS manager.
        const customCss = app.customCss;
        customCss?.setCssEnabledStatus?.(snippetName, true);
        await customCss?.requestLoadSnippets?.();
    }, definitionListCssSnippetName, definitionListCssSnippetPath);
}

async function disableDefinitionListCssSnippet(): Promise<void> {
    await browser.execute(async (snippetName: string, snippetPath: string) => {
        // @ts-ignore Obsidian's public typings do not expose the custom CSS manager.
        const customCss = app.customCss;
        customCss?.setCssEnabledStatus?.(snippetName, false);
        await customCss?.requestLoadSnippets?.();

        // @ts-ignore
        if (await app.vault.adapter.exists(snippetPath)) {
            // @ts-ignore
            await app.vault.adapter.remove(snippetPath);
        }
    }, definitionListCssSnippetName, definitionListCssSnippetPath);
}

async function waitForDefinitionListCssState(mode: DefinitionListRenderMode): Promise<void> {
    await browser.waitUntil(async () => {
        const state = await getDefinitionListCssState(mode);
        return hasColor(state.list.backgroundColor, '240, 250, 255') &&
            hasColor(state.term.color, '120, 20, 20') &&
            hasColor(state.definition.color, '20, 80, 120');
    }, {
        timeout: 5000,
        timeoutMsg: `Expected definition-list custom CSS in ${mode} mode`
    });
}

async function getDefinitionListCssState(mode: DefinitionListRenderMode): Promise<{
    list: CssProperties;
    term: CssProperties;
    definition: CssProperties;
    markerColor: string;
}> {
    return browser.execute((renderMode: DefinitionListRenderMode) => {
        const extractCssProperties = (element: HTMLElement | null): CssProperties => {
            const styles = element ? window.getComputedStyle(element) : null;
            return {
                backgroundColor: styles?.backgroundColor ?? '',
                borderLeftColor: styles?.borderLeftColor ?? '',
                borderLeftWidth: styles?.borderLeftWidth ?? '',
                borderRadius: styles?.borderRadius ?? '',
                color: styles?.color ?? '',
                fontSize: styles?.fontSize ?? '',
                fontStyle: styles?.fontStyle ?? '',
                fontWeight: styles?.fontWeight ?? '',
                textAlign: styles?.textAlign ?? '',
                textDecorationLine: styles?.textDecorationLine ?? ''
            };
        };

        const previewList = document.querySelector('.markdown-preview-view .pem-definition-list') as HTMLElement | null;
        const previewTerm = previewList?.querySelector('.pem-definition-term') as HTMLElement | null;
        const previewDefinition = previewList?.querySelector('.pem-list-definition-desc') as HTMLElement | null;
        const previewMarker = previewDefinition?.matches('.pem-definition-desc-item')
            ? previewDefinition
            : previewDefinition?.querySelector('.pem-definition-desc-item') as HTMLElement | null;
        const liveTerm = document.querySelector('.cm-line.cm-pem-definition-term') as HTMLElement | null;
        const liveDefinition = document.querySelector('.cm-line.cm-pem-definition-paragraph') as HTMLElement | null;
        const liveMarker = liveDefinition?.querySelector('.pem-list-marker') as HTMLElement | null;

        const list = renderMode === 'reading' ? previewList : liveDefinition;
        const term = renderMode === 'reading' ? previewTerm : liveTerm;
        const definition = renderMode === 'reading' ? previewDefinition : liveDefinition;
        const markerColor = renderMode === 'reading'
            ? (previewMarker ? window.getComputedStyle(previewMarker, '::marker').color : '')
            : (liveMarker ? window.getComputedStyle(liveMarker).color : '');

        return {
            list: extractCssProperties(list),
            term: extractCssProperties(term),
            definition: extractCssProperties(definition),
            markerColor
        };
    }, mode);
}

interface CssProperties {
    backgroundColor: string;
    borderLeftColor: string;
    borderLeftWidth: string;
    borderRadius: string;
    color: string;
    fontSize: string;
    fontStyle: string;
    fontWeight: string;
    textAlign: string;
    textDecorationLine: string;
}

function hasColor(value: string | undefined, rgbTriplet: string): boolean {
    return Boolean(value?.includes(`rgb(${rgbTriplet})`) || value?.includes(`rgba(${rgbTriplet},`));
}
