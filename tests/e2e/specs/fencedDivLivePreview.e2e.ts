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
