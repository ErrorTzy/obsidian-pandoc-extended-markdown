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
    innerLineOffsetPx: number;
    innerHeaderIndentPx: number;
    nestedContentPaddingPx: number;
    warningHeaderIndentPx: number;
    innerLineKeepsParentBackground: boolean;
    innerSurfacePainted: boolean;
    closeLineMaxHeightPx: number;
    closeLinesStayCompact: boolean;
    closeLinesKeepSurface: boolean;
}

interface FencedDivReferenceState {
    strictPandocMode: boolean | null;
    headerTexts: string[];
    titleElementCount: number;
    referenceTexts: string[];
    referenceLabels: string[];
    referenceLineText: string;
    rawMissingPreserved: boolean;
}

interface DeepNestedFencedDivRenderState {
    headerTexts: string[];
    contentTexts: string[];
    nestedLineCount: number;
    deepestContentPaddingPx: number;
    secondLevelAfterClosePaddingPx: number;
    firstLevelAfterClosePaddingPx: number;
    nestedLinesUseBackgroundLayers: boolean;
    nestedPseudoLayersDisabled: boolean;
    nestedCloseLinesPaintParentSurfaces: boolean;
    nestedLinesKeepOuterRail: boolean;
    nestedCloseLinesKeepOuterRail: boolean;
    nestedCloseRailCounts: Array<{ depth: number; railCount: number }>;
}

interface FencedDivMathBlockState {
    plainLineBackground: string;
    plainLinePaddingLeftPx: number;
    mathBlockFound: boolean;
    mathBlockBackground: string;
    mathBlockBoxShadow: string;
    mathBlockPaddingLeftPx: number;
    mathBlockPreviousSiblingClass: string;
    mathBlockNextSiblingClass: string;
    childMathBackgrounds: string[];
}

interface FencedDivListIndentState {
    error?: string;
    outsidePlainTextLeftPx: number;
    insidePlainTextLeftPx: number;
    nestedPlainTextLeftPx: number;
    outsidePlainLineLeftPx: number;
    insidePlainLineLeftPx: number;
    nestedPlainLineLeftPx: number;
    insideListCount: number;
    nestedListCount: number;
    outsideListCount: number;
    markerClasses: string[];
    insideLineLeftPx: number[];
    nestedLineLeftPx: number[];
    outsideLineLeftPx: number[];
    insideTextLeftPx: number[];
    nestedTextLeftPx: number[];
    outsideTextLeftPx: number[];
}

interface FencedDivDefinitionMarkerState {
    openLineCount: number;
    closeLineCount: number;
    fencedContentText: string;
    fencedDefinitionMarkerCount: number;
    fencedDefinitionParagraphCount: number;
    outsideDefinitionMarkerCount: number;
}

interface NestedFencedDivMathRailState {
    headerTexts: string[];
    mathBlockCount: number;
    mathBlockRailCounts: number[];
    mathBlockPreviousSiblingClasses: string[];
    mathBlockNextSiblingClasses: string[];
    deepestMathPaddingLeftPx: number;
    deepestContentPaddingLeftPx: number;
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
                plugin.settings.strictPandocMode = false;
                plugin.settings.enableFencedDivs = true;
                plugin.settings.enableFencedDivExtras = true;
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

    afterEach(async () => {
        await removeMinimalListTransformFixture();
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

    it('keeps marker-only fenced div content as plain text in live preview', async () => {
        const filePath = 'fenced-div-definition-marker-live-preview.md';
        const content = [
            '::: title',
            ': text',
            ':::',
            '',
            'Term',
            ': outside'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();

        await browser.waitUntil(async () => {
            const state = await getFencedDivDefinitionMarkerState();
            return state.openLineCount === 1 &&
                state.closeLineCount === 1 &&
                state.fencedContentText.includes(': text');
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected marker-only fenced div content in live preview'
        });

        const state = await getFencedDivDefinitionMarkerState();

        expect(state.fencedContentText).toContain(': text');
        expect(state.fencedDefinitionMarkerCount).toBe(0);
        expect(state.fencedDefinitionParagraphCount).toBe(0);
        expect(state.outsideDefinitionMarkerCount).toBeGreaterThanOrEqual(1);

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
                state.closeLineCount === 3;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected Pandoc-valid fenced divs in live preview'
        });

        const state = await getFencedDivRenderState();

        expect(state.openLineCount).toBe(3);
        expect(state.closeLineCount).toBe(3);
        expect(state.contentLineCount).toBe(2);
        expect(state.headerTexts).toEqual(['Outer', 'Nested "label"', 'Warning']);
        expect(state.headerLabels).toEqual(['outer', 'inner']);
        expect(state.referenceTexts).toEqual(['Outer', 'Nested "label"']);
        expect(state.referenceLabels).toEqual(['outer', 'inner']);
        expect(state.invalidLineRendered).toBe(false);
        expect(state.invalidReferenceRendered).toBe(false);
        expect(state.indentedLineRendered).toBe(false);
        expect(state.nestedContentLineClass).toContain('cm-pem-fenced-div-inner');
        expect(state.warningLineClass).toContain('cm-pem-fenced-div-warning');
        expect(Math.abs(state.innerLineOffsetPx)).toBeLessThanOrEqual(1);
        expect(state.innerHeaderIndentPx).toBeGreaterThanOrEqual(18);
        expect(state.nestedContentPaddingPx).toBeGreaterThanOrEqual(36);
        expect(state.warningHeaderIndentPx).toBeGreaterThanOrEqual(18);
        expect(state.innerLineKeepsParentBackground).toBe(true);
        expect(state.innerSurfacePainted).toBe(true);
        expect(state.closeLineMaxHeightPx).toBeGreaterThan(0);
        expect(state.closeLineMaxHeightPx).toBeLessThanOrEqual(14);
        expect(state.closeLinesStayCompact).toBe(true);
        expect(state.closeLinesKeepSurface).toBe(true);

        await deleteFileIfExists(filePath);
    });

    it('adds fenced div indentation before unordered list indentation in live preview', async () => {
        const filePath = 'fenced-div-live-preview-unordered-list-indent.md';
        const content = [
            'plain text outside',
            '- unordered list outside',
            '+ unordered list outside',
            '* unordered list outside',
            '',
            '::: fenced_div',
            'plain text inside',
            '- unordered list inside',
            '+ unordered list inside',
            '* unordered list inside',
            '',
            '::: nested',
            'plain text nested',
            '- unordered list nested',
            '+ unordered list nested',
            '* unordered list nested',
            ':::',
            ':::'
        ].join('\n');

        await applyMinimalListTransformFixture();
        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(18);

        await browser.waitUntil(async () => {
            const state = await getFencedDivListIndentState();
            return !state.error &&
                state.insideListCount === 3 &&
                state.nestedListCount === 3 &&
                state.outsideListCount === 3;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected unordered list lines inside and outside fenced div content'
        });

        await applyMinimalListTransformToRenderedLines();
        const state = await getFencedDivListIndentState();

        if (state.error) {
            throw new Error(state.error);
        }

        expect(state.markerClasses).toEqual([
            'pem-unordered-list-marker-dash',
            'pem-unordered-list-marker-plus',
            'pem-unordered-list-marker-star'
        ]);

        const outsideListIndentPx = state.outsideTextLeftPx.map(left => left - state.outsidePlainTextLeftPx);
        const insideListIndentPx = state.insideTextLeftPx.map(left => left - state.insidePlainTextLeftPx);
        const nestedListIndentPx = state.nestedTextLeftPx.map(left => left - state.nestedPlainTextLeftPx);
        const listIndentMatchesOutside = outsideListIndentPx.every((outsideIndent, index) =>
            Math.abs(insideListIndentPx[index] - outsideIndent) <= 3 &&
            Math.abs(nestedListIndentPx[index] - outsideIndent) <= 3
        );
        const insideInheritsFenceIndent = state.insidePlainTextLeftPx > state.outsidePlainTextLeftPx + 8 &&
            state.insideTextLeftPx.every(left => left > state.outsideTextLeftPx[0] + 8);
        const nestedInheritsFenceIndent = state.nestedPlainTextLeftPx > state.insidePlainTextLeftPx + 8 &&
            state.nestedTextLeftPx.every(left => left > state.insideTextLeftPx[0] + 8);
        const outsideListTransformApplied = state.outsideLineLeftPx.every(left =>
            left > state.outsidePlainLineLeftPx + 4
        );
        const insideRailContinuous = state.insideLineLeftPx.every(left =>
            Math.abs(left - state.insidePlainLineLeftPx) <= 1
        );
        const nestedRailContinuous = state.nestedLineLeftPx.every(left =>
            Math.abs(left - state.nestedPlainLineLeftPx) <= 1
        );

        if (
            !listIndentMatchesOutside ||
            !insideInheritsFenceIndent ||
            !nestedInheritsFenceIndent ||
            !outsideListTransformApplied ||
            !insideRailContinuous ||
            !nestedRailContinuous
        ) {
            throw new Error(`Unexpected fenced div list indentation: ${JSON.stringify(state, null, 2)}`);
        }

        await deleteFileIfExists(filePath);
    });

    it('keeps block math visually inside fenced div content', async () => {
        const filePath = 'fenced-div-live-preview-math-block.md';
        const content = [
            '::: title',
            'Plain content',
            '$$\\tt{mathblock}$$',
            'Plain content',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(2);

        await browser.waitUntil(async () => {
            const state = await getFencedDivMathBlockState();
            return state.mathBlockFound;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected block math widget inside fenced div live preview content'
        });

        const state = await getFencedDivMathBlockState();

        expect(state.mathBlockFound).toBe(true);
        expect(state.mathBlockPreviousSiblingClass).toContain('cm-pem-fenced-div-content');
        expect(state.mathBlockNextSiblingClass).toContain('cm-pem-fenced-div-content');
        expect(state.mathBlockBackground).toBe(state.plainLineBackground);
        expect(state.mathBlockBoxShadow).not.toBe('none');
        expect(state.mathBlockPaddingLeftPx).toBeGreaterThanOrEqual(state.plainLinePaddingLeftPx);
        expect(state.childMathBackgrounds.every(background => background === 'rgba(0, 0, 0, 0)')).toBe(true);

        await deleteFileIfExists(filePath);
    });

    it('keeps nested block math aligned with every fenced div rail in live preview', async () => {
        const filePath = 'fenced-div-live-preview-nested-math-blocks.md';
        const content = [
            '::: title',
            '',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{math block}$$',
            'Plain content and $\\tt{inline math}$',
            '',
            '::: nested',
            '',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{block}$$',
            'Plain content and $\\tt{inline math}$',
            '',
            '::: Nested Again {}',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{block}$$',
            'Plain content and $\\tt{inline math}$',
            '',
            '::: Nested Yet Again {}',
            'Plain content and $\\tt{inline math}$',
            '$$\\tt{block}$$',
            'Plain content and $\\tt{inline math}$',
            ':::',
            ':::',
            ':::',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(3);

        try {
            await browser.waitUntil(async () => {
                const state = await getNestedFencedDivMathRailState();
                return state.headerTexts.join('|') === 'Title|Nested|Nested Again|Nested Yet Again' &&
                    state.mathBlockCount === 4;
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected nested fenced div math blocks in live preview'
            });
        } catch (error) {
            const state = await getNestedFencedDivMathRailState();
            throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
        }

        const state = await getNestedFencedDivMathRailState();

        expect(state.headerTexts).toEqual(['Title', 'Nested', 'Nested Again', 'Nested Yet Again']);
        expect(state.mathBlockCount).toBe(4);
        expect(state.mathBlockRailCounts).toEqual([1, 2, 3, 4]);
        expect(state.mathBlockPreviousSiblingClasses[2]).toContain('cm-pem-fenced-div-depth-3');
        expect(state.mathBlockPreviousSiblingClasses[3]).toContain('cm-pem-fenced-div-depth-4');
        expect(state.mathBlockNextSiblingClasses.every(className =>
            className.includes('cm-pem-fenced-div-content')
        )).toBe(true);
        expect(state.deepestMathPaddingLeftPx).toBeGreaterThanOrEqual(state.deepestContentPaddingLeftPx);

        await deleteFileIfExists(filePath);
    });

    it('renders generic fenced div cross-references with Pandoc-aligned labels', async () => {
        const filePath = 'fenced-div-live-preview-crossrefs.md';
        const content = [
            '::: {.proposition #prop:a title="Proposition &"}',
            'A proposition.',
            ':::',
            '',
            '::: {.remark #rem:a title="Remark &"}',
            'A remark.',
            ':::',
            '',
            '::: {.proposition #prop:b title="Proposition &"}',
            'Another proposition.',
            ':::',
            '',
            '::: {.logic-block #prem:a title="Premise &"}',
            'A premise.',
            ':::',
            '',
            '::: {#misc:a}',
            'Misc content.',
            ':::',
            '',
            'Refs @prop:a @rem:a @prop:b @prem:a @misc:a @missing.'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(21);

        await browser.waitUntil(async () => {
            const state = await getFencedDivReferenceState();
            return state.referenceTexts.length === 5 &&
                state.referenceLineText.includes('Proposition 2');
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected generic fenced div cross-references in live preview'
        });

        const state = await getFencedDivReferenceState();

        expect(state.headerTexts).toEqual([
            'Proposition 1',
            'Remark 1',
            'Proposition 2',
            'Premise 1',
            ''
        ]);
        expect(state.referenceTexts).toEqual([
            'Proposition 1',
            'Remark 1',
            'Proposition 2',
            'Premise 1',
            'Div'
        ]);
        expect(state.referenceLabels).toEqual([
            'prop:a',
            'rem:a',
            'prop:b',
            'prem:a',
            'misc:a'
        ]);
        expect(state.referenceLineText).toContain(
            'Refs Proposition 1 Remark 1 Proposition 2 Premise 1 Div @missing.'
        );
        expect(state.rawMissingPreserved).toBe(true);

        await deleteFileIfExists(filePath);
    });

    it('renders fenced div titles and cross-references in strict Pandoc mode when extras are enabled', async () => {
        const filePath = 'fenced-div-live-preview-strict-crossrefs.md';
        const content = [
            '::: {.theorem #thm:strict title="Theorem &"}',
            'Strict-mode content.',
            ':::',
            '',
            'See @thm:strict for the result.'
        ].join('\n');

        await setStrictPandocMode(true);
        try {
            await createOrReplaceFile(filePath, content);
            await openFileInActiveLeaf(filePath);
            await ensureLivePreviewMode();
            await moveCursorToLine(5);

            try {
                await browser.waitUntil(async () => {
                    const state = await getFencedDivReferenceState();
                    return state.strictPandocMode === true &&
                        state.headerTexts.length === 1 &&
                        state.titleElementCount === 1 &&
                        state.referenceTexts.includes('Theorem 1') &&
                        !state.referenceLineText.includes('@thm:strict');
                }, {
                    timeout: 5000,
                    timeoutMsg: 'Expected strict Pandoc live preview to render fenced-div citation text'
                });
            } catch (error) {
                const state = await getFencedDivReferenceState();
                throw new Error(`${(error as Error).message}\nState: ${JSON.stringify(state, null, 2)}`);
            }

            const state = await getFencedDivReferenceState();

            expect(state.headerTexts).toEqual(['Theorem 1']);
            expect(state.titleElementCount).toBe(1);
            expect(state.referenceTexts).toEqual(['Theorem 1']);
            expect(state.referenceLabels).toEqual(['thm:strict']);
            expect(state.referenceLineText).toContain('See Theorem 1 for the result.');
        } finally {
            await setStrictPandocMode(false);
            await deleteFileIfExists(filePath);
        }
    });

    it('keeps base fenced div blocks but preserves cross-references when fenced div extras are disabled', async () => {
        const filePath = 'fenced-div-live-preview-extras-off.md';
        const content = [
            '::: {.theorem #thm:extras title="Theorem &"}',
            'Extras-disabled content.',
            ':::',
            '',
            'See @thm:extras for the result.'
        ].join('\n');

        await setFencedDivExtras(false);
        try {
            await createOrReplaceFile(filePath, content);
            await openFileInActiveLeaf(filePath);
            await ensureLivePreviewMode();
            await moveCursorToLine(5);

            await browser.waitUntil(async () => {
                const state = await getFencedDivReferenceState();
                return state.headerTexts.length === 1 &&
                    state.titleElementCount === 0 &&
                    state.referenceTexts.length === 0 &&
                    state.referenceLineText.includes('@thm:extras');
            }, {
                timeout: 5000,
                timeoutMsg: 'Expected live preview fenced div block without generated extras'
            });

            const state = await getFencedDivReferenceState();

            expect(state.headerTexts).toEqual(['']);
            expect(state.titleElementCount).toBe(0);
            expect(state.referenceTexts).toEqual([]);
            expect(state.referenceLineText).toContain('See @thm:extras for the result.');
        } finally {
            await setFencedDivExtras(true);
            await deleteFileIfExists(filePath);
        }
    });

    it('keeps deeply nested fenced div content visible inside continuous parent backgrounds', async () => {
        const filePath = 'fenced-div-live-preview-deep-nested.md';
        const content = [
            '::: Warning',
            'This is a warning.',
            '',
            '::: Danger',
            'This is a warning within a warning.',
            '',
            '::: Warning2',
            'This is a warning within a warning within a warning.',
            ':::',
            'This is on the 2nd level',
            ':::',
            'This is on the 1st level',
            ':::'
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureLivePreviewMode();
        await moveCursorToLine(2);

        await browser.waitUntil(async () => {
            const state = await getDeepNestedFencedDivRenderState();
            return state.contentTexts.includes('This is a warning within a warning within a warning.') &&
                state.contentTexts.includes('This is on the 2nd level') &&
                state.contentTexts.includes('This is on the 1st level');
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected deeply nested fenced div content in live preview'
        });

        const state = await getDeepNestedFencedDivRenderState();

        expect(state.headerTexts).toEqual(['Warning', 'Danger', 'Warning2']);
        expect(state.contentTexts).toEqual([
            'This is a warning.',
            'This is a warning within a warning.',
            'This is a warning within a warning within a warning.',
            'This is on the 2nd level',
            'This is on the 1st level'
        ]);
        expect(state.nestedLineCount).toBeGreaterThanOrEqual(4);
        expect(state.deepestContentPaddingPx).toBeGreaterThanOrEqual(60);
        expect(state.secondLevelAfterClosePaddingPx).toBeGreaterThanOrEqual(36);
        expect(state.firstLevelAfterClosePaddingPx).toBeLessThan(state.secondLevelAfterClosePaddingPx);
        expect(state.nestedLinesUseBackgroundLayers).toBe(true);
        expect(state.nestedPseudoLayersDisabled).toBe(true);
        expect(state.nestedCloseLinesPaintParentSurfaces).toBe(true);
        expect(state.nestedLinesKeepOuterRail).toBe(true);
        expect(state.nestedCloseLinesKeepOuterRail).toBe(true);
        expect(state.nestedCloseRailCounts).toEqual([
            { depth: 3, railCount: 3 },
            { depth: 2, railCount: 2 }
        ]);

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
        const outerLine = openLines.find(line => line.classList.contains('cm-pem-fenced-div-outer'));
        const innerLine = openLines.find(line => line.classList.contains('cm-pem-fenced-div-inner'));
        const nestedContentLine = contentLines.find(line => line.textContent?.includes('Nested content.'));
        const warningLine = openLines.find(line => line.classList.contains('cm-pem-fenced-div-warning'));
        const outerLeft = outerLine?.getBoundingClientRect().left ?? 0;
        const outerHeader = outerLine?.querySelector('.pem-fenced-div-header') as HTMLElement | null;
        const innerHeader = innerLine?.querySelector('.pem-fenced-div-header') as HTMLElement | null;
        const warningHeader = warningLine?.querySelector('.pem-fenced-div-header') as HTMLElement | null;
        const outerStyle = outerLine ? window.getComputedStyle(outerLine) : null;
        const innerStyle = innerLine ? window.getComputedStyle(innerLine) : null;
        const nestedContentStyle = nestedContentLine ? window.getComputedStyle(nestedContentLine) : null;
        const closeLineStyles = closeLines.map(line => window.getComputedStyle(line));

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
            warningLineClass: warningLine?.className ?? '',
            innerLineOffsetPx: innerLine ? innerLine.getBoundingClientRect().left - outerLeft : 0,
            innerHeaderIndentPx: outerHeader && innerHeader
                ? innerHeader.getBoundingClientRect().left - outerHeader.getBoundingClientRect().left
                : 0,
            nestedContentPaddingPx: nestedContentStyle ? Number.parseFloat(nestedContentStyle.paddingLeft) : 0,
            warningHeaderIndentPx: outerHeader && warningHeader
                ? warningHeader.getBoundingClientRect().left - outerHeader.getBoundingClientRect().left
                : 0,
            innerLineKeepsParentBackground: Boolean(
                outerStyle &&
                innerStyle &&
                outerStyle.backgroundColor === innerStyle.backgroundColor
            ),
            innerSurfacePainted: Boolean(
                innerStyle &&
                innerStyle.backgroundImage.includes('linear-gradient')
            ),
            closeLineMaxHeightPx: Math.max(...closeLines.map(line => line.getBoundingClientRect().height)),
            closeLinesStayCompact: closeLines.every(line => line.getBoundingClientRect().height <= 14),
            closeLinesKeepSurface: closeLineStyles.every(style =>
                (
                    style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                    style.backgroundImage.includes('linear-gradient')
                ) &&
                style.boxShadow !== 'none'
            )
        };
    });
}

async function getFencedDivReferenceState(): Promise<FencedDivReferenceState> {
    return browser.execute((): FencedDivReferenceState => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        const headers = Array.from(document.querySelectorAll('.pem-fenced-div-header')) as HTMLElement[];
        const references = Array.from(document.querySelectorAll('.pem-fenced-div-reference')) as HTMLElement[];
        const referenceLine = Array.from(document.querySelectorAll('.cm-line'))
            .find(line => line.textContent?.includes('Refs') || line.textContent?.includes('See')) as HTMLElement | undefined;

        return {
            strictPandocMode: plugin?.settings?.strictPandocMode ?? null,
            headerTexts: headers.map(header => header.textContent ?? ''),
            titleElementCount: document.querySelectorAll('.pem-fenced-div-title').length,
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references
                .map(reference => reference.dataset.pandocDivRef)
                .filter((label): label is string => Boolean(label)),
            referenceLineText: referenceLine?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            rawMissingPreserved: Boolean(referenceLine?.textContent?.includes('@missing'))
        };
    });
}

async function getFencedDivDefinitionMarkerState(): Promise<FencedDivDefinitionMarkerState> {
    return browser.execute((): FencedDivDefinitionMarkerState => {
        const openLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-open')) as HTMLElement[];
        const closeLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-close')) as HTMLElement[];
        const contentLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-content')) as HTMLElement[];
        const fencedMarkerLines = contentLines.filter(line => line.textContent?.includes('text'));
        const outsideDefinitionLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-definition-paragraph')) as HTMLElement[];
        const outsideDefinitionMarkerCount = outsideDefinitionLines
            .filter(line => !line.classList.contains('cm-pem-fenced-div-content'))
            .reduce((count, line) => count + line.querySelectorAll('.pem-list-marker').length, 0);

        return {
            openLineCount: openLines.length,
            closeLineCount: closeLines.length,
            fencedContentText: fencedMarkerLines.map(line => line.textContent ?? '').join('\n'),
            fencedDefinitionMarkerCount: fencedMarkerLines.reduce(
                (count, line) => count + line.querySelectorAll('.pem-list-marker').length,
                0
            ),
            fencedDefinitionParagraphCount: fencedMarkerLines
                .filter(line => line.classList.contains('cm-pem-definition-paragraph'))
                .length,
            outsideDefinitionMarkerCount
        };
    });
}

async function getFencedDivListIndentState(): Promise<FencedDivListIndentState> {
    return browser.execute((): FencedDivListIndentState => {
        const allLines = Array.from(document.querySelectorAll('.cm-line')) as HTMLElement[];
        const allListLines = Array.from(document.querySelectorAll('.cm-line.HyperMD-list-line')) as HTMLElement[];
        const insideLines = allListLines.filter(line =>
            line.classList.contains('cm-pem-fenced-div-content') &&
            !line.classList.contains('cm-pem-fenced-div-inner') &&
            (line.textContent ?? '').includes('unordered list inside')
        );
        const nestedLines = allListLines.filter(line =>
            line.classList.contains('cm-pem-fenced-div-content') &&
            line.classList.contains('cm-pem-fenced-div-inner') &&
            (line.textContent ?? '').includes('unordered list nested')
        );
        const outsideLines = allListLines.filter(line =>
            !line.classList.contains('cm-pem-fenced-div-line') &&
            (line.textContent ?? '').includes('unordered list outside')
        );

        const getTextLeft = (line: HTMLElement, text: string): number => {
            const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();

            while (node) {
                const content = node.textContent ?? '';
                const index = content.indexOf(text);
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

            return 0;
        };
        const findLine = (text: string): HTMLElement | null =>
            allLines.find(line => (line.textContent ?? '').includes(text)) ?? null;

        const outsidePlainLine = findLine('plain text outside');
        const insidePlainLine = findLine('plain text inside');
        const nestedPlainLine = findLine('plain text nested');

        if (!outsidePlainLine || !insidePlainLine || !nestedPlainLine) {
            return {
                error: 'missing-plain-text-lines',
                outsidePlainTextLeftPx: 0,
                insidePlainTextLeftPx: 0,
                nestedPlainTextLeftPx: 0,
                outsidePlainLineLeftPx: 0,
                insidePlainLineLeftPx: 0,
                nestedPlainLineLeftPx: 0,
                insideListCount: insideLines.length,
                nestedListCount: nestedLines.length,
                outsideListCount: outsideLines.length,
                markerClasses: [],
                insideLineLeftPx: [],
                nestedLineLeftPx: [],
                outsideLineLeftPx: [],
                insideTextLeftPx: [],
                nestedTextLeftPx: [],
                outsideTextLeftPx: [],
            };
        }

        const markerClassOrder = [
            'pem-unordered-list-marker-dash',
            'pem-unordered-list-marker-plus',
            'pem-unordered-list-marker-star'
        ];
        const sortedInsideLines = markerClassOrder
            .map(className => insideLines.find(line => line.classList.contains(className)))
            .filter((line): line is HTMLElement => Boolean(line));
        const sortedNestedLines = markerClassOrder
            .map(className => nestedLines.find(line => line.classList.contains(className)))
            .filter((line): line is HTMLElement => Boolean(line));
        const sortedOutsideLines = markerClassOrder
            .map(className => outsideLines.find(line => line.classList.contains(className)))
            .filter((line): line is HTMLElement => Boolean(line));
        const getLineLeft = (line: HTMLElement): number => line.getBoundingClientRect().left;

        return {
            outsidePlainTextLeftPx: getTextLeft(outsidePlainLine, 'plain text outside'),
            insidePlainTextLeftPx: getTextLeft(insidePlainLine, 'plain text inside'),
            nestedPlainTextLeftPx: getTextLeft(nestedPlainLine, 'plain text nested'),
            outsidePlainLineLeftPx: getLineLeft(outsidePlainLine),
            insidePlainLineLeftPx: getLineLeft(insidePlainLine),
            nestedPlainLineLeftPx: getLineLeft(nestedPlainLine),
            insideListCount: insideLines.length,
            nestedListCount: nestedLines.length,
            outsideListCount: outsideLines.length,
            markerClasses: sortedInsideLines.map(line =>
                markerClassOrder.find(className => line.classList.contains(className)) ?? ''
            ),
            insideLineLeftPx: sortedInsideLines.map(getLineLeft),
            nestedLineLeftPx: sortedNestedLines.map(getLineLeft),
            outsideLineLeftPx: sortedOutsideLines.map(getLineLeft),
            insideTextLeftPx: sortedInsideLines.map(line => getTextLeft(line, 'unordered list inside')),
            nestedTextLeftPx: sortedNestedLines.map(line => getTextLeft(line, 'unordered list nested')),
            outsideTextLeftPx: sortedOutsideLines.map(line => getTextLeft(line, 'unordered list outside')),
        };
    });
}

async function getDeepNestedFencedDivRenderState(): Promise<DeepNestedFencedDivRenderState> {
    return browser.execute((): DeepNestedFencedDivRenderState => {
        const openLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-open')) as HTMLElement[];
        const contentLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-content')) as HTMLElement[];
        const nestedLines = Array.from(document.querySelectorAll('.cm-line.cm-pem-fenced-div-inner')) as HTMLElement[];
        const nestedVisibleLines = nestedLines.filter(line => !line.classList.contains('cm-pem-fenced-div-close'));
        const nestedCloseLines = nestedLines.filter(line => line.classList.contains('cm-pem-fenced-div-close'));
        const deepestContentLine = contentLines.find(line =>
            line.textContent?.includes('within a warning within a warning')
        );
        const secondLevelAfterCloseLine = contentLines.find(line =>
            line.textContent?.includes('2nd level')
        );
        const firstLevelAfterCloseLine = contentLines.find(line =>
            line.textContent?.includes('1st level')
        );
        const nestedLineStyles = nestedVisibleLines.map(line => window.getComputedStyle(line));
        const nestedCloseLineStyles = nestedCloseLines.map(line => window.getComputedStyle(line));
        const nestedPseudoStyles = nestedVisibleLines.map(line => window.getComputedStyle(line, '::before'));
        const deepestContentStyle = deepestContentLine
            ? window.getComputedStyle(deepestContentLine)
            : null;
        const secondLevelAfterCloseStyle = secondLevelAfterCloseLine
            ? window.getComputedStyle(secondLevelAfterCloseLine)
            : null;
        const firstLevelAfterCloseStyle = firstLevelAfterCloseLine
            ? window.getComputedStyle(firstLevelAfterCloseLine)
            : null;
        const getDepth = (line: HTMLElement): number => {
            const depthClass = Array.from(line.classList)
                .find(className => className.startsWith('cm-pem-fenced-div-depth-'));
            return depthClass
                ? Number.parseInt(depthClass.replace('cm-pem-fenced-div-depth-', ''), 10)
                : 1;
        };
        const countRailLayers = (style: CSSStyleDeclaration): number => {
            const gradientCount = style.backgroundImage.match(/linear-gradient/g)?.length ?? 0;
            const boxShadowCount = style.boxShadow === 'none' ? 0 : 1;
            return gradientCount + boxShadowCount;
        };

        return {
            headerTexts: openLines
                .map(line => line.querySelector('.pem-fenced-div-header')?.textContent ?? '')
                .filter(Boolean),
            contentTexts: contentLines
                .map(line => line.textContent?.trim() ?? '')
                .filter(Boolean),
            nestedLineCount: nestedLines.length,
            deepestContentPaddingPx: deepestContentStyle
                ? Number.parseFloat(deepestContentStyle.paddingLeft)
                : 0,
            secondLevelAfterClosePaddingPx: secondLevelAfterCloseStyle
                ? Number.parseFloat(secondLevelAfterCloseStyle.paddingLeft)
                : 0,
            firstLevelAfterClosePaddingPx: firstLevelAfterCloseStyle
                ? Number.parseFloat(firstLevelAfterCloseStyle.paddingLeft)
                : 0,
            nestedLinesUseBackgroundLayers: nestedLineStyles.every(style =>
                style.backgroundImage.includes('linear-gradient')
            ),
            nestedPseudoLayersDisabled: nestedPseudoStyles.every(style =>
                style.content === 'none' || style.content === 'normal'
            ),
            nestedCloseLinesPaintParentSurfaces: nestedCloseLineStyles.every(style =>
                style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                style.backgroundImage.includes('linear-gradient')
            ),
            nestedLinesKeepOuterRail: nestedLineStyles.every(style =>
                style.boxShadow !== 'none'
            ),
            nestedCloseLinesKeepOuterRail: nestedCloseLineStyles.every(style =>
                style.boxShadow !== 'none'
            ),
            nestedCloseRailCounts: nestedCloseLines.map((line, index) => ({
                depth: getDepth(line),
                railCount: countRailLayers(nestedCloseLineStyles[index])
            }))
        };
    });
}

async function getFencedDivMathBlockState(): Promise<FencedDivMathBlockState> {
    return browser.execute((): FencedDivMathBlockState => {
        const contentLines = Array.from(
            document.querySelectorAll('.cm-line.cm-pem-fenced-div-content')
        ) as HTMLElement[];
        const plainLine = contentLines.find(line => line.textContent?.includes('Plain content'));
        const mathBlock = document.querySelector<HTMLElement>(
            '.cm-content > .math.math-block.cm-embed-block'
        );
        const plainLineStyle = plainLine ? window.getComputedStyle(plainLine) : null;
        const mathBlockStyle = mathBlock ? window.getComputedStyle(mathBlock) : null;
        const childMathBackgrounds = Array.from(
            mathBlock?.querySelectorAll<HTMLElement>('.markdown-rendered, .math, .cm-math, mjx-container') ?? []
        ).map(element => window.getComputedStyle(element).backgroundColor);

        return {
            plainLineBackground: plainLineStyle?.backgroundColor ?? '',
            plainLinePaddingLeftPx: plainLineStyle ? Number.parseFloat(plainLineStyle.paddingLeft) : 0,
            mathBlockFound: Boolean(mathBlock),
            mathBlockBackground: mathBlockStyle?.backgroundColor ?? '',
            mathBlockBoxShadow: mathBlockStyle?.boxShadow ?? '',
            mathBlockPaddingLeftPx: mathBlockStyle ? Number.parseFloat(mathBlockStyle.paddingLeft) : 0,
            mathBlockPreviousSiblingClass: (mathBlock?.previousElementSibling as HTMLElement | null)?.className ?? '',
            mathBlockNextSiblingClass: (mathBlock?.nextElementSibling as HTMLElement | null)?.className ?? '',
            childMathBackgrounds
        };
    });
}

async function getNestedFencedDivMathRailState(): Promise<NestedFencedDivMathRailState> {
    return browser.execute((): NestedFencedDivMathRailState => {
        const headers = Array.from(document.querySelectorAll('.pem-fenced-div-header')) as HTMLElement[];
        const mathBlocks = Array.from(
            document.querySelectorAll('.cm-content > .math.math-block.cm-embed-block')
        ) as HTMLElement[];
        const deepestContentLine = Array.from(
            document.querySelectorAll('.cm-line.cm-pem-fenced-div-depth-4.cm-pem-fenced-div-content')
        )[0] as HTMLElement | undefined;
        const deepestMathBlock = mathBlocks[3];
        const countRailLayers = (element: HTMLElement): number => {
            const style = window.getComputedStyle(element);
            const gradientCount = style.backgroundImage.match(/linear-gradient/g)?.length ?? 0;
            const boxShadowCount = style.boxShadow === 'none' ? 0 : 1;
            return gradientCount + boxShadowCount;
        };

        return {
            headerTexts: headers.map(header => header.textContent ?? ''),
            mathBlockCount: mathBlocks.length,
            mathBlockRailCounts: mathBlocks.map(countRailLayers),
            mathBlockPreviousSiblingClasses: mathBlocks.map(block =>
                (block.previousElementSibling as HTMLElement | null)?.className ?? ''
            ),
            mathBlockNextSiblingClasses: mathBlocks.map(block =>
                (block.nextElementSibling as HTMLElement | null)?.className ?? ''
            ),
            deepestMathPaddingLeftPx: deepestMathBlock
                ? Number.parseFloat(window.getComputedStyle(deepestMathBlock).paddingLeft)
                : 0,
            deepestContentPaddingLeftPx: deepestContentLine
                ? Number.parseFloat(window.getComputedStyle(deepestContentLine).paddingLeft)
                : 0
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

async function applyMinimalListTransformFixture(): Promise<void> {
    await browser.execute(() => {
        document.body.style.setProperty('--adaptive-list-edit-offset', '8px');
    });
    await browser.pause(100);
}

async function applyMinimalListTransformToRenderedLines(): Promise<void> {
    await browser.execute(() => {
        document.querySelectorAll<HTMLElement>('.cm-line.HyperMD-list-line').forEach(line => {
            line.style.setProperty('--adaptive-list-edit-offset', '8px');
            line.style.transform = 'translateX(8px)';
        });
    });
    await browser.pause(100);
}

async function removeMinimalListTransformFixture(): Promise<void> {
    await browser.execute(() => {
        document.body.style.removeProperty('--adaptive-list-edit-offset');
        document.querySelectorAll<HTMLElement>('.cm-line.HyperMD-list-line').forEach(line => {
            line.style.removeProperty('--adaptive-list-edit-offset');
            line.style.removeProperty('transform');
        });
    });
}

async function setStrictPandocMode(value: boolean): Promise<void> {
    await browser.execute(async (strictPandocMode: boolean) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            plugin.settings.strictPandocMode = strictPandocMode;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, value);
    await browser.pause(250);
}

async function setFencedDivExtras(value: boolean): Promise<void> {
    await browser.execute(async (enableFencedDivExtras: boolean) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (plugin?.settings) {
            plugin.settings.enableFencedDivExtras = enableFencedDivExtras;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, value);
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
