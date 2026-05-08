import { browser, expect } from '@wdio/globals';

import {
    PANDOC_MARKDOWN_FORMAT,
    SyntaxParityFixture,
    createOrReplaceFile,
    deleteFileIfExists,
    ensureReadingMode,
    getSyntaxParity,
    openFileInActiveLeaf,
    renderPandocHtml,
    waitForSyntax
} from '../helpers/pandocSyntaxParity';

describe('Pandoc extended syntax reading-mode parity', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });
        await enableAllSyntaxes();
    });

    it('matches Pandoc HTML structure for semantic renderers without dedicated parity specs', async () => {
        const fixtures: SyntaxParityFixture[] = [
            {
                name: 'nested-fenced-div',
                markdown: [
                    '::: {.outer #outer}',
                    'Outer',
                    '',
                    '::: {.note #inner}',
                    'Inner',
                    ':::',
                    ':::'
                ].join('\n'),
                waitForSelector: '.pem-fenced-div .pem-fenced-div-note',
                expectedSelector: 'div.outer',
                actualKind: 'fenced-div',
                pandocArgs: [
                    '-f',
                    PANDOC_MARKDOWN_FORMAT,
                    '-t',
                    'html',
                    '--lua-filter=lua_filter/FencedDivExtendedSyntax.lua'
                ]
            },
            {
                name: 'superscript-and-subscript',
                markdown: 'Water is H~2~O and 2^10^.',
                waitForSelector: 'sub.pem-subscript',
                expectedSelector: 'p',
                actualKind: 'super-sub'
            },
            {
                name: 'upper-alpha-fancy-list',
                markdown: [
                    'A.  aaa',
                    'B.  aaa'
                ].join('\n'),
                waitForSelector: 'ol[type="A"] > li',
                expectedSelector: 'ol',
                actualKind: 'ordered-list'
            },
            {
                name: 'hash-list',
                markdown: [
                    '#. auto numbered item',
                    '#. second'
                ].join('\n'),
                waitForSelector: 'ol > li',
                expectedSelector: 'ol',
                actualKind: 'ordered-list'
            },
            {
                name: 'example-cross-reference',
                markdown: [
                    '(@ex) labeled example',
                    '',
                    'See (@ex).'
                ].join('\n'),
                waitForSelector: 'ol.example > li',
                expectedSelector: 'ol.example, p',
                actualKind: 'ordered-list'
            },
            {
                name: 'custom-label-cross-reference',
                markdown: [
                    '{::P(#a)} custom labeled item',
                    '',
                    'See {::P(#a)}.'
                ].join('\n'),
                waitForSelector: 'p strong .pem-list-marker',
                expectedSelector: 'p',
                actualKind: 'custom-label-list',
                expectedHtml: '<p><strong>(P1)</strong>\tcustom labeled item</p><p>See (P1).</p>'
            },
            {
                name: 'fenced-div-cross-reference',
                markdown: [
                    '::: {.proposition #prop:a}',
                    'A proposition.',
                    ':::',
                    '',
                    '::: {.logic-block #prem:a title="Premise"}',
                    'A premise.',
                    ':::',
                    '',
                    'See @prop:a and @prem:a.'
                ].join('\n'),
                waitForSelector: '.pem-fenced-div-reference',
                expectedSelector: 'div.proposition, div.logic-block, p',
                actualKind: 'fenced-div-cross-reference',
                pandocArgs: [
                    '-f',
                    PANDOC_MARKDOWN_FORMAT,
                    '-t',
                    'html',
                    '--lua-filter=lua_filter/FencedDivExtendedSyntax.lua'
                ]
            }
        ];

        for (const fixture of fixtures) {
            const path = `pandoc-extended-syntax-parity-${fixture.name}.md`;
            await createOrReplaceFile(path, fixture.markdown);
            await openFileInActiveLeaf(path);
            await ensureReadingMode();
            await waitForSyntax(fixture.waitForSelector);

            const parity = await getSyntaxParity(fixture);

            expect(parity.actual).toEqual(parity.expected);
            await deleteFileIfExists(path);
        }
    });

    it('follows Pandoc for fenced-div shortcut validity edge cases', async () => {
        const validShortcut = [
            '::: warning',
            'shortcut body',
            ':::'
        ].join('\n');
        const invalidMixedSyntax = [
            '::: Warning {.danger}',
            'invalid body',
            ':::'
        ].join('\n');

        await createOrReplaceFile('pandoc-valid-fenced-shortcut.md', validShortcut);
        await openFileInActiveLeaf('pandoc-valid-fenced-shortcut.md');
        await ensureReadingMode();
        await waitForSyntax('.pem-fenced-div');

        const validState = await getFencedDivState();
        expect(validState.blockCount).toBe(1);
        expect(validState.blockText).toContain('shortcut body');
        expect(renderPandocHtml(validShortcut)).toContain('class="warning"');
        await deleteFileIfExists('pandoc-valid-fenced-shortcut.md');

        await createOrReplaceFile('pandoc-invalid-fenced-shortcut.md', invalidMixedSyntax);
        await openFileInActiveLeaf('pandoc-invalid-fenced-shortcut.md');
        await ensureReadingMode();
        await waitForPreviewText('::: Warning {.danger}');

        const invalidState = await getFencedDivState();
        expect(invalidState.blockCount).toBe(0);
        expect(invalidState.previewText).toContain('::: Warning {.danger}');
        expect(renderPandocHtml(invalidMixedSyntax)).toContain('<p>::: Warning {.danger} invalid body :::</p>');
        await deleteFileIfExists('pandoc-invalid-fenced-shortcut.md');
    });

});

async function enableAllSyntaxes(): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        let plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin) {
            // @ts-ignore
            await app.plugins.enablePlugin('pandoc-extended-markdown');
            // @ts-ignore
            plugin = app.plugins.plugins['pandoc-extended-markdown'];
        }

        if (plugin?.settings) {
            plugin.settings.strictPandocMode = false;
            plugin.settings.enableHashAutoNumber = true;
            plugin.settings.enableFancyLists = true;
            plugin.settings.enableExampleLists = true;
            plugin.settings.enableDefinitionLists = true;
            plugin.settings.enableFencedDivs = true;
            plugin.settings.enableSuperscript = true;
            plugin.settings.enableSubscript = true;
            plugin.settings.enableCustomLabelLists = true;
            await plugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    });
}

async function getFencedDivState(): Promise<{
    blockCount: number;
    blockText: string;
    previewText: string;
}> {
    return browser.execute(() => {
        const preview = document.querySelector('.markdown-preview-view') as HTMLElement | null;
        const blocks = Array.from(preview?.querySelectorAll('.pem-fenced-div') ?? []) as HTMLElement[];

        return {
            blockCount: blocks.length,
            blockText: blocks.map(block => block.textContent ?? '').join('\n'),
            previewText: preview?.textContent ?? ''
        };
    });
}

async function waitForPreviewText(text: string): Promise<void> {
    await browser.waitUntil(async () => {
        return browser.execute((expectedText: string) =>
            document.querySelector('.markdown-preview-view')?.textContent?.includes(expectedText) ?? false,
        text);
    }, {
        timeout: 5000,
        timeoutMsg: `Expected reading mode text: ${text}`
    });
}
