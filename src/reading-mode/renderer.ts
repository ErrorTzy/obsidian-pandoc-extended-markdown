/**
 * Reading Mode Renderer
 * 
 * Responsible for creating DOM elements from parsed markdown.
 * This module only creates DOM - it does not parse or manage state.
 */

import { setTooltip } from 'obsidian';
import { ParsedLine, HashListData, FancyListData, ExampleListData, DefinitionData, ReferenceData } from './parsers/parser';
import { CSS_CLASSES, DECORATION_STYLES } from '../core/constants';
import { ListPatterns } from '../shared/patterns';

export interface RenderContext {
    strictLineBreaks: boolean;
    getExampleNumber?: (label: string) => number | undefined;
    getExampleContent?: (label: string) => string | undefined;
}

export class ReadingModeRenderer {
    /**
     * Render a parsed line to DOM elements
     */
    renderLine(
        parsedLine: ParsedLine, 
        context: RenderContext,
        lineNumber?: number
    ): (HTMLElement | Text)[] {
        switch (parsedLine.type) {
            case 'hash':
                return this.renderHashList(parsedLine.metadata as HashListData, lineNumber, context);
            
            case 'fancy':
                return this.renderFancyList(parsedLine.metadata as FancyListData, context);
            
            case 'example':
                return this.renderExampleList(parsedLine.metadata as ExampleListData, lineNumber, context);
            
            case 'definition-term':
                return this.renderDefinitionTerm(parsedLine.metadata as DefinitionData);
            
            case 'definition-item':
                return this.renderDefinitionItem(parsedLine.metadata as DefinitionData, context);
            
            case 'reference':
                return this.renderWithReferences(parsedLine.content, parsedLine.metadata as ReferenceData, context);
            
            default:
                return [document.createTextNode(parsedLine.content)];
        }
    }

    /**
     * Render multiple parsed lines with line breaks
     */
    renderLines(
        parsedLines: ParsedLine[], 
        context: RenderContext,
        numberProvider?: (type: string, index: number) => number
    ): (HTMLElement | Text)[] {
        const elements: (HTMLElement | Text)[] = [];

        for (let index = 0; index < parsedLines.length;) {
            const definitionList = this.renderDefinitionListAt(parsedLines, index, context);

            if (index > 0) {
                if (context.strictLineBreaks) {
                    elements.push(document.createElement('br'));
                }
                elements.push(document.createTextNode('\n'));
            }

            if (definitionList) {
                elements.push(definitionList.element);
                index = definitionList.nextIndex;
                continue;
            }

            const parsedLine = parsedLines[index];
            let lineNumber: number | undefined;
            if (numberProvider) {
                if (parsedLine.type === 'hash') {
                    lineNumber = numberProvider('hash', index);
                } else if (parsedLine.type === 'example') {
                    lineNumber = numberProvider('example', index);
                }
            }

            const lineElements = this.renderLine(parsedLine, context, lineNumber);
            elements.push(...lineElements);
            index++;
        }

        return elements;
    }

    /**
     * Render hash auto-numbering list
     */
    private renderHashList(data: HashListData, number?: number, context?: RenderContext): (HTMLElement | Text)[] {
        const elements: (HTMLElement | Text)[] = [];
        
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.FANCY_LIST}-hash`;
        span.textContent = `${number || '#'}. `;
        elements.push(span);
        
        if (data.content) {
            // Process content for references
            const contentElements = this.processContentForReferences(data.content, context);
            elements.push(...contentElements);
        }
        
        return elements;
    }

    /**
     * Render fancy list marker
     */
    private renderFancyList(data: FancyListData, context?: RenderContext): (HTMLElement | Text)[] {
        const elements: (HTMLElement | Text)[] = [];
        
        const span = document.createElement('span');
        span.className = `${CSS_CLASSES.FANCY_LIST}-${data.type}`;
        span.textContent = data.marker + ' ';
        elements.push(span);
        
        if (data.content) {
            // Process content for references
            const contentElements = this.processContentForReferences(data.content, context);
            elements.push(...contentElements);
        }
        
        return elements;
    }

    /**
     * Render example list
     */
    private renderExampleList(data: ExampleListData, number?: number, context?: RenderContext): (HTMLElement | Text)[] {
        const elements: (HTMLElement | Text)[] = [];
        
        const span = document.createElement('span');
        span.className = CSS_CLASSES.EXAMPLE_LIST;
        span.textContent = `(${number || '@'}) `;
        if (number) {
            span.dataset.exampleNumber = String(number);
        }
        elements.push(span);
        
        if (data.content) {
            // Process content for references
            const contentElements = this.processContentForReferences(data.content, context);
            elements.push(...contentElements);
        }
        
        return elements;
    }

    /**
     * Render definition term
     */
    private renderDefinitionTerm(data: DefinitionData): (HTMLElement | Text)[] {
        const strong = document.createElement('strong');
        const u = document.createElement('u');
        u.textContent = data.content;
        strong.appendChild(u);
        return [strong];
    }

    /**
     * Render definition item
     */
    private renderDefinitionItem(data: DefinitionData, context?: RenderContext): (HTMLElement | Text)[] {
        const elements: (HTMLElement | Text)[] = [];
        
        const span = document.createElement('span');
        span.textContent = '• ';
        elements.push(span);
        
        // Process content for references
        const contentElements = this.processContentForReferences(data.content, context);
        elements.push(...contentElements);
        
        return elements;
    }

    private renderDefinitionListAt(
        parsedLines: ParsedLine[],
        startIndex: number,
        context: RenderContext
    ): { element: HTMLElement, nextIndex: number } | null {
        if (parsedLines[startIndex]?.type !== 'definition-term') {
            return null;
        }

        const dl = document.createElement('dl');
        dl.className = CSS_CLASSES.DEFINITION_LIST;
        let index = startIndex;
        let renderedTerms = 0;

        while (this.canRenderDefinitionTerm(parsedLines, index)) {
            const term = parsedLines[index].metadata as DefinitionData;
            const dt = document.createElement('dt');
            dt.className = CSS_CLASSES.DEFINITION_TERM;
            this.appendContent(dt, term.content, context);
            dl.appendChild(dt);
            index++;

            while (parsedLines[index]?.type === 'definition-item') {
                const definition = parsedLines[index].metadata as DefinitionData;
                const dd = document.createElement('dd');
                dd.className = CSS_CLASSES.DEFINITION_DESC;
                this.appendContent(dd, definition.content, context);
                dl.appendChild(dd);
                index++;
            }

            renderedTerms++;
        }

        return renderedTerms > 0 ? { element: dl, nextIndex: index } : null;
    }

    private canRenderDefinitionTerm(parsedLines: ParsedLine[], index: number): boolean {
        return parsedLines[index]?.type === 'definition-term' &&
            parsedLines[index + 1]?.type === 'definition-item';
    }

    private appendContent(element: HTMLElement, content: string, context?: RenderContext): void {
        this.processContentForReferences(content, context).forEach(child => {
            element.appendChild(child);
        });
    }

    /**
     * Render text with example references
     */
    private renderWithReferences(
        text: string, 
        data: ReferenceData, 
        context: RenderContext
    ): (HTMLElement | Text)[] {
        const elements: (HTMLElement | Text)[] = [];
        let lastIndex = 0;

        data.references.forEach(ref => {
            // Add text before reference
            if (ref.startIndex > lastIndex) {
                elements.push(document.createTextNode(text.substring(lastIndex, ref.startIndex)));
            }

            // Get the example number if available
            const exampleNumber = context.getExampleNumber?.(ref.label);
            
            if (exampleNumber !== undefined) {
                const span = document.createElement('span');
                span.className = CSS_CLASSES.EXAMPLE_REF;
                span.textContent = `(${exampleNumber})`;
                
                // Add tooltip if content is available
                const tooltipText = context.getExampleContent?.(ref.label);
                if (tooltipText) {
                    setTooltip(span, tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
                }
                
                elements.push(span);
            } else {
                // Render as plain text if reference not found
                elements.push(document.createTextNode(ref.fullMatch));
            }

            lastIndex = ref.endIndex;
        });

        // Add remaining text
        if (lastIndex < text.length) {
            elements.push(document.createTextNode(text.substring(lastIndex)));
        }

        return elements;
    }

    /**
     * Create a line break element
     */
    createLineBreak(): HTMLElement {
        return document.createElement('br');
    }

    /**
     * Create a newline text node
     */
    createNewline(): Text {
        return document.createTextNode('\n');
    }

    /**
     * Process content text for references and return appropriate elements
     */
    private processContentForReferences(
        content: string,
        context?: RenderContext
    ): (HTMLElement | Text)[] {
        if (!context) {
            return [document.createTextNode(content)];
        }

        // Check for example references
        const references = ListPatterns.findExampleReferences(content);
        
        if (references.length === 0) {
            // Check for custom label references if needed
            const customRefs = ListPatterns.findCustomLabelReferences(content);
            if (customRefs.length === 0) {
                return [document.createTextNode(content)];
            }
            // For now, we'll just return the text as-is for custom label refs
            // since they need special processing in a separate pass
            return [document.createTextNode(content)];
        }

        // Process example references
        const elements: (HTMLElement | Text)[] = [];
        let lastIndex = 0;

        references.forEach(match => {
            const startIndex = match.index!;
            const endIndex = startIndex + match[0].length;
            const label = match[1];

            // Add text before reference
            if (startIndex > lastIndex) {
                elements.push(document.createTextNode(content.substring(lastIndex, startIndex)));
            }

            // Get the example number if available
            const exampleNumber = context.getExampleNumber?.(label);
            
            if (exampleNumber !== undefined) {
                const span = document.createElement('span');
                span.className = CSS_CLASSES.EXAMPLE_REF;
                span.textContent = `(${exampleNumber})`;
                
                // Add tooltip if content is available
                const tooltipText = context.getExampleContent?.(label);
                if (tooltipText) {
                    setTooltip(span, tooltipText, { delay: DECORATION_STYLES.TOOLTIP_DELAY_MS });
                }
                
                elements.push(span);
            } else {
                // Render as plain text if reference not found
                elements.push(document.createTextNode(match[0]));
            }

            lastIndex = endIndex;
        });

        // Add remaining text
        if (lastIndex < content.length) {
            elements.push(document.createTextNode(content.substring(lastIndex)));
        }

        return elements;
    }
}
