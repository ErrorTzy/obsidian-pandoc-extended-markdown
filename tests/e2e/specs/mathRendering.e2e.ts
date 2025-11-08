import { browser, $, $$ } from '@wdio/globals';

describe('Math Expression Rendering Bug', () => {
    before(async () => {
        // Load the test vault
        await browser.reloadObsidian({
            vault: "./tests/e2e/vaults/test-vault"
        });
        
        // Ensure plugin is enabled
        await browser.execute(() => {
            // @ts-ignore
            const plugin = app.plugins.plugins['pandoc-extended-markdown'];
            if (!plugin) {
                // @ts-ignore
                return app.plugins.enablePlugin('pandoc-extended-markdown');
            }
            if (plugin && plugin.settings) {
                plugin.settings.moreExtendedSyntax = true;
                plugin.settings.enableExampleLists = true;
                plugin.settings.enableFancyLists = true;
                plugin.settings.enableHashAutoNumber = true;
                plugin.saveSettings();
            }
        });
    });

    it('should ignore superscript syntax inside inline code spans', async () => {
        const filePath = 'inline-code-superscript.md';
        const testContent = '`X^2` is x^2^ but the "`^2` is x"';

        await createOrReplaceFile(filePath, testContent);
        await openFileInActiveLeaf(filePath);
        await ensureSourceMode();

        const renderInfo = await browser.execute(() => {
            const container = document.querySelector('.markdown-source-view.mod-cm6 .cm-content');
            if (!container) {
                return { inlineHasSuperscript: true, supTexts: ['error'] };
            }
            const inlineNodes = Array.from(container.querySelectorAll('.cm-inline-code')) as HTMLElement[];
            const inlineHasSuperscript = inlineNodes.some(node => node.querySelector('.pem-superscript'));
            const supTexts = Array.from(container.querySelectorAll('.pem-superscript')).map(el => el.textContent ?? '');
            return {
                inlineHasSuperscript,
                supTexts
            };
        });

        const treeNodes = await browser.execute(() => {
            const requireFunc = (window as unknown as { require?: (path: string) => any }).require;
            if (!requireFunc) return [];
            try {
                const { syntaxTree } = requireFunc('@codemirror/language');
                // @ts-ignore
                const leaves = app.workspace.getLeavesOfType('markdown');
                if (!leaves.length) return [];
                const view = leaves[0].view as any;
                const cm = view?.editor?.cm || view?.editor?.cm6 || view?.cm;
                if (!cm) return [];
                const tree = syntaxTree(cm.state);
                const nodes: Array<{name: string; from: number; to: number}> = [];
                tree.iterate({
                    enter: (node) => {
                        if (nodes.length < 40) {
                            nodes.push({ name: node.type.name, from: node.from, to: node.to });
                        }
                    }
                });
                return nodes;
            } catch (error) {
                console.error('Tree inspection failed', error);
                return [];
            }
        });
        console.log('Syntax tree nodes:', treeNodes);

        expect(renderInfo.supTexts).toEqual(['2']);
        expect(renderInfo.inlineHasSuperscript).toBe(false);

        await deleteFileIfExists(filePath);
    });

    it('should not interfere with math expressions containing superscripts', async () => {
        // Create a test file with the problematic content
        const testContent = `> Given $R^{+}_{xy}$ and $R^{+}_{yz}$, if x=y or y=z, obviously we have $R^{+}_{xz}$`;
        
        await createOrReplaceFile('math-bug-test.md', testContent);
        await openFileInActiveLeaf('math-bug-test.md');
        await ensureSourceMode();

        // Get the rendered HTML in live preview
        const livePreviewHTML = await browser.execute(() => {
            const container = document.querySelector('.markdown-source-view.mod-cm6 .cm-content');
            if (!container) return 'Container not found';
            
            // Find the line with our content
            const lines = container.querySelectorAll('.cm-line');
            for (const line of lines) {
                const html = (line as HTMLElement).innerHTML;
                if (html.includes('Given') || html.includes('xy')) {
                    console.log('Found line HTML:', html);
                    return html;
                }
            }
            
            // If not found, return all lines for debugging
            const allLines = Array.from(lines).map(l => (l as HTMLElement).innerHTML);
            return 'Line not found. All lines: ' + JSON.stringify(allLines);
        });

        console.log('Live Preview HTML:', livePreviewHTML);

        // Check if the bug is present - superscript widgets interrupting math
        const hasBug = livePreviewHTML.includes('pem-superscript') && 
                      livePreviewHTML.includes('class="math"');
        
        // Log details for debugging
        if (hasBug) {
            console.log('BUG DETECTED: Math expressions are being interrupted by superscript widgets');
        }
        
        // The bug manifests as the math being broken up with pem-superscript widgets
        // So we check if pem-superscript appears in what should be pure math rendering
        expect(livePreviewHTML).toContain('math'); // Math should be rendered
        
        // If our fix works, there should be NO pem-superscript in this line
        // because the entire line should be protected as math expressions
        if (livePreviewHTML.includes('pem-superscript')) {
            console.log('FAILURE: Superscript processor is still interfering with math!');
            throw new Error('Math expressions are being broken by superscript processor');
        } else {
            console.log('SUCCESS: Math expressions are properly protected from superscript processing!');
        }

        // Clean up
        await deleteFileIfExists('math-bug-test.md');
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
