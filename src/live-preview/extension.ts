import { Extension, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { PandocExtendedMarkdownSettings } from '../core/settings';
import { pluginStateManager } from '../core/state/pluginStateManager';

// Pipeline imports
import { ProcessingPipeline } from './pipeline/ProcessingPipeline';
import { HashListProcessor, FancyListProcessor, ExampleListProcessor, CustomLabelProcessor, DefinitionProcessor, StandardListProcessor } from './pipeline/structural';
import { ExampleReferenceProcessor, SuperscriptProcessor, SubscriptProcessor, CustomLabelReferenceProcessor } from './pipeline/inline';

// Main view plugin for rendering Pandoc extended markdown
const pandocExtendedMarkdownPlugin = (
    getSettings: () => PandocExtendedMarkdownSettings, 
    getDocPath: () => string | null,
    getApp?: () => any,
    getComponent?: () => any
) => ViewPlugin.fromClass(
    class PandocExtendedMarkdownView {
        decorations: DecorationSet;
        private pipeline: ProcessingPipeline;

        constructor(view: EditorView) {
            this.initializePipeline(getApp, getComponent);
            this.decorations = this.buildDecorations(view);
        }
        
        private initializePipeline(getApp?: () => any, getComponent?: () => any): void {
            const app = getApp ? getApp() : undefined;
            const component = getComponent ? getComponent() : undefined;
            this.pipeline = new ProcessingPipeline(pluginStateManager, app, component);
            
            // Register structural processors
            this.pipeline.registerStructuralProcessor(new HashListProcessor());
            this.pipeline.registerStructuralProcessor(new FancyListProcessor());
            // StandardListProcessor is registered but disabled (always returns false in canProcess)
            // to preserve Obsidian's default rendering for *, +, - lists
            this.pipeline.registerStructuralProcessor(new StandardListProcessor());
            this.pipeline.registerStructuralProcessor(new ExampleListProcessor());
            this.pipeline.registerStructuralProcessor(new CustomLabelProcessor());
            this.pipeline.registerStructuralProcessor(new DefinitionProcessor());
            
            // Register inline processors
            this.pipeline.registerInlineProcessor(new ExampleReferenceProcessor());
            this.pipeline.registerInlineProcessor(new SuperscriptProcessor());
            this.pipeline.registerInlineProcessor(new SubscriptProcessor());
            this.pipeline.registerInlineProcessor(new CustomLabelReferenceProcessor());
        }

        update(update: ViewUpdate) {
            // Check if live preview state changed
            const prevLivePreview = update.startState.field(editorLivePreviewField);
            const currLivePreview = update.state.field(editorLivePreviewField);
            const livePreviewChanged = prevLivePreview !== currLivePreview;
            
            if (update.docChanged || update.viewportChanged || update.selectionSet || livePreviewChanged) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            // Check if we're in live preview mode
            const isLivePreview = view.state.field(editorLivePreviewField);
            if (!isLivePreview || !this.pipeline) {
                return new RangeSetBuilder<Decoration>().finish();
            }
            
            const settings = getSettings();
            return this.pipeline.process(view, settings);
        }
    },
    {
        decorations: v => v.decorations
    }
);

export function pandocExtendedMarkdownExtension(
    getSettings: () => PandocExtendedMarkdownSettings, 
    getDocPath: () => string | null,
    getApp?: () => any,
    getComponent?: () => any
): Extension {
    return pandocExtendedMarkdownPlugin(getSettings, getDocPath, getApp, getComponent);
}