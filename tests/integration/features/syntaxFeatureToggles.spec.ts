import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { createListAutocompletionKeymap } from '../../../src/editor-extensions/listAutocompletion';
import { ProcessingPipeline } from '../../../src/live-preview/pipeline/ProcessingPipeline';
import { FancyListProcessor } from '../../../src/live-preview/pipeline/structural/FancyListProcessor';
import { ExampleListProcessor } from '../../../src/live-preview/pipeline/structural/ExampleListProcessor';
import { CustomLabelProcessor } from '../../../src/live-preview/pipeline/structural/CustomLabelProcessor';
import { SuperscriptProcessor } from '../../../src/live-preview/pipeline/inline/SuperscriptProcessor';
import { PluginStateManager } from '../../../src/core/state/pluginStateManager';
import { normalizeSettings } from '../../../src/shared/types/settingsTypes';

describe('Syntax feature toggles', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it('skips live preview decorations for disabled syntax features', () => {
        const view = new EditorView({
            state: EditorState.create({
                doc: 'A. Fancy item\n(@a) Example item\n{::P} Custom label\n^sup^'
            }),
            parent: container
        });
        const pipeline = new ProcessingPipeline(new PluginStateManager());
        pipeline.registerStructuralProcessor(new FancyListProcessor());
        pipeline.registerStructuralProcessor(new ExampleListProcessor());
        pipeline.registerStructuralProcessor(new CustomLabelProcessor());
        pipeline.registerInlineProcessor(new SuperscriptProcessor());

        const settings = normalizeSettings({
            enableFancyLists: false,
            enableExampleLists: false,
            enableCustomLabelLists: false,
            enableSuperscript: false
        });

        const decorations = pipeline.process(view, settings);

        expect(decorations.iter().value).toBe(null);
        view.destroy();
    });

    it('does not continue disabled list syntax from Enter handling', () => {
        const settings = normalizeSettings({
            enableFancyLists: false
        });
        const keybindings = createListAutocompletionKeymap(settings);
        const enterHandler = keybindings.find(binding => binding.key === 'Enter');
        const view = {
            state: EditorState.create({
                doc: 'A. Fancy item',
                selection: EditorSelection.cursor('A. Fancy item'.length)
            }),
            dispatch: jest.fn()
        } as any as EditorView;

        const handled = enterHandler?.run(view);

        expect(handled).toBe(false);
        expect(view.dispatch).not.toHaveBeenCalled();
    });
});
