import { Extension, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { editorLivePreviewField, App, Component } from 'obsidian';
import { PandocExtendedMarkdownSettings } from '../core/settings';
import { pluginStateManager } from '../core/state/pluginStateManager';

// Pipeline imports
import { ProcessingPipeline } from './pipeline/ProcessingPipeline';
import { HashListProcessor, FancyListProcessor, ExampleListProcessor, CustomLabelProcessor, DefinitionProcessor, FencedDivProcessor, StandardListProcessor, ListContinuationProcessor } from './pipeline/structural';
import { ExampleReferenceProcessor, SuperscriptProcessor, SubscriptProcessor, SmartDashProcessor, CustomLabelReferenceProcessor, FencedDivReferenceProcessor } from './pipeline/inline';
import { fencedDivDragExtension } from './fencedDivDragExtension';

// Main view plugin for rendering Pandoc extended markdown
const pandocExtendedMarkdownPlugin = (
    getSettings: () => PandocExtendedMarkdownSettings, 
    getDocPath: () => string | null,
    getApp?: () => App | undefined,
    getComponent?: () => Component | undefined
) => ViewPlugin.fromClass(
    class PandocExtendedMarkdownView {
        decorations: DecorationSet;
        private pipeline: ProcessingPipeline;
        private rebuildTimer: number | null = null;
        private rebuildRequested = false;
        private readonly rebuildDelayMs = 120;

        constructor(view: EditorView) {
            this.initializePipeline(getApp, getComponent);
            this.decorations = this.buildDecorations(view);
        }
        
        private initializePipeline(getApp?: () => App | undefined, getComponent?: () => Component | undefined): void {
            const app = getApp ? getApp() : undefined;
            const component = getComponent ? getComponent() : undefined;
            this.pipeline = new ProcessingPipeline(pluginStateManager, app, component);
            
            // Register structural processors
            this.pipeline.registerStructuralProcessor(new HashListProcessor());
            this.pipeline.registerStructuralProcessor(new FancyListProcessor());
            this.pipeline.registerStructuralProcessor(new FencedDivProcessor());
            // StandardListProcessor only adds source-marker classes; Obsidian keeps
            // ownership of native unordered list rendering and editing behavior.
            this.pipeline.registerStructuralProcessor(new StandardListProcessor());
            this.pipeline.registerStructuralProcessor(new ExampleListProcessor());
            this.pipeline.registerStructuralProcessor(new CustomLabelProcessor());
            this.pipeline.registerStructuralProcessor(new DefinitionProcessor());
            // ListContinuationProcessor must be registered last to run after all list processors
            this.pipeline.registerStructuralProcessor(new ListContinuationProcessor());
            
            // Register inline processors
            this.pipeline.registerInlineProcessor(new ExampleReferenceProcessor());
            this.pipeline.registerInlineProcessor(new FencedDivReferenceProcessor());
            this.pipeline.registerInlineProcessor(new SuperscriptProcessor());
            this.pipeline.registerInlineProcessor(new SubscriptProcessor());
            this.pipeline.registerInlineProcessor(new SmartDashProcessor());
            this.pipeline.registerInlineProcessor(new CustomLabelReferenceProcessor());
        }

        update(update: ViewUpdate) {
            // Check if live preview state changed
            const prevLivePreview = update.startState.field(editorLivePreviewField);
            const currLivePreview = update.state.field(editorLivePreviewField);
            const livePreviewChanged = prevLivePreview !== currLivePreview;

            if (this.rebuildRequested) {
                this.rebuildRequested = false;
                this.decorations = this.buildDecorations(update.view);
                return;
            }

            if (update.docChanged) {
                this.decorations = this.decorations.map(update.changes);
                this.scheduleRebuild(update.view);
                return;
            }

            if (this.rebuildTimer !== null && update.selectionSet) {
                return;
            }

            if (update.viewportChanged || update.selectionSet || livePreviewChanged) {
                this.clearScheduledRebuild();
                this.decorations = this.buildDecorations(update.view);
            }
        }

        destroy() {
            this.clearScheduledRebuild();
        }

        private scheduleRebuild(view: EditorView): void {
            this.clearScheduledRebuild();
            this.rebuildTimer = window.setTimeout(() => {
                this.rebuildTimer = null;
                this.rebuildRequested = true;
                view.dispatch({});
            }, this.rebuildDelayMs);
        }

        private clearScheduledRebuild(): void {
            if (this.rebuildTimer !== null) {
                window.clearTimeout(this.rebuildTimer);
                this.rebuildTimer = null;
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
    getApp?: () => App | undefined,
    getComponent?: () => Component | undefined
): Extension {
    return [
        pandocExtendedMarkdownPlugin(getSettings, getDocPath, getApp, getComponent),
        fencedDivDragExtension(getSettings)
    ];
}
