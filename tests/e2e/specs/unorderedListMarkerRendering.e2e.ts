import { browser, expect } from '@wdio/globals';

interface MarkerStyleInfo {
    marker: string;
    lineClass: string;
    text: string;
    hasListBullet: boolean;
    rawColor: string;
    rawFontSize: string;
    shapeContent: string;
    shapeDisplay: string;
    shapeBackgroundColor: string;
    shapeBorderStyle: string;
    shapeBorderWidth: string;
    shapeBorderRadius: string;
    shapeWidth: string;
    shapeHeight: string;
    parentBeforeContent: string;
}

describe('Unordered list marker rendering', () => {
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
        });
    });

    it('renders dash, plus, and star source markers as distinct live preview shapes', async () => {
        const filePath = 'unordered-marker-rendering.md';
        const content = '- aaaa\n    + aaaa\n        * sssss';

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
            if (file) {
                // @ts-ignore
                await app.workspace.getLeaf().openFile(file);
            }
        }, filePath);

        await browser.pause(1000);

        await browser.execute(async () => {
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            if (leaves.length > 0) {
                const leaf = leaves[0];
                const state = leaf.getViewState();
                state.state = {
                    ...(state.state ?? {}),
                    mode: 'source',
                    source: false
                };
                await leaf.setViewState(state);
            }
        });

        await browser.pause(500);

        await browser.waitUntil(async () => {
            return await browser.execute(() => {
                return document.querySelectorAll('.pem-unordered-list-marker .cm-formatting-list-ul').length === 3;
            });
        }, {
            timeout: 5000,
            timeoutMsg: 'Expected three source-aware unordered list markers in live preview'
        });

        const markerStyles = await browser.execute((): MarkerStyleInfo[] => {
            const selectors = [
                ['dash', '.pem-unordered-list-marker-dash .cm-formatting-list-ul'],
                ['plus', '.pem-unordered-list-marker-plus .cm-formatting-list-ul'],
                ['star', '.pem-unordered-list-marker-star .cm-formatting-list-ul']
            ] as const;

            return selectors.map(([marker, selector]) => {
                const bullet = document.querySelector(selector) as HTMLElement | null;
                if (!bullet) {
                    return {
                        marker,
                        lineClass: '',
                        text: '',
                        hasListBullet: false,
                        rawColor: '',
                        rawFontSize: '',
                        shapeContent: '',
                        shapeDisplay: '',
                        shapeBackgroundColor: '',
                        shapeBorderStyle: '',
                        shapeBorderWidth: '',
                        shapeBorderRadius: '',
                        shapeWidth: '',
                        shapeHeight: '',
                        parentBeforeContent: ''
                    };
                }

                const listBullet = bullet.querySelector('.list-bullet') as HTMLElement | null;
                const rawMarker = listBullet ?? bullet;
                const rawStyle = window.getComputedStyle(rawMarker);
                const shape = listBullet
                    ? window.getComputedStyle(listBullet, '::after')
                    : window.getComputedStyle(bullet, '::before');
                const parentBefore = window.getComputedStyle(bullet, '::before');
                const line = bullet.closest('.HyperMD-list-line') as HTMLElement | null;

                return {
                    marker,
                    lineClass: line?.className ?? '',
                    text: bullet.textContent ?? '',
                    hasListBullet: listBullet !== null,
                    rawColor: rawStyle.color,
                    rawFontSize: rawStyle.fontSize,
                    shapeContent: shape.content,
                    shapeDisplay: shape.display,
                    shapeBackgroundColor: shape.backgroundColor,
                    shapeBorderStyle: shape.borderStyle,
                    shapeBorderWidth: shape.borderWidth,
                    shapeBorderRadius: shape.borderRadius,
                    shapeWidth: shape.width,
                    shapeHeight: shape.height,
                    parentBeforeContent: parentBefore.content
                };
            });
        });

        const dash = markerStyles.find(style => style.marker === 'dash')!;
        const plus = markerStyles.find(style => style.marker === 'plus')!;
        const star = markerStyles.find(style => style.marker === 'star')!;

        expect(dash.text.trim()).toBe('-');
        expect(dash.rawFontSize).not.toBe('0px');

        expect(plus.lineClass).toContain('pem-unordered-list-marker-plus');
        expect(plus.text.trim()).toBe('+');
        expect(plus.rawColor).toBe('rgba(0, 0, 0, 0)');
        expect(plus.shapeContent).not.toBe('none');
        expect(plus.shapeDisplay).not.toBe('none');
        expect(parseFloat(plus.shapeWidth)).toBeGreaterThan(0);
        expect(parseFloat(plus.shapeHeight)).toBeGreaterThan(0);
        expect(plus.shapeBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(plus.shapeBorderRadius).toContain('1px');
        if (plus.hasListBullet) {
            expect(plus.parentBeforeContent).toBe('none');
        } else {
            expect(plus.rawFontSize).toBe('0px');
        }

        expect(star.lineClass).toContain('pem-unordered-list-marker-star');
        expect(star.text.trim()).toBe('*');
        expect(star.rawColor).toBe('rgba(0, 0, 0, 0)');
        expect(star.shapeContent).not.toBe('none');
        expect(star.shapeDisplay).not.toBe('none');
        expect(parseFloat(star.shapeWidth)).toBeGreaterThan(0);
        expect(parseFloat(star.shapeHeight)).toBeGreaterThan(0);
        expect(star.shapeBackgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(star.shapeBorderStyle).toBe('solid');
        expect(star.shapeBorderWidth).not.toBe('0px');
        expect(star.shapeBorderRadius).toContain('50%');
        if (star.hasListBullet) {
            expect(star.parentBeforeContent).toBe('none');
        } else {
            expect(star.rawFontSize).toBe('0px');
        }
    });

    it('hides raw marker text when Obsidian wraps bullets in list-bullet spans', async () => {
        const fixtureStyles = await browser.execute(() => {
            const fixture = document.createElement('div');
            fixture.style.position = 'absolute';
            fixture.style.left = '0';
            fixture.style.top = '0';
            fixture.style.setProperty('--font-text-size', '16px');
            fixture.style.setProperty('--list-bullet-size', '0.4em');
            fixture.style.setProperty('--list-marker-color', 'rgb(128, 128, 128)');
            fixture.innerHTML = `
                <div class="HyperMD-list-line pem-unordered-list-marker pem-unordered-list-marker-plus HyperMD-list-line-2 cm-line">
                    <span class="cm-formatting cm-formatting-list cm-formatting-list-ul cm-list-2"><span class="list-bullet" style="color: rgb(128, 128, 128); font-size: 16px;">+</span> </span>
                    <span class="cm-list-2">aaaa</span>
                </div>
                <div class="HyperMD-list-line pem-unordered-list-marker pem-unordered-list-marker-star HyperMD-list-line-3 cm-line">
                    <span class="cm-formatting cm-formatting-list cm-formatting-list-ul cm-list-3"><span class="list-bullet" style="color: rgb(128, 128, 128); font-size: 16px;">*</span> </span>
                    <span class="cm-list-3">sssss</span>
                </div>
            `;
            document.body.appendChild(fixture);

            const getStyles = (selector: string) => {
                const bullet = fixture.querySelector(selector) as HTMLElement;
                const marker = bullet.closest('.cm-formatting-list-ul') as HTMLElement;
                const bulletStyle = window.getComputedStyle(bullet);
                const markerBefore = window.getComputedStyle(marker, '::before');
                const bulletAfter = window.getComputedStyle(bullet, '::after');

                return {
                    text: bullet.textContent ?? '',
                    bulletColor: bulletStyle.color,
                    bulletFontSize: bulletStyle.fontSize,
                    markerBeforeContent: markerBefore.content,
                    markerBeforeDisplay: markerBefore.display,
                    bulletAfterContent: bulletAfter.content,
                    bulletAfterDisplay: bulletAfter.display,
                    bulletAfterWidth: bulletAfter.width,
                    bulletAfterHeight: bulletAfter.height
                };
            };

            const styles = {
                plus: getStyles('.pem-unordered-list-marker-plus .list-bullet'),
                star: getStyles('.pem-unordered-list-marker-star .list-bullet')
            };

            fixture.remove();
            return styles;
        });

        expect(fixtureStyles.plus.text).toBe('+');
        expect(fixtureStyles.plus.bulletFontSize).not.toBe('0px');
        expect(fixtureStyles.plus.bulletColor).toBe('rgba(0, 0, 0, 0)');
        expect(fixtureStyles.plus.markerBeforeContent).toBe('none');
        expect(fixtureStyles.plus.bulletAfterContent).not.toBe('none');
        expect(fixtureStyles.plus.bulletAfterDisplay).not.toBe('none');
        expect(parseFloat(fixtureStyles.plus.bulletAfterWidth)).toBeGreaterThan(0);
        expect(parseFloat(fixtureStyles.plus.bulletAfterHeight)).toBeGreaterThan(0);

        expect(fixtureStyles.star.text).toBe('*');
        expect(fixtureStyles.star.bulletFontSize).not.toBe('0px');
        expect(fixtureStyles.star.bulletColor).toBe('rgba(0, 0, 0, 0)');
        expect(fixtureStyles.star.markerBeforeContent).toBe('none');
        expect(fixtureStyles.star.bulletAfterContent).not.toBe('none');
        expect(fixtureStyles.star.bulletAfterDisplay).not.toBe('none');
        expect(parseFloat(fixtureStyles.star.bulletAfterWidth)).toBeGreaterThan(0);
        expect(parseFloat(fixtureStyles.star.bulletAfterHeight)).toBeGreaterThan(0);
    });

    it('reveals raw plus and star markers when the cursor moves into the marker', async () => {
        const cursorMarkerStyles = await browser.execute(() => {
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            const view = leaves[0]?.view;
            const cm = view?.editor?.cm;
            if (!cm) {
                return [{ marker: 'error', error: 'missing-codemirror' }];
            }

            const cases = [
                { marker: 'plus', selector: '.pem-unordered-list-marker-plus', lineNumber: 2, offset: 5 },
                { marker: 'star', selector: '.pem-unordered-list-marker-star', lineNumber: 3, offset: 9 }
            ];

            return cases.map(({ marker, selector, lineNumber, offset }) => {
                const docLine = cm.state.doc.line(lineNumber);
                cm.dispatch({
                    selection: { anchor: docLine.from + offset }
                });
                cm.focus();

                const line = document.querySelector(selector) as HTMLElement | null;
                const formatting = line?.querySelector('.cm-formatting-list-ul') as HTMLElement | null;
                const listBullet = formatting?.querySelector('.list-bullet') as HTMLElement | null;
                const rawMarker = listBullet ?? formatting;
                if (!line || !formatting || !rawMarker) {
                    return { marker, error: 'missing-marker-dom' };
                }

                const rawStyle = window.getComputedStyle(rawMarker);
                const parentBefore = window.getComputedStyle(formatting, '::before');
                const bulletAfter = listBullet ? window.getComputedStyle(listBullet, '::after') : null;

                return {
                    marker,
                    lineClass: line.className,
                    markerText: formatting.textContent ?? '',
                    hasListBullet: listBullet !== null,
                    rawColor: rawStyle.color,
                    rawFontSize: rawStyle.fontSize,
                    parentBeforeContent: parentBefore.content,
                    bulletAfterContent: bulletAfter?.content ?? 'none'
                };
            });
        });

        cursorMarkerStyles.forEach((style) => {
            expect(style.error).toBeUndefined();
            expect(style.lineClass).toContain('cm-active');
            expect(style.markerText.trim()).toBe(style.marker === 'plus' ? '+' : '*');
            expect(style.rawColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(style.rawFontSize).not.toBe('0px');
            expect(style.parentBeforeContent).toBe('none');
            expect(style.bulletAfterContent).toBe('none');
        });
    });
});
