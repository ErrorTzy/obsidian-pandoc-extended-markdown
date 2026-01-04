import { browser, expect } from '@wdio/globals';
import path from 'path';

describe('Syntax tree code nodes', () => {
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
                plugin.settings.moreExtendedSyntax = true;
                plugin.saveSettings();
            }
        });
    });

    it('reports code and math nodes from the syntax tree', async () => {
        const filePath = 'syntax-tree-code-nodes.md';
        const content = [
            'Here is `inline` code.',
            '',
            'Inline math: $x^2$ and $y_{1}$.',
            '',
            '$$',
            'E = mc^2',
            '$$',
            '',
            '```js',
            'const x = 1;',
            '```',
            ''
        ].join('\n');

        await createOrReplaceFile(filePath, content);
        await openFileInActiveLeaf(filePath);
        await ensureSourceMode();

        const modulePath = path.resolve(process.cwd(), 'node_modules/@codemirror/language');
        const treeInfo = await browser.execute((languagePath: string) => {
            const requireFunc = (window as unknown as { require?: (path: string) => any }).require;
            if (!requireFunc) {
                return { error: 'require-not-available' };
            }

            let languageModule: any;
            try {
                languageModule = requireFunc('@codemirror/language');
            } catch (error) {
                try {
                    languageModule = requireFunc(languagePath);
                } catch (innerError) {
                    return { error: 'require-failed' };
                }
            }

            const { syntaxTree, ensureSyntaxTree } = languageModule;
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            if (!leaves.length) {
                return { error: 'no-markdown-leaf' };
            }

            const view = leaves[0].view as any;
            const cm = view?.editor?.cm || view?.editor?.cm6 || view?.cm;
            if (!cm) {
                return { error: 'no-codemirror' };
            }

            const docLength = cm.state.doc.length;
            let tree = null;
            if (ensureSyntaxTree) {
                tree = ensureSyntaxTree(cm.state, docLength, 1000);
            }
            if (!tree && syntaxTree) {
                tree = syntaxTree(cm.state);
            }
            if (!tree) {
                return { error: 'no-tree' };
            }

            const names: string[] = [];
            tree.iterate({
                enter: (node: { type: { name: string } }) => {
                    names.push(node.type.name);
                }
            });

            const uniqueNames = Array.from(new Set(names));
            const lowerNames = uniqueNames.map(name => name.toLowerCase());
            const hasInlineCode = lowerNames.some(name => name.includes('inline') && name.includes('code'));
            const hasCodeBlock = lowerNames.some(name =>
                name.includes('codeblock') ||
                name.includes('fenced') ||
                (name.includes('code') && name.includes('block'))
            );
            const mathNames = uniqueNames.filter(name => name.toLowerCase().includes('math'));
            const hasMath = mathNames.length > 0;

            return {
                names: uniqueNames,
                hasInlineCode,
                hasCodeBlock,
                hasMath,
                mathNames,
                docLength
            };
        }, modulePath);

        if ('error' in treeInfo) {
            throw new Error(`syntaxTree probe failed: ${treeInfo.error}`);
        }

        console.log('Syntax tree node names:', treeInfo.names);
        console.log('Syntax tree math node names:', treeInfo.mathNames);

        expect(treeInfo.hasInlineCode).toBe(true);
        expect(treeInfo.hasCodeBlock).toBe(true);

        await deleteFileIfExists(filePath);
    });
});

async function createOrReplaceFile(path: string, content: string): Promise<void> {
    await browser.execute((filePath: string, data: string) => {
        // @ts-ignore
        const existing = app.vault.getAbstractFileByPath(filePath);
        if (existing) {
            // @ts-ignore
            app.vault.delete(existing);
        }
        // @ts-ignore
        app.vault.create(filePath, data);
        return true;
    }, path, content);
}

async function openFileInActiveLeaf(path: string): Promise<void> {
    await browser.execute((filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            return app.workspace.getLeaf().openFile(file);
        }
        return false;
    }, path);
}

async function ensureSourceMode(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view && view.getMode && view.getMode() !== 'source') {
                // @ts-ignore
                view.setMode('source');
            }
        }
    });
    await browser.pause(500);
}

async function deleteFileIfExists(path: string): Promise<void> {
    await browser.execute((filePath: string) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(filePath);
        if (file) {
            // @ts-ignore
            app.vault.delete(file);
        }
    }, path);
}
