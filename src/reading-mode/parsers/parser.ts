/**
 * Reading Mode Parser
 * 
 * Responsible for parsing markdown text and identifying Pandoc extended syntax elements.
 * This module only identifies and parses - it does not modify DOM or manage state.
 */

import { ListPatterns } from '../../shared/patterns';

import { parseFancyListMarker } from './fancyListParser';
import { parseExampleListMarker } from './exampleListParser';
import { parseDefinitionListMarker } from './definitionListParser';

export interface ParsedLine {
    type: 'hash' | 'fancy' | 'example' | 'definition-term' | 'definition-item' | 'plain' | 'reference';
    content: string;
    metadata?: HashListData | FancyListData | ExampleListData | DefinitionData | ReferenceData;
}

export interface HashListData {
    indent: string;
    marker: string;
    spacing: string;
    content: string;
}

export interface FancyListData {
    type: string;
    marker: string;
    indent: string;
    content: string;
}

export interface ExampleListData {
    indent: string;
    originalMarker: string;
    label?: string;
    content: string;
}

export interface DefinitionData {
    content: string;
}

export interface ReferenceData {
    references: Array<{
        fullMatch: string;
        label: string;
        startIndex: number;
        endIndex: number;
    }>;
}

export class ReadingModeParser {
    /**
     * Parse a single line and identify its type and data
     */
    parseLine(line: string, context?: { nextLine?: string, isInParagraph?: boolean, isAtParagraphStart?: boolean }): ParsedLine {
        // Check for hash auto-numbering list
        const hashMatch = ListPatterns.isHashList(line);
        if (hashMatch) {
            return {
                type: 'hash',
                content: line,
                metadata: {
                    indent: hashMatch[1],
                    marker: hashMatch[2],
                    spacing: hashMatch[3],
                    content: line.substring(hashMatch[1].length + hashMatch[2].length + hashMatch[3].length)
                } as HashListData
            };
        }

        // Check for fancy list markers
        const fancyMarker = parseFancyListMarker(line);
        if (fancyMarker && fancyMarker.type !== 'hash') {
            return {
                type: 'fancy',
                content: line,
                metadata: {
                    type: fancyMarker.type,
                    marker: fancyMarker.marker,
                    indent: fancyMarker.indent,
                    content: line.substring(fancyMarker.indent.length + fancyMarker.marker.length + 1)
                } as FancyListData
            };
        }

        // Check for example list markers (only in paragraphs)
        // Example lists should only be recognized at the start of a paragraph,
        // not after inline elements like <strong> tags
        if (context?.isInParagraph && context?.isAtParagraphStart !== false) {
            const exampleMarker = parseExampleListMarker(line);
            if (exampleMarker) {
                const contentStart = exampleMarker.indent.length + exampleMarker.originalMarker.length + 1;
                return {
                    type: 'example',
                    content: line,
                    metadata: {
                        indent: exampleMarker.indent,
                        originalMarker: exampleMarker.originalMarker,
                        label: exampleMarker.label,
                        content: line.substring(contentStart)
                    } as ExampleListData
                };
            }
        }

        // Check for definition list markers
        const defMarker = parseDefinitionListMarker(line);
        if (defMarker && defMarker.type === 'definition') {
            return {
                type: 'definition-item',
                content: line,
                metadata: {
                    content: defMarker.content
                } as DefinitionData
            };
        }

        // Check if this is a definition term (followed by definition marker)
        if (context?.nextLine && ListPatterns.isDefinitionMarker(context.nextLine)) {
            return {
                type: 'definition-term',
                content: line,
                metadata: {
                    content: line.trim()
                } as DefinitionData
            };
        }

        // Check for example references
        const references = this.findExampleReferences(line);
        if (references.length > 0) {
            return {
                type: 'reference',
                content: line,
                metadata: {
                    references
                } as ReferenceData
            };
        }

        return {
            type: 'plain',
            content: line
        };
    }

    /**
     * Parse multiple lines with context
     */
    parseLines(lines: string[], isInParagraph: boolean = false, isAtParagraphStart: boolean = true): ParsedLine[] {
        return lines.map((line, index) => {
            const nextLine = index < lines.length - 1 ? lines[index + 1] : undefined;
            // Only the first line is at paragraph start, unless there are explicit line breaks
            const isLineAtStart = index === 0 ? isAtParagraphStart : true;
            return this.parseLine(line, { nextLine, isInParagraph, isAtParagraphStart: isLineAtStart });
        });
    }

    /**
     * Find example references in text
     */
    private findExampleReferences(text: string): ReferenceData['references'] {
        const references: ReferenceData['references'] = [];
        const regex = ListPatterns.EXAMPLE_REFERENCE;
        let match;

        while ((match = regex.exec(text)) !== null) {
            references.push({
                fullMatch: match[0],
                label: match[1],
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }

        return references;
    }

    /**
     * Check if strict validation should be applied
     */
    shouldValidateStrict(parsedLine: ParsedLine, lines: string[], currentLineIndex: number): boolean {
        if (parsedLine.type !== 'fancy') {
            return false;
        }

        // Additional validation logic can be added here
        return true;
    }
}