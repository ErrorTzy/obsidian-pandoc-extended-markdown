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
                state.closeLineCount === 3;
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected Pandoc-valid fenced divs in live preview'
        });

        const state = await getFencedDivRenderState();

        expect(state.openLineCount).toBe(3);
        expect(state.closeLineCount).toBe(3);
        expect(state.contentLineCount).toBe(2);
        expect(state.headerTexts).toEqual(['', '', '']);
        expect(state.headerLabels).toEqual(['outer', 'inner']);
        expect(state.referenceTexts).toEqual(['Outer 1', 'Nested "label" 1']);
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

    it('renders generic fenced div cross-references with Pandoc-aligned labels', async () => {
        const filePath = 'fenced-div-live-preview-crossrefs.md';
        const content = [
            '::: {.proposition #prop:a}',
            'A proposition.',
            ':::',
            '',
            '::: {.remark #rem:a}',
            'A remark.',
            ':::',
            '',
            '::: {.proposition #prop:b}',
            'Another proposition.',
            ':::',
            '',
            '::: {.logic-block #prem:a title="Premise"}',
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
        await moveCursorToLine(1);

        await browser.waitUntil(async () => {
            const state = await getFencedDivReferenceState();
            return state.referenceTexts.length === 5 &&
                state.referenceLineText.includes('Proposition 2');
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected generic fenced div cross-references in live preview'
        });

        const state = await getFencedDivReferenceState();

        expect(state.referenceTexts).toEqual([
            'Proposition 1',
            'Remark 1',
            'Proposition 2',
            'Premise 1',
            'Div 1'
        ]);
        expect(state.referenceLabels).toEqual([
            'prop:a',
            'rem:a',
            'prop:b',
            'prem:a',
            'misc:a'
        ]);
        expect(state.referenceLineText).toContain(
            'Refs Proposition 1 Remark 1 Proposition 2 Premise 1 Div 1 @missing.'
        );
        expect(state.rawMissingPreserved).toBe(true);

        await deleteFileIfExists(filePath);
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

        expect(state.headerTexts).toEqual([]);
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
        const references = Array.from(document.querySelectorAll('.pem-fenced-div-reference')) as HTMLElement[];
        const referenceLine = Array.from(document.querySelectorAll('.cm-line'))
            .find(line => line.textContent?.includes('Refs')) as HTMLElement | undefined;

        return {
            referenceTexts: references.map(reference => reference.textContent ?? ''),
            referenceLabels: references
                .map(reference => reference.dataset.pandocDivRef)
                .filter((label): label is string => Boolean(label)),
            referenceLineText: referenceLine?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            rawMissingPreserved: Boolean(referenceLine?.textContent?.includes('@missing'))
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
