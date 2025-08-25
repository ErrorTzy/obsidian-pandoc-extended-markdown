import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { editorLivePreviewField } from 'obsidian';
import { pandocExtendedMarkdownExtension } from '../src/live-preview/extension';
import { DEFAULT_SETTINGS } from '../src/shared/types/settingsTypes';

describe('Definition List Bug Reproduction', () => {
    let view: EditorView;
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        view?.destroy();
        document.body.removeChild(container);
    });

    it('should process definition list terms and bullets in legacy mode', () => {
        const settings = { ...DEFAULT_SETTINGS, useNewPipeline: false };
        const getSettings = () => settings;
        const getDocPath = () => 'test.md';

        const doc = `Term 1

:   Definition 1 - This is the first definition`;

        const state = EditorState.create({
            doc,
            extensions: [
                pandocExtendedMarkdownExtension(getSettings, getDocPath),
                editorLivePreviewField.init(() => true) // Enable live preview
            ]
        });

        view = new EditorView({
            state,
            parent: container
        });

        // Force a decoration update
        view.dispatch({ effects: [] });

        // Get the plugin view and its decorations
        const pluginViews = view.state.facet(EditorView.pluginField);
        let decorations: any = null;
        
        for (const plugin of pluginViews) {
            if (plugin.decorations) {
                decorations = plugin.decorations;
                break;
            }
        }
        
        // Check if decorations exist
        const hasDecorations = decorations && decorations.size > 0;
        
        // Log for debugging
        if (decorations) {
            let decorationCount = 0;
            decorations.between(0, doc.length, (from: number, to: number, decoration: any) => {
                decorationCount++;
                console.log(`Decoration at ${from}-${to}:`, decoration);
            });
            console.log(`Total decorations: ${decorationCount}`);
        }

        expect(hasDecorations).toBe(true);
        
        // Specifically check for definition term decoration
        let hasTermDecoration = false;
        let hasBulletDecoration = false;
        
        if (decorations) {
            decorations.between(0, 6, (from: number, to: number, decoration: any) => {
                // Term is at position 0-6 ("Term 1")
                if (decoration.spec?.class?.includes('pandoc-definition-term')) {
                    hasTermDecoration = true;
                }
            });
            
            decorations.between(8, 20, (from: number, to: number, decoration: any) => {
                // Bullet area is around position 8-11 (":   ")
                if (decoration.spec?.widget) {
                    hasBulletDecoration = true;
                }
            });
        }
        
        expect(hasTermDecoration).toBe(true);
        expect(hasBulletDecoration).toBe(true);
    });

    it('should process definition list terms and bullets with new pipeline', () => {
        const settings = { ...DEFAULT_SETTINGS, useNewPipeline: true };
        const getSettings = () => settings;
        const getDocPath = () => 'test.md';

        const doc = `Term 1

:   Definition 1 - This is the first definition`;

        const state = EditorState.create({
            doc,
            extensions: [
                pandocExtendedMarkdownExtension(getSettings, getDocPath),
                editorLivePreviewField.init(() => true) // Enable live preview
            ]
        });

        view = new EditorView({
            state,
            parent: container
        });

        // Force a decoration update
        view.dispatch({ effects: [] });

        // Get the plugin view and its decorations
        const pluginViews = view.state.facet(EditorView.pluginField);
        let decorations: any = null;
        
        for (const plugin of pluginViews) {
            if (plugin.decorations) {
                decorations = plugin.decorations;
                break;
            }
        }
        
        // Check if decorations exist
        const hasDecorations = decorations && decorations.size > 0;
        
        // Log for debugging
        if (decorations) {
            let decorationCount = 0;
            decorations.between(0, doc.length, (from: number, to: number, decoration: any) => {
                decorationCount++;
                console.log(`Decoration at ${from}-${to}:`, decoration);
            });
            console.log(`Total decorations: ${decorationCount}`);
        }

        expect(hasDecorations).toBe(true);
        
        // Specifically check for definition term decoration
        let hasTermDecoration = false;
        let hasBulletDecoration = false;
        
        if (decorations) {
            decorations.between(0, 6, (from: number, to: number, decoration: any) => {
                // Term is at position 0-6 ("Term 1")
                if (decoration.spec?.class?.includes('pandoc-definition-term')) {
                    hasTermDecoration = true;
                }
            });
            
            decorations.between(8, 20, (from: number, to: number, decoration: any) => {
                // Bullet area is around position 8-11 (":   ")
                if (decoration.spec?.widget) {
                    hasBulletDecoration = true;
                }
            });
        }
        
        expect(hasTermDecoration).toBe(true);
        expect(hasBulletDecoration).toBe(true);
    });
});