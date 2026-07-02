import { browser, expect } from '@wdio/globals';

import { ensureActiveFileReadingMode } from '../helpers/readingMode';

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

    it('aligns nested definition item rule, marker, and text with ordinary nested list geometry in live preview', async () => {
        const filePath = 'definition-list-live-preview-nested-alignment.md';
        const content = `- ordinary parent
    - nested ordinary

Definition term
: parent definition
    : nested definition`;

        try {
            await createOrReplaceFile(filePath, content);
            await openFileInActiveLeaf(filePath);
            await ensureLivePreviewMode();
            await waitForDefinitionMarkerWidget();

            await browser.waitUntil(async () => {
                const state = await getNestedDefinitionListGeometryState();
                return state.ready;
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected nested ordinary and definition list geometry in live preview'
            });

            const state = await getNestedDefinitionListGeometryState();

            expect(state.ready).toBe(true);
            expect(state.definitionLineToOrdinaryDelta).toBeLessThanOrEqual(1);
            expect(state.definitionMarkerToOrdinaryDelta).toBeLessThanOrEqual(1);
            expect(state.definitionTextToOrdinaryDelta).toBeLessThanOrEqual(1);
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

    it('does not multiply definition lists inside a subheading embed in reading mode', async () => {
        const embeddedPath = 'definition-list-embed-source.md';
        const containerPath = 'definition-list-embed-container.md';
        const embeddedContent = `# Note-1

## SubHeading

Term
: Definition 1
: Definition 2
: Definition 3

Top-Level Category
: Sub-category 1
: Sub-category 2`;
        const containerContent = `# Note-2

![[${embeddedPath}#SubHeading]]`;

        try {
            await createOrReplaceFile(embeddedPath, embeddedContent);
            await createOrReplaceFile(containerPath, containerContent);
            await openFileInActiveLeaf(containerPath);
            await ensureReadingMode();

            await browser.waitUntil(async () => {
                const state = await getEmbeddedDefinitionListState('Definition 1');
                return state.ready;
            }, {
                timeout: 8000,
                timeoutMsg: 'Expected embedded definition list to render in reading mode'
            });

            const state = await getEmbeddedDefinitionListState('Definition 1');

            expect(state.listCount).toBe(1);
            expect(state.terms).toEqual(['Term', 'Top-Level Category']);
            expect(state.definitions).toEqual([
                'Definition 1',
                'Definition 2',
                'Definition 3',
                'Sub-category 1',
                'Sub-category 2'
            ]);
        } finally {
            await deleteFileIfExists(containerPath);
            await deleteFileIfExists(embeddedPath);
        }
    });

    it('does not multiply tilde-marker definition lists inside a live-preview embed after switching tabs', async () => {
        const embeddedPath = 'Note1.md';
        const containerPath = 'definition-list-tilde-embed-container.md';
        const switchPath = 'definition-list-tilde-switch-tab.md';
        const embeddedContent = `## SubHeading1

Term
~ Sub-category 1

Top-Level Category
~ Sub-category 1
~ Sub-category 2`;
        const containerContent = `text

![[Note1.md]]

text`;
        const switchContent = `# Switch Target

plain text`;

        try {
            await browser.reloadObsidian({
                vault: './tests/e2e/vaults/test-vault'
            });
            await enableDefinitionListRendering();
            await createOrReplaceFile(embeddedPath, embeddedContent);
            await createOrReplaceFile(containerPath, containerContent);
            await createOrReplaceFile(switchPath, switchContent);
            await openFilesInLivePreviewTabs(containerPath, switchPath);
            await revealLivePreviewEmbeds();

            await waitForEmbeddedDefinitionList('Sub-category 1', 'live preview');
            assertEmbeddedTildeDefinitionListState(
                await getEmbeddedDefinitionListState('Sub-category 1')
            );

            for (let index = 0; index < 8; index++) {
                await switchAwayAndBackToTab(containerPath, switchPath);
                await revealLivePreviewEmbeds();

                await waitForEmbeddedDefinitionList(
                    'Sub-category 1',
                    `live preview after switching notes (${index + 1})`
                );
                assertEmbeddedTildeDefinitionListState(
                    await getEmbeddedDefinitionListState('Sub-category 1')
                );
            }

            await ensureReadingMode();
            await rerenderActivePreview();
            await rerenderActivePreview();

            await waitForEmbeddedDefinitionList('Sub-category 1', 'reading mode');

            const state = await getEmbeddedDefinitionListState('Sub-category 1');

            assertEmbeddedTildeDefinitionListState(state);
        } finally {
            await deleteFileIfExists(switchPath);
            await deleteFileIfExists(containerPath);
            await deleteFileIfExists(embeddedPath);
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

async function getNestedDefinitionListGeometryState(): Promise<{
    ready: boolean;
    ordinaryLineLeft: number;
    definitionLineLeft: number;
    ordinaryMarkerLeft: number;
    definitionMarkerLeft: number;
    ordinaryTextLeft: number;
    definitionTextLeft: number;
    definitionLineToOrdinaryDelta: number;
    definitionMarkerToOrdinaryDelta: number;
    definitionTextToOrdinaryDelta: number;
    diagnostics: string[];
}> {
    return browser.execute(() => {
        const lines = Array.from(document.querySelectorAll('.cm-line')) as HTMLElement[];
        const ordinaryLine = lines.find(line => line.textContent?.includes('nested ordinary')) ?? null;
        const definitionLine = lines.find(line => line.textContent?.includes('nested definition')) ?? null;

        const getMarkerLeft = (line: HTMLElement | null): number => {
            const marker = line?.querySelector(
                '.cm-formatting-list-ul .list-bullet, .cm-formatting-list-ul, .pem-list-marker'
            ) as HTMLElement | null;
            return marker?.getBoundingClientRect().left ?? Number.NaN;
        };

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

        const ordinaryLineLeft = ordinaryLine?.getBoundingClientRect().left ?? Number.NaN;
        const definitionLineLeft = definitionLine?.getBoundingClientRect().left ?? Number.NaN;
        const ordinaryMarkerLeft = getMarkerLeft(ordinaryLine);
        const definitionMarkerLeft = getMarkerLeft(definitionLine);
        const ordinaryTextLeft = getTextLeft(ordinaryLine, 'nested ordinary');
        const definitionTextLeft = getTextLeft(definitionLine, 'nested definition');
        const positions = [
            ordinaryLineLeft,
            definitionLineLeft,
            ordinaryMarkerLeft,
            definitionMarkerLeft,
            ordinaryTextLeft,
            definitionTextLeft
        ];
        const ready = positions.every(value => Number.isFinite(value) && value > 0);

        return {
            ready,
            ordinaryLineLeft,
            definitionLineLeft,
            ordinaryMarkerLeft,
            definitionMarkerLeft,
            ordinaryTextLeft,
            definitionTextLeft,
            definitionLineToOrdinaryDelta: ready ? Math.abs(definitionLineLeft - ordinaryLineLeft) : Number.POSITIVE_INFINITY,
            definitionMarkerToOrdinaryDelta: ready ? Math.abs(definitionMarkerLeft - ordinaryMarkerLeft) : Number.POSITIVE_INFINITY,
            definitionTextToOrdinaryDelta: ready ? Math.abs(definitionTextLeft - ordinaryTextLeft) : Number.POSITIVE_INFINITY,
            diagnostics: [ordinaryLine, definitionLine]
                .filter((line): line is HTMLElement => line !== null)
                .map(line => {
                    const style = window.getComputedStyle(line);
                    return [
                        line.className,
                        line.textContent,
                        `left=${line.getBoundingClientRect().left}`,
                        `padding=${style.paddingInlineStart}`,
                        `textIndent=${style.textIndent}`,
                        `html=${line.innerHTML}`
                    ].join(' | ');
                })
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

async function getEmbeddedDefinitionListState(expectedText: string): Promise<{
    ready: boolean;
    embedFound: boolean;
    listCount: number;
    terms: string[];
    definitions: string[];
    rootText: string;
    trailingBlankBlockCount: number;
    previewSectionMinHeight: string;
    diagnostics: string;
}> {
    return browser.execute((text: string) => {
        const embeds = Array.from(document.querySelectorAll('.markdown-embed')) as HTMLElement[];
        const embed = embeds.find(candidate => candidate.textContent?.includes(text));
        const root = embed ?? null;
        const lists = Array.from(root?.querySelectorAll('dl.pem-definition-list') ?? []) as HTMLElement[];
        const firstListWrapper = lists[0]?.closest('.el-p') as HTMLElement | null;
        const trailingBlankBlockCount = countTrailingBlankBlocks(firstListWrapper);
        const previewSection = lists[0]?.closest('.markdown-preview-section') as HTMLElement | null;
        const previewSectionMinHeight = previewSection?.style.minHeight ?? '';
        const terms = lists.flatMap(list =>
            Array.from(list.querySelectorAll(':scope > dt'))
                .map(term => term.textContent?.trim() ?? '')
        );
        const definitions = lists.flatMap(list =>
            Array.from(list.querySelectorAll(':scope > dd'))
                .map(definition => definition.textContent?.trim() ?? '')
        );

        return {
            ready: Boolean(embed) && lists.length > 0,
            embedFound: Boolean(embed),
            listCount: lists.length,
            terms,
            definitions,
            rootText: root?.textContent ?? '',
            trailingBlankBlockCount,
            previewSectionMinHeight,
            diagnostics: root?.innerHTML ?? document.body.innerHTML
        };

        function countTrailingBlankBlocks(start: HTMLElement | null): number {
            if (!start) {
                return 0;
            }

            let count = 0;
            let sibling = start.nextElementSibling;
            while (sibling?.classList.contains('el-p') && !sibling.textContent?.trim()) {
                count++;
                sibling = sibling.nextElementSibling;
            }
            return count;
        }
    }, expectedText);
}

async function waitForEmbeddedDefinitionList(expectedText: string, mode: string): Promise<void> {
    await browser.waitUntil(async () => {
        const state = await getEmbeddedDefinitionListState(expectedText);
        return state.ready;
    }, {
        timeout: 8000,
        timeoutMsg: `Expected embedded tilde definition list to render in ${mode}`
    });
}

function assertEmbeddedTildeDefinitionListState(state: {
    embedFound?: boolean;
    listCount: number;
    terms: string[];
    definitions: string[];
    rootText?: string;
    trailingBlankBlockCount?: number;
    previewSectionMinHeight?: string;
}): void {
    expect(state.embedFound).toBe(true);
    expect(state.listCount).toBe(1);
    expect(state.terms).toEqual(['Term', 'Top-Level Category']);
    expect(state.definitions).toEqual([
        'Sub-category 1',
        'Sub-category 1',
        'Sub-category 2'
    ]);
    expect(countOccurrences(state.rootText ?? '', 'Term')).toBe(1);
    expect(countOccurrences(state.rootText ?? '', 'Top-Level Category')).toBe(1);
    expect(countOccurrences(state.rootText ?? '', 'Sub-category 1')).toBe(2);
    expect(countOccurrences(state.rootText ?? '', 'Sub-category 2')).toBe(1);
    expect(state.rootText ?? '').not.toContain('~ Sub-category 2');
    expect(state.trailingBlankBlockCount).toBe(0);
    expect(state.previewSectionMinHeight).toBe('0px');
}

function countOccurrences(text: string, search: string): number {
    return text.split(search).length - 1;
}

async function openFilesInLivePreviewTabs(containerPath: string, switchPath: string): Promise<void> {
    await browser.execute(async (referencePath: string, otherPath: string) => {
        // @ts-ignore
        const referenceFile = app.vault.getAbstractFileByPath(referencePath);
        // @ts-ignore
        const otherFile = app.vault.getAbstractFileByPath(otherPath);
        if (!referenceFile || !otherFile) {
            return;
        }

        // @ts-ignore
        const referenceLeaf = app.workspace.getLeaf();
        await referenceLeaf.openFile(referenceFile);
        // @ts-ignore
        const otherLeaf = app.workspace.getLeaf('tab');
        await otherLeaf.openFile(otherFile);

        for (const leaf of [referenceLeaf, otherLeaf]) {
            const state = leaf.getViewState();
            state.state = {
                ...(state.state ?? {}),
                mode: 'source',
                source: false
            };
            await leaf.setViewState(state);
        }

        // @ts-ignore
        app.workspace.setActiveLeaf(referenceLeaf, { focus: true });
        // @ts-ignore
        app.workspace.updateOptions();
    }, containerPath, switchPath);
    await browser.pause(500);
    await placeCursorAfterEmbed(containerPath);
}

async function switchAwayAndBackToTab(containerPath: string, switchPath: string): Promise<void> {
    await browser.execute((referencePath: string, otherPath: string) => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const referenceLeaf = leaves.find((leaf: { view?: { file?: { path?: string } } }) =>
            leaf.view?.file?.path === referencePath
        );
        const otherLeaf = leaves.find((leaf: { view?: { file?: { path?: string } } }) =>
            leaf.view?.file?.path === otherPath
        );

        if (otherLeaf) {
            // @ts-ignore
            app.workspace.setActiveLeaf(otherLeaf, { focus: true });
        }
        if (referenceLeaf) {
            // @ts-ignore
            app.workspace.setActiveLeaf(referenceLeaf, { focus: true });
        }
        // @ts-ignore
        app.workspace.updateOptions();
    }, containerPath, switchPath);
    await placeCursorAfterEmbed(containerPath);
    await browser.pause(400);
}

async function placeCursorAfterEmbed(path: string): Promise<void> {
    await browser.execute((filePath: string) => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: { view?: { file?: { path?: string } } }) =>
            candidate.view?.file?.path === filePath
        );
        const cm = leaf?.view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(cm.state.doc.lines);
        cm.dispatch({ selection: { anchor: line.from } });
        cm.focus();
    }, path);
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

async function enableDefinitionListRendering(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            plugin.settings.enableDefinitionLists = true;
            plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
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
    await browser.waitUntil(async () =>
        browser.execute((filePath: string) => {
            // @ts-ignore
            return app.workspace.getActiveFile()?.path === filePath;
        }, path),
    {
        timeout: 5000,
        timeoutMsg: `Expected ${path} to be the active file`
    });
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

async function revealLivePreviewEmbeds(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const cm = leaf?.view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(cm.state.doc.lines);
        cm.dispatch({ selection: { anchor: line.from } });
        cm.focus();
    });
    await browser.pause(1000);
}

async function ensureReadingMode(): Promise<void> {
    await ensureActiveFileReadingMode();
    await browser.pause(500);
}

async function rerenderActivePreview(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        leaf?.view?.previewMode?.rerender?.(true);
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
