import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { ProcessingPipeline } from '../../src/live-preview/pipeline/ProcessingPipeline';
import { HashListProcessor } from '../../src/live-preview/pipeline/structural/HashListProcessor';
import { FancyListProcessor } from '../../src/live-preview/pipeline/structural/FancyListProcessor';
import { ExampleListProcessor } from '../../src/live-preview/pipeline/structural/ExampleListProcessor';
import { ExampleReferenceProcessor } from '../../src/live-preview/pipeline/inline/ExampleReferenceProcessor';
import { CustomLabelReferenceProcessor } from '../../src/live-preview/pipeline/inline/CustomLabelReferenceProcessor';
import { PandocExtendedMarkdownSettings } from '../../src/core/settings';
import { PluginStateManager } from '../../src/core/state/pluginStateManager';

describe('Cross-references in lists (Pipeline)', () => {
    let view: EditorView;
    let pipeline: ProcessingPipeline;
    let stateManager: PluginStateManager;
    let settings: PandocExtendedMarkdownSettings;
    let container: HTMLElement;
    
    const updateView = (doc: string) => {
        if (view && view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        view = new EditorView({
            state: EditorState.create({ doc }),
            parent: container
        });
    };
    
    const findDecorationByWidget = (decorations: any, widgetName: string, position?: number): boolean => {
        if (!decorations?.iter) return false;
        
        const iter = decorations.iter();
        while (iter.value !== null) {
            // In our mock, iter.value has {from, to, decoration} structure
            const decoration = iter.value?.decoration;
            const specs = decoration?.spec;
            if (specs) {
                if (Array.isArray(specs)) {
                    for (const spec of specs) {
                        if (spec.widget?.constructor.name === widgetName) {
                            if (position === undefined || iter.value.from === position) {
                                return true;
                            }
                        }
                    }
                } else if (specs.widget?.constructor.name === widgetName) {
                    if (position === undefined || iter.value.from === position) {
                        return true;
                    }
                }
            }
            iter.next();
        }
        return false;
    };
    
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        stateManager = new PluginStateManager();
        pipeline = new ProcessingPipeline(stateManager);
        
        settings = {
            enableAutoFormatting: true,
            strictPandocMode: false,
            moreExtendedSyntax: true,
            panelOrder: [],
            useNewPipeline: true
        } as PandocExtendedMarkdownSettings;
        
        // Register processors
        pipeline.registerStructuralProcessor(new HashListProcessor());
        pipeline.registerStructuralProcessor(new FancyListProcessor());
        pipeline.registerStructuralProcessor(new ExampleListProcessor());
        pipeline.registerInlineProcessor(new ExampleReferenceProcessor());
        pipeline.registerInlineProcessor(new CustomLabelReferenceProcessor());
    });
    
    afterEach(() => {
        if (view.dom?.parentNode) {
            view.dom.parentNode.removeChild(view.dom);
        }
        stateManager.clearAllStates();
    });
    
    describe('Example references in lists', () => {
        it('should process example references in fancy lists', () => {
            const doc = '(@a) Example list item\nA. crossref in fancy list (@a)';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            
            // Debug: Log what widgets are actually created
            const widgets: string[] = [];
            const iter = decorations.iter();
            while (iter.value !== null) {
                const decoration = iter.value?.decoration;
                const widgetName = decoration?.spec?.widget?.constructor?.name;
                if (widgetName) {
                    widgets.push(widgetName);
                }
                iter.next();
            }
            
            // Check if we have the expected widgets
            expect(widgets).toContain('ExampleListMarkerWidget'); // For (@a)
            expect(widgets).toContain('FancyListMarkerWidget'); // For A.
            expect(widgets).toContain('ExampleReferenceWidget'); // For the reference (@a)
        });
        
        it('should process example references in hash lists', () => {
            const doc = '(@a) Example list item\n#. crossref in hash list (@a)';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'ExampleReferenceWidget')).toBe(true);
        });
        
        it('should process example references in example lists', () => {
            const doc = '(@a) First example\n(@b) another example with ref (@a)';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'ExampleReferenceWidget')).toBe(true);
        });
        
        it('should handle multiple references in same line', () => {
            const doc = '(@a) Example A\n(@b) Example B\n#. Item with (@a) and (@b)';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            // Should have multiple reference widgets
            let refCount = 0;
            const iter = decorations.iter();
            while (iter.value !== null) {
                const decoration = iter.value?.decoration;
                const specs = decoration?.spec;
                if (specs) {
                    if (Array.isArray(specs)) {
                        for (const spec of specs) {
                            if (spec.widget?.constructor.name === 'ExampleReferenceWidget') {
                                refCount++;
                            }
                        }
                    } else if (specs.widget?.constructor.name === 'ExampleReferenceWidget') {
                        refCount++;
                    }
                }
                iter.next();
            }
            expect(refCount).toBe(2);
        });
    });
    
    describe('Custom label references in lists', () => {
        beforeEach(() => {
            // Pre-populate state with custom labels
            const placeholderContext = stateManager.getPlaceholderContext('test-doc');
            placeholderContext.processLabel('P(#a)');
            placeholderContext.processLabel('P(#b)');
            
            // Simulate custom label scanning
            stateManager.setCustomLabels('test-doc', 
                new Map([['P1', 'First custom label'], ['P2', 'Second custom label']]),
                new Map([['P(#a)', 'P1'], ['P(#b)', 'P2']])
            );
        });
        
        it('should process custom label references in fancy lists', () => {
            const doc = '{::P(#a)} First custom label\nA. crossref in fancy list {::P(#a)}';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'CustomLabelReferenceWidget')).toBe(true);
        });
        
        it('should process custom label references in hash lists', () => {
            const doc = '{::P(#a)} First custom label\n#. crossref in hash list {::P(#a)}';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'CustomLabelReferenceWidget')).toBe(true);
        });
        
        it('should process custom label references in example lists', () => {
            const doc = '{::P(#a)} First custom label\n(@b) example list with ref {::P(#a)}';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'CustomLabelReferenceWidget')).toBe(true);
        });
    });
    
    describe('Mixed references', () => {
        beforeEach(() => {
            // Set up custom labels
            const placeholderContext = stateManager.getPlaceholderContext('test-doc');
            placeholderContext.processLabel('P(#a)');
            
            stateManager.setCustomLabels('test-doc',
                new Map([['P1', 'Custom label content']]),
                new Map([['P(#a)', 'P1']])
            );
        });
        
        it('should handle both example and custom references in same list', () => {
            const doc = '(@ex1) Example 1\n{::P(#a)} Custom label\n#. Item with (@ex1) and {::P(#a)}';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'ExampleReferenceWidget')).toBe(true);
            expect(findDecorationByWidget(decorations, 'CustomLabelReferenceWidget')).toBe(true);
        });
        
        it('should process mixed references in fancy lists', () => {
            const doc = '(@ex) Example\n{::Label} Label\nA. List with (@ex) and {::Label}';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'ExampleReferenceWidget')).toBe(true);
            expect(findDecorationByWidget(decorations, 'CustomLabelReferenceWidget')).toBe(true);
        });
        
        it('should handle complex nested content', () => {
            const doc = `(@a) First example
{::P(#a)} First custom label
#. Hash with (@a) reference
A. Fancy with {::P(#a)} reference
i. Roman with both (@a) and {::P(#a)}`;
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            
            expect(decorations).toBeDefined();
            
            // Count all reference widgets
            let exampleRefCount = 0;
            let customRefCount = 0;
            
            const iter = decorations.iter();
            while (iter.value !== null) {
                const decoration = iter.value?.decoration;
                const specs = decoration?.spec;
                if (specs) {
                    const specsArray = Array.isArray(specs) ? specs : [specs];
                    for (const spec of specsArray) {
                        if (spec.widget?.constructor.name === 'ExampleReferenceWidget') {
                            exampleRefCount++;
                        } else if (spec.widget?.constructor.name === 'CustomLabelReferenceWidget') {
                            customRefCount++;
                        }
                    }
                }
                iter.next();
            }
            
            expect(exampleRefCount).toBeGreaterThan(0);
            expect(customRefCount).toBeGreaterThan(0);
        });
    });
    
    describe('Edge cases', () => {
        it('should handle references to non-existent labels', () => {
            const doc = '#. List with (@nonexistent) reference';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            // Should not crash, but won't create reference widget
            expect(findDecorationByWidget(decorations, 'ExampleReferenceWidget')).toBe(false);
        });
        
        it('should handle malformed references', () => {
            const doc = '#. List with (@ malformed) and {@::bad}';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            // Should not crash on malformed references
        });
        
        it('should process references at line boundaries', () => {
            const doc = '(@test) Test\n(@ref)#. List starting with ref (@test)';
            updateView(doc);
            
            const decorations = pipeline.process(view, settings);
            expect(decorations).toBeDefined();
            expect(findDecorationByWidget(decorations, 'ExampleReferenceWidget')).toBe(true);
        });
    });
});