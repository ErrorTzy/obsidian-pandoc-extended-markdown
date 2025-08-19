import { Extension, StateField, EditorState, RangeSetBuilder } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';

// Widget for rendering fancy list markers
class FancyListMarkerWidget extends WidgetType {
    constructor(private marker: string, private type: string) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'cm-formatting cm-formatting-list cm-formatting-list-ol cm-list-1';
        const innerSpan = document.createElement('span');
        innerSpan.className = 'list-number';
        innerSpan.textContent = this.marker;
        span.appendChild(innerSpan);
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
        span.className = 'cm-formatting cm-formatting-list cm-formatting-list-ol cm-list-1';
        const innerSpan = document.createElement('span');
        innerSpan.className = 'list-number';
        innerSpan.textContent = `(${this.number}) `;
        span.appendChild(innerSpan);
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
        span.className = 'cm-formatting cm-formatting-list cm-list-1';
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
        span.className = 'cm-formatting cm-formatting-list cm-formatting-list-ol cm-list-1';
        const innerSpan = document.createElement('span');
        innerSpan.className = 'list-number';
        innerSpan.textContent = `${this.number}. `;
        span.appendChild(innerSpan);
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
            
            // Check if we're in live preview mode - if not, return empty decorations
            const isLivePreview = view.state.field(editorLivePreviewField);
            if (!isLivePreview) {
                return builder.finish();
            }
            
            // Track cursor position to preserve source mode only when cursor is in the marker
            const selection = view.state.selection.main;
            const cursorPos = selection.head;
            
            // Collect all decorations first
            const decorations: Array<{from: number, to: number, decoration: Decoration}> = [];
            
            // Track hash list numbering
            let hashCounter = 1;
            
            // Process entire document for consistent numbering
            for (let lineNum = 1; lineNum <= view.state.doc.lines; lineNum++) {
                const line = view.state.doc.line(lineNum);
                const lineText = line.text;
                
                // Check for hash auto-numbering FIRST
                const hashMatch = lineText.match(/^(\s*)(#\.)(\s+)/);
                if (hashMatch) {
                    const indent = hashMatch[1];
                    const marker = hashMatch[2];
                    const space = hashMatch[3];
                    
                    const markerStart = line.from + indent.length;
                    const markerEnd = line.from + indent.length + marker.length + space.length;
                    
                    // Check if cursor is within the marker area
                    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
                    
                    // Add line decoration for proper styling
                    decorations.push({
                        from: line.from,
                        to: line.from,
                        decoration: Decoration.line({
                            class: 'HyperMD-list-line HyperMD-list-line-1',
                            attributes: {
                                style: 'text-indent: -29px; padding-inline-start: 29px;'
                            }
                        })
                    });
                    
                    // Only replace the marker if cursor is not within it
                    if (!cursorInMarker) {
                        decorations.push({
                            from: markerStart,
                            to: markerEnd,
                            decoration: Decoration.replace({
                                widget: new HashListMarkerWidget(hashCounter)
                            })
                        });
                    }
                    
                    // Wrap the rest of the line
                    decorations.push({
                        from: line.from + indent.length + marker.length + space.length,
                        to: line.to,
                        decoration: Decoration.mark({
                            class: 'cm-list-1'
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
                    
                    const markerStart = line.from + indent.length;
                    const markerEnd = line.from + indent.length + markerWithSpace.length;
                    
                    // Check if cursor is within the marker area
                    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
                    
                    // Add line decoration for proper styling
                    decorations.push({
                        from: line.from,
                        to: line.from,
                        decoration: Decoration.line({
                            class: 'HyperMD-list-line HyperMD-list-line-1',
                            attributes: {
                                style: `text-indent: -${markerWithSpace.length * 7}px; padding-inline-start: ${markerWithSpace.length * 7}px;`
                            }
                        })
                    });
                    
                    // Only replace the marker if cursor is not within it
                    if (!cursorInMarker) {
                        decorations.push({
                            from: markerStart,
                            to: markerEnd,
                            decoration: Decoration.replace({
                                widget: new FancyListMarkerWidget(markerWithSpace, 'fancy')
                            })
                        });
                    }
                    
                    // Wrap the rest of the line
                    decorations.push({
                        from: line.from + indent.length + markerWithSpace.length,
                        to: line.to,
                        decoration: Decoration.mark({
                            class: 'cm-list-1'
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
                    
                    const markerStart = line.from + indent.length;
                    const markerEnd = line.from + indent.length + fullMarker.length + space.length;
                    
                    // Check if cursor is within the marker area
                    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
                    
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
                    
                    // Add line decoration for proper styling
                    decorations.push({
                        from: line.from,
                        to: line.from,
                        decoration: Decoration.line({
                            class: 'HyperMD-list-line HyperMD-list-line-1',
                            attributes: {
                                style: 'text-indent: -29px; padding-inline-start: 29px;'
                            }
                        })
                    });
                    
                    // Only replace the marker if cursor is not within it
                    if (!cursorInMarker) {
                        decorations.push({
                            from: markerStart,
                            to: markerEnd,
                            decoration: Decoration.replace({
                                widget: new ExampleListMarkerWidget(exampleNumber)
                            })
                        });
                    }
                    
                    // Wrap the rest of the line
                    decorations.push({
                        from: line.from + indent.length + fullMarker.length + space.length,
                        to: line.to,
                        decoration: Decoration.mark({
                            class: 'cm-list-1'
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
                    
                    const markerStart = line.from + indent.length;
                    const markerEnd = line.from + indent.length + marker.length + space.length;
                    
                    // Check if cursor is within the marker area
                    const cursorInMarker = cursorPos >= markerStart && cursorPos < markerEnd;
                    
                    // Only replace the marker if cursor is not within it
                    if (!cursorInMarker) {
                        decorations.push({
                            from: markerStart,
                            to: markerEnd,
                            decoration: Decoration.replace({
                                widget: new DefinitionBulletWidget()
                            })
                        });
                    }
                    continue; // Skip term check for definition lines
                }
                
                // Check for definition terms - now with support for empty line after term
                if (lineText.trim() && !lineText.match(/^(\s*)[~:]\s+/)) {
                    // Check next non-empty line (may be 1 or 2 lines away)
                    let isDefinitionTerm = false;
                    for (let offset = 1; offset <= 2 && line.number + offset <= view.state.doc.lines; offset++) {
                        const checkLine = view.state.doc.line(line.number + offset);
                        const checkText = checkLine.text;
                        if (checkText.match(/^(\s*)[~:]\s+/)) {
                            isDefinitionTerm = true;
                            break;
                        } else if (checkText.trim() && offset === 1) {
                            // If the immediate next line is non-empty and not a definition, stop checking
                            break;
                        }
                    }
                    
                    if (isDefinitionTerm) {
                        decorations.push({
                            from: line.from,
                            to: line.to,
                            decoration: Decoration.mark({
                                class: 'cm-strong cm-pandoc-definition-term'
                            })
                        });
                    }
                }
                
                // Process example references inline
                const refRegex = /\(@([a-zA-Z0-9_-]+)\)/g;
                let match;
                while ((match = refRegex.exec(lineText)) !== null) {
                    const label = match[1];
                    if (this.exampleLabels.has(label)) {
                        const refStart = line.from + match.index;
                        const refEnd = line.from + match.index + match[0].length;
                        
                        // Check if cursor is within this reference
                        const cursorInRef = cursorPos >= refStart && cursorPos <= refEnd;
                        
                        // Only replace if cursor is not within the reference
                        if (!cursorInRef) {
                            const number = this.exampleLabels.get(label)!;
                            decorations.push({
                                from: refStart,
                                to: refEnd,
                                decoration: Decoration.replace({
                                    widget: new ExampleReferenceWidget(number)
                                })
                            });
                        }
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
            '.cm-pandoc-definition-term': {
                textDecoration: 'underline'
            },
            '.pandoc-example-reference': {
                color: 'var(--text-accent)',
                cursor: 'pointer'
            },
            '.pandoc-example-reference:hover': {
                textDecoration: 'underline'
            }
        })
    ];
}