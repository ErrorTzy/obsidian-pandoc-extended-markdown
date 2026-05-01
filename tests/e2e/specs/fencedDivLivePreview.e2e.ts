import { browser, expect } from '@wdio/globals';

interface ActiveFenceTagInfo {
    error?: string;
    lineClass?: string;
    lineText?: string;
    tagClass?: string;
    tagText?: string;
    tagBackground?: string;
    tagBorderRadius?: string;
    tagPointerEvents?: string;
}

interface FenceHitInfo {
    error?: string;
    clickOffsetX?: number;
    clickOffsetY?: number;
    targetClass?: string;
    targetText?: string;
    selectionHead?: number;
}

interface FencedDivRenderState {
    openLineCount: number;
    contentLineCount: number;
    closeLineCount: number;
    headerTexts: string[];
    headerLabels: string[];
    referenceTexts: string[];
    referenceLabels: string[];
    invalidLineRendered: boolean;
    invalidReferenceRendered: boolean;
    indentedLineRendered: boolean;
    nestedContentLineClass: string;
    warningLineClass: string;
}

describe('Fenced div live preview', () => {
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
            if (plugin && plugin.settings) {
                plugin.settings.enableFencedDivs = true;
                plugin.saveSettings();
                // @ts-ignore
                app.workspace.updateOptions();
            }
        });

        await browser.execute(() => {
            (window as unknown as {
                findOpeningFenceIdElement?: () => HTMLElement | null;
            }).findOpeningFenceIdElement = () => {
                const openLine = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-open'))
                    .find((element) => element.textContent?.includes('#thm:label')) as HTMLElement | undefined;
                if (!openLine) {
                    return null;
                }

                return Array.from(openLine.querySelectorAll('span'))
                    .find((element) => element.textContent?.includes('#') || element.textContent?.includes('thm')) as HTMLElement | undefined ?? null;
            };
        });
    });

    it('keeps expanded fenced div ids styled as plain source text', async () => {
        const filePath = 'fenced-div-live-preview.md';
        const content = [
            '::: {.theorem #thm:label}',
            'Every compact metric space is complete.',
            ':::',
            '',
            'See @thm:label.'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();

        await browser.waitUntil(async () => {
            return browser.execute(() => {
                return Boolean(document.querySelector('.cm-line.cm-pem-fenced-div-open'));
            });
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected fenced div opening line in live preview'
        });

        await browser.execute(() => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            const view = leaf?.view;
            const cm = view?.editor?.cm;
            if (!cm) {
                return;
            }

            const line = cm.state.doc.line(1);
            const idOffset = line.text.indexOf('#thm:label');
            cm.dispatch({
                selection: { anchor: line.from + idOffset }
            });
            cm.focus();
        });

        await browser.waitUntil(async () => {
            const tagInfo = await getActiveFenceTagInfo();
            return !tagInfo.error &&
                tagInfo.lineText?.includes('#thm:label') &&
                tagInfo.tagPointerEvents === 'none';
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected expanded fenced div id to be styled as inert plain text'
        });

        const tagInfo = await getActiveFenceTagInfo();

        if (tagInfo.error) {
            throw new Error(tagInfo.error);
        }

        expect(tagInfo.lineClass).toContain('cm-active');
        expect(tagInfo.lineText).toContain('::: {.theorem #thm:label}');
        expect(tagInfo.tagClass).toContain('cm-hashtag');
        expect(tagInfo.tagText).not.toBe('');
        expect(tagInfo.tagBackground).toBe('rgba(0, 0, 0, 0)');
        expect(tagInfo.tagBorderRadius).toBe('0px');
        expect(tagInfo.tagPointerEvents).toBe('none');

        await deleteFileIfExists(filePath);
    });

    it('lets editor pointer handling pass through expanded fenced div ids', async () => {
        const filePath = 'fenced-div-live-preview-click.md';
        const content = [
            '::: {.theorem #thm:label}',
            'Every compact metric space is complete.',
            ':::',
            '',
            'See @thm:label.'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await activateOpeningFenceId();

        const hitInfo = await browser.execute((): FenceHitInfo => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            const view = leaf?.view;
            const cm = view?.editor?.cm;
            if (!cm) {
                return { error: 'missing-codemirror' };
            }

            const target = findOpeningFenceIdElement();
            if (!target) {
                return { error: 'missing-id-target' };
            }

            const rect = target.getBoundingClientRect();
            const hitTarget = document.elementFromPoint(rect.left + 2, rect.top + 2) as HTMLElement | null;

            cm.dispatch({
                selection: { anchor: cm.state.doc.line(1).from }
            });
            cm.focus();

            return {
                clickOffsetX: rect.left - (target.closest('.cm-line') as HTMLElement).getBoundingClientRect().left + 2,
                clickOffsetY: rect.top - (target.closest('.cm-line') as HTMLElement).getBoundingClientRect().top + 2,
                targetClass: hitTarget?.className ?? '',
                targetText: hitTarget?.textContent ?? ''
            };
        });

        if (hitInfo.error) {
            throw new Error(hitInfo.error);
        }

        expect(hitInfo.targetClass).not.toContain('cm-hashtag');
        expect(hitInfo.targetClass).not.toContain('cm-tag-');
        expect(hitInfo.targetText).toContain('::: {.theorem #thm:label}');

        const openLine = await browser.$('.cm-line.cm-pem-fenced-div-open');
        await openLine.click({
            x: Math.round(hitInfo.clickOffsetX ?? 0),
            y: Math.round(hitInfo.clickOffsetY ?? 0)
        });

        const selectionHead = await browser.execute((): number => {
            // @ts-ignore
            const leaf = app.workspace.getLeaf();
            const view = leaf?.view;
            const cm = view?.editor?.cm;
            return cm?.state.selection.main.head ?? -1;
        });

        expect(selectionHead).toBeGreaterThan(0);

        await deleteFileIfExists(filePath);
    });

    it('renders Pandoc-valid fenced div syntax and ignores invalid live-preview lookalikes', async () => {
        const filePath = 'fenced-div-live-preview-comprehensive.md';
        const content = [
            '::: {.outer #outer}',
            '::: {.inner #inner title="Nested \\"label\\""}',
            'Nested content.',
            ':::',
            '::: Warning ::::::',
            'Warning content.',
            ':::',
            ':::',
            '',
            'See @outer, @inner, and @missing.',
            '',
            'Paragraph before.',
            '::: {.note #invalid}',
            'This should remain paragraph text.',
            ':::',
            '',
            ' ::: {.indented #bad}',
            'Indented text.',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(10);

        await browser.waitUntil(async () => {
            const state = await getFencedDivRenderState();
            return state.openLineCount === 3 &&
                state.closeLineCount === 3 &&
                state.referenceLabels.includes('outer') &&
                state.referenceLabels.includes('inner');
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected Pandoc-valid fenced divs and references in live preview'
        });

        const state = await getFencedDivRenderState();

        expect(state.openLineCount).toBe(3);
        expect(state.closeLineCount).toBe(3);
        expect(state.contentLineCount).toBe(2);
        expect(state.headerTexts).toEqual(['Outer 1:', 'Inner 1:', 'Warning 1:']);
        expect(state.headerLabels).toEqual(['outer', 'inner']);
        expect(state.referenceTexts).toEqual(['Outer 1', 'Inner 1']);
        expect(state.referenceLabels).toEqual(['outer', 'inner']);
        expect(state.invalidLineRendered).toBe(false);
        expect(state.invalidReferenceRendered).toBe(false);
        expect(state.indentedLineRendered).toBe(false);
        expect(state.nestedContentLineClass).toContain('cm-pem-fenced-div-inner');
        expect(state.warningLineClass).toContain('cm-pem-fenced-div-warning');

        await deleteFileIfExists(filePath);
    });
});

async function getActiveFenceTagInfo(): Promise<ActiveFenceTagInfo> {
    return browser.execute((): ActiveFenceTagInfo => {
        const openLine = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-open'))
            .find((element) => element.textContent?.includes('#thm:label')) as HTMLElement | undefined;
        if (!openLine) {
            return { error: 'missing-expanded-opening-line' };
        }

        const tag = openLine.querySelector(
            '.cm-hashtag, .cm-hashtag-begin, .cm-hashtag-end, [class*="cm-tag-"]'
        ) as HTMLElement | null;
        const tagStyle = tag ? window.getComputedStyle(tag) : null;

        return {
            lineClass: openLine.className,
            lineText: openLine.textContent ?? '',
            tagClass: tag?.className ?? '',
            tagText: tag?.textContent ?? '',
            tagBackground: tagStyle?.backgroundColor ?? '',
            tagBorderRadius: tagStyle?.borderRadius ?? '',
            tagPointerEvents: tagStyle?.pointerEvents ?? ''
        };
    });
}

async function getFencedDivRenderState(): Promise<FencedDivRenderState> {
    return browser.execute((): FencedDivRenderState => {
        const openLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-open')) as HTMLElement[];
        const contentLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-content')) as HTMLElement[];
        const closeLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-close')) as HTMLElement[];
        const headers = Array.from(document.querySelectorAll('.pem-fenced-div-header')) as HTMLElement[];
        const references = Array.from(document.querySelectorAll('.pem-fenced-div-reference')) as HTMLElement[];
        const nestedContentLine = contentLines.find(line => line.textContent?.includes('Nested content.'));
        const warningLine = openLines.find(line => line.textContent?.includes('Warning'));

        return {
            openLineCount: openLines.length,
            contentLineCount: contentLines.length,
            closeLineCount: closeLines.length,
            headerTexts: headers.map(header => header.textContent ?? ''),
            headerLabels: headers
                .map(header => header.dataset.pandocDivId)
                .filter((label): label is string => Boolean(label)),
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references
                .map(reference => reference.dataset.pandocDivRef)
                .filter((label): label is string => Boolean(label)),
            invalidLineRendered: openLines.some(line => line.textContent?.includes('#invalid')),
            invalidReferenceRendered: references.some(reference => reference.dataset.pandocDivRef === 'invalid'),
            indentedLineRendered: openLines.some(line => line.textContent?.includes('#bad')),
            nestedContentLineClass: nestedContentLine?.className ?? '',
            warningLineClass: warningLine?.className ?? ''
        };
    });
}

async function moveCursorToLine(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber: number) => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const view = leaf?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(targetLineNumber);
        cm.dispatch({
            selection: { anchor: line.from }
        });
        cm.focus();
    }, lineNumber);
    await browser.pause(250);
}

async function activateOpeningFenceId(): Promise<void> {
    await browser.waitUntil(async () => {
        return browser.execute(() => {
            return Boolean(document.querySelector('.cm-line.cm-pem-fenced-div-open'));
        });
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected fenced div opening line in live preview'
    });

    await browser.execute(() => {
        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        const view = leaf?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(1);
        const idOffset = line.text.indexOf('#thm:label');
        cm.dispatch({
            selection: { anchor: line.from + idOffset }
        });
        cm.focus();
    });

    await browser.waitUntil(async () => {
        const tagInfo = await getActiveFenceTagInfo();
        return !tagInfo.error &&
            tagInfo.lineText?.includes('#thm:label') &&
            tagInfo.tagPointerEvents === 'none';
    }, {
        timeout: 5000,
        timeoutMsg: 'Expected expanded fenced div id to be styled as inert plain text'
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
        if (leaf) {
            const state = leaf.getViewState();
            state.state = {
                ...(state.state ?? {}),
                mode: 'source',
                source: false
            };
            await leaf.setViewState(state);
            // @ts-ignore
            app.workspace.updateOptions();
        }
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
