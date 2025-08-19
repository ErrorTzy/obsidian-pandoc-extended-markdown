import { Extension, StateField, EditorState, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';

// Widget for rendering fancy list markers
class FancyListMarkerWidget extends WidgetType {
    constructor(private marker: string, private type: string) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'cm-formatting cm-formatting-list cm-formatting-list-ol';
        span.style.color = 'var(--list-marker-color)';
        span.textContent = this.marker;
        return span;
    }

    eq(other: FancyListMarkerWidget) {
        return other.marker === this.marker;
    }
}

// Widget for example list markers
class ExampleListMarkerWidget extends WidgetType {
    constructor(private number: number) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'cm-formatting cm-formatting-list cm-formatting-list-ol';
        span.style.color = 'var(--list-marker-color)';
        span.textContent = `(${this.number}) `;
        return span;
    }

    eq(other: ExampleListMarkerWidget) {
        return other.number === this.number;
    }
}

// Widget for definition list bullets
class DefinitionBulletWidget extends WidgetType {
    toDOM() {
        const span = document.createElement('span');
        span.textContent = '• ';
        return span;
    }
    
    eq(other: DefinitionBulletWidget) {
        return true;
    }
}

// Widget for hash auto-numbering
class HashListMarkerWidget extends WidgetType {
    constructor(private number: number) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'cm-formatting cm-formatting-list cm-formatting-list-ol';
        span.style.color = 'var(--list-marker-color)';
        span.textContent = `${this.number}. `;
        return span;
    }

    eq(other: HashListMarkerWidget) {
        return other.number === this.number;
    }
}

// Widget for example references
class ExampleReferenceWidget extends WidgetType {
    constructor(private number: number) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'pandoc-example-reference';
        span.style.color = 'var(--text-accent)';
        span.textContent = `(${this.number})`;
        return span;
    }

    eq(other: ExampleReferenceWidget) {
        return other.number === this.number;
    }
}

// Simple view plugin without state field to avoid errors
const pandocListsPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        exampleLabels: Map<string, number> = new Map();

        constructor(view: EditorView) {
            this.scanExampleLabels(view);
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                if (update.docChanged) {
                    this.scanExampleLabels(update.view);
                }
                this.decorations = this.buildDecorations(update.view);
            }
        }

        scanExampleLabels(view: EditorView) {
            this.exampleLabels.clear();
            let counter = 1;
            const docText = view.state.doc.toString();
            const lines = docText.split('\n');
            
            for (const line of lines) {
                const match = line.match(/^(\s*)\(@([a-zA-Z0-9_-]+)\)\s+/);
                if (match) {
                    const label = match[2];
                    if (!this.exampleLabels.has(label)) {
                        this.exampleLabels.set(label, counter);
                    }
                    counter++;
                } else if (line.match(/^(\s*)\(@\)\s+/)) {
                    counter++;
                }
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            
            // Track cursor position to preserve source mode on cursor line
            const selection = view.state.selection.main;
            const cursorLine = view.state.doc.lineAt(selection.head).number;
            
            // Collect all decorations first
            const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
            
            // Track hash list numbering
            let hashCounter = 1;
            
            // Process entire document for consistent numbering
            for (let lineNum = 1; lineNum <= view.state.doc.lines; lineNum++) {
                const line = view.state.doc.line(lineNum);
                
                // Skip if cursor is on this line (preserve source mode)
                if (line.number === cursorLine) {
                    // Still count hash markers even on cursor line
                    if (line.text.match(/^(\s*)#\.\s+/)) {
                        hashCounter++;
                    }
                    continue;
                }
                
                const lineText = line.text;
                
                // Check for hash auto-numbering FIRST
                const hashMatch = lineText.match(/^(\s*)(#\.)(\s+)/);
                if (hashMatch) {
                    const indent = hashMatch[1];
                    const marker = hashMatch[2];
                    const space = hashMatch[3];
                    
                    decorations.push({
                        from: line.from + indent.length,
                        to: line.from + indent.length + marker.length + space.length,
                        decoration: Decoration.replace({
                            widget: new HashListMarkerWidget(hashCounter)
                        })
                    });
                    
                    hashCounter++;
                    continue;
                }
                
                // Check for fancy list markers (A. B. i. ii. etc)
                const fancyMatch = lineText.match(/^(\s*)(([A-Z]+|[a-z]+|[IVXLCDM]+|[ivxlcdm]+)([.)]))(\s+)/);
                if (fancyMatch && !lineText.match(/^(\s*)([0-9]+[.)])/)) {
                    const indent = fancyMatch[1];
                    const marker = fancyMatch[2];
                    const markerWithSpace = marker + fancyMatch[5];
                    
                    decorations.push({
                        from: line.from + indent.length,
                        to: line.from + indent.length + markerWithSpace.length,
                        decoration: Decoration.replace({
                            widget: new FancyListMarkerWidget(markerWithSpace, 'fancy')
                        })
                    });
                    
                    continue;
                }
                
                // Check for example list markers (@)
                const exampleMatch = lineText.match(/^(\s*)(\(@([a-zA-Z0-9_-]*)\))(\s+)/);
                if (exampleMatch) {
                    const indent = exampleMatch[1];
                    const fullMarker = exampleMatch[2];
                    const label = exampleMatch[3];
                    const space = exampleMatch[4];
                    
                    let exampleNumber = 1;
                    
                    if (label && this.exampleLabels.has(label)) {
                        exampleNumber = this.exampleLabels.get(label)!;
                    } else {
                        // Count unlabeled examples before this line
                        let tempCounter = 1;
                        for (let i = 1; i < line.number; i++) {
                            const prevLine = view.state.doc.line(i).text;
                            if (prevLine.match(/^(\s*)\(@\)\s+/)) {
                                tempCounter++;
                            }
                        }
                        exampleNumber = tempCounter;
                    }
                    
                    decorations.push({
                        from: line.from + indent.length,
                        to: line.from + indent.length + fullMarker.length + space.length,
                        decoration: Decoration.replace({
                            widget: new ExampleListMarkerWidget(exampleNumber)
                        })
                    });
                    
                    continue;
                }
                
                // Check for definition items FIRST before checking terms
                const defItemMatch = lineText.match(/^(\s*)([~:])(\s+)/);
                if (defItemMatch) {
                    const indent = defItemMatch[1];
                    const marker = defItemMatch[2];
                    const space = defItemMatch[3];
                    
                    decorations.push({
                        from: line.from + indent.length,
                        to: line.from + indent.length + marker.length + space.length,
                        decoration: Decoration.replace({
                            widget: new DefinitionBulletWidget()
                        })
                    });
                    continue; // Skip term check for definition lines
                }
                
                // Check for definition terms - only if NOT a definition item
                // A term is a non-empty line that is followed by a definition
                if (lineText.trim() && !lineText.match(/^(\s*)[~:]\s+/)) {
                    const nextLineNum = line.number + 1;
                    if (nextLineNum <= view.state.doc.lines) {
                        const nextLine = view.state.doc.line(nextLineNum);
                        const nextText = nextLine.text;
                        // Check if next line is a definition
                        if (nextText.match(/^(\s*)[~:]\s+/)) {
                            // This is a definition term - apply underline
                            decorations.push({
                                from: line.from,
                                to: line.to,
                                decoration: Decoration.mark({
                                    class: 'pandoc-definition-term'
                                })
                            });
                        }
                    }
                }
                
                // Process example references inline
                const refRegex = /\(@([a-zA-Z0-9_-]+)\)/g;
                let match;
                while ((match = refRegex.exec(lineText)) !== null) {
                    const label = match[1];
                    if (this.exampleLabels.has(label)) {
                        const number = this.exampleLabels.get(label)!;
                        decorations.push({
                            from: line.from + match.index,
                            to: line.from + match.index + match[0].length,
                            decoration: Decoration.replace({
                                widget: new ExampleReferenceWidget(number)
                            })
                        });
                    }
                }
            }
            
            // Sort decorations by from position
            decorations.sort((a, b) => a.from - b.from || a.to - b.to);
            
            // Add sorted decorations to builder
            for (const {from, to, decoration} of decorations) {
                builder.add(from, to, decoration);
            }
            
            return builder.finish();
        }
    },
    {
        decorations: v => v.decorations
    }
);

export function pandocListsExtension(): Extension {
    return [
        pandocListsPlugin,
        EditorView.baseTheme({
            '.pandoc-definition-term': {
                fontWeight: 'bold',
                textDecoration: 'underline'
            },
            '.pandoc-example-reference': {
                color: 'var(--text-accent)',
                cursor: 'pointer'
            },
            '.pandoc-example-reference:hover': {
                textDecoration: 'underline'
            },
            '.cm-line:has(.cm-formatting-list)': {
                textIndent: '-1.5em',
                paddingLeft: '2em'
            }
        })
    ];
}