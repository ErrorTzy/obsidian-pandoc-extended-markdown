/**
 * Reading Mode Parser
 * 
 * Responsible for parsing markdown text and identifying Pandoc extended syntax elements.
 * This module only identifies and parses - it does not modify DOM or manage state.
 */

import { ListPatterns } from '../../../shared/patterns';
import { ProcessorConfig } from '../../../shared/types/processorConfig';
import {
    isPluginOwnedOrderedListItem,
    resolveOrderedListLine
} from '../../../shared/utils/orderedListMarkers';
import {
    parseTaskCheckboxPrefix,
    TaskState
} from '../../../shared/utils/listContext';

import { parseFancyListMarker } from './fancyListMarker';
import { parseExampleListMarker } from './exampleListMarker';
import { parseDefinitionListMarker } from './definitionListMarker';

export interface ParsedLine {
    type: 'hash' | 'fancy' | 'example' | 'definition-term' | 'definition-item' | 'plain' | 'reference';
    content: string;
    metadata?: HashListData | FancyListData | ExampleListData | DefinitionData | ReferenceData;
    dataLine?: number;
}

interface TaskListData {
    taskState: TaskState;
    taskCharacter?: ' ' | 'x' | 'X';
}

export interface HashListData extends TaskListData {
    indent: string;
    marker: string;
    spacing: string;
    content: string;
}

export interface FancyListData extends TaskListData {
    type: string;
    marker: string;
    indent: string;
    content: string;
}

export interface ExampleListData extends TaskListData {
    indent: string;
    originalMarker: string;
    label?: string;
    content: string;
}

export interface DefinitionData {
    content: string;
    indent: string;
    marker: string;
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
    parseLine(
        line: string,
        context?: {
            nextLine?: string,
            isInParagraph?: boolean,
            isAtParagraphStart?: boolean,
            lines?: string[],
            lineIndex?: number,
            dataLine?: number
        },
        config?: ProcessorConfig
    ): ParsedLine {
        const hashMatch = config?.enableHashLists !== false
            ? ListPatterns.isHashList(line)
            : null;
        if (hashMatch) {
            const parsedContent = parseListContent(
                line,
                hashMatch[1].length + hashMatch[2].length
            );
            return {
                type: 'hash',
                content: line,
                dataLine: context?.dataLine,
                metadata: {
                    indent: hashMatch[1],
                    marker: hashMatch[2],
                    spacing: hashMatch[3],
                    ...parsedContent
                } as HashListData
            };
        }

        // Check for fancy list markers
        const orderedItem = config?.enableFancyLists !== false
            ? resolveOrderedListLine(line, context?.lines, context?.lineIndex, config)
            : null;
        const fancyMarker = orderedItem && isPluginOwnedOrderedListItem(orderedItem)
            ? {
                indent: orderedItem.indent,
                marker: orderedItem.markerText,
                type: getFancyTypeFromStyle(orderedItem.style),
                delimiter: orderedItem.delimiter,
                value: orderedItem.markerText.slice(0, -1)
            }
            : config?.enableFancyLists !== false
            ? parseFancyListMarker(line)
            : null;
        if (fancyMarker && fancyMarker.type !== 'hash') {
            const parsedContent = parseListContent(
                line,
                fancyMarker.indent.length + fancyMarker.marker.length
            );
            return {
                type: 'fancy',
                content: line,
                dataLine: context?.dataLine,
                metadata: {
                    type: fancyMarker.type,
                    marker: fancyMarker.marker,
                    indent: fancyMarker.indent,
                    ...parsedContent
                } as FancyListData
            };
        }

        // Check for example list markers (only in paragraphs)
        // Example lists should only be recognized at the start of a paragraph,
        // not after inline elements like <strong> tags
        if (config?.enableExampleLists !== false &&
            context?.isInParagraph &&
            context?.isAtParagraphStart !== false) {
            const exampleMarker = parseExampleListMarker(line);
            if (exampleMarker) {
                const parsedContent = parseListContent(
                    line,
                    exampleMarker.indent.length + exampleMarker.originalMarker.length
                );
                return {
                    type: 'example',
                    content: line,
                    dataLine: context?.dataLine,
                    metadata: {
                        indent: exampleMarker.indent,
                        originalMarker: exampleMarker.originalMarker,
                        label: exampleMarker.label,
                        ...parsedContent
                    } as ExampleListData
                };
            }
        }

        // Check for definition list markers
        const defMarker = config?.enableDefinitionLists !== false
            ? parseDefinitionListMarker(line)
            : null;
        if (defMarker && defMarker.type === 'definition' && context?.isAtParagraphStart !== false) {
            return {
                type: 'definition-item',
                content: line,
                metadata: {
                    content: defMarker.content,
                    indent: defMarker.indent,
                    marker: defMarker.marker
                } as DefinitionData
            };
        }

        // Check if this is a definition term (followed by definition marker)
        if (config?.enableDefinitionLists !== false &&
            line.trim().length > 0 &&
            context?.nextLine &&
            ListPatterns.isDefinitionMarker(context.nextLine)) {
            return {
                type: 'definition-term',
                content: line,
                metadata: {
                    content: line.trim(),
                    indent: '',
                    marker: ''
                } as DefinitionData
            };
        }

        // Check for example references
        const references = config?.enableExampleLists !== false
            ? this.findExampleReferences(line)
            : [];
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
    parseLines(
        lines: string[],
        isInParagraph: boolean = false,
        isAtParagraphStart: boolean = true,
        config?: ProcessorConfig,
        dataLines?: Array<number | undefined>
    ): ParsedLine[] {
        return lines.map((line, index) => {
            const nextLine = this.findNextNonBlankLine(lines, index + 1);
            // Only the first line is at paragraph start, unless there are explicit line breaks
            const isLineAtStart = index === 0 ? isAtParagraphStart : true;
            return this.parseLine(
                line,
                {
                    nextLine,
                    isInParagraph,
                    isAtParagraphStart: isLineAtStart,
                    lines,
                    lineIndex: index,
                    dataLine: dataLines?.[index]
                },
                config
            );
        });
    }

    private findNextNonBlankLine(lines: string[], startIndex: number): string | undefined {
        for (let index = startIndex; index < lines.length; index++) {
            if (lines[index].trim().length > 0) {
                return lines[index];
            }
        }

        return undefined;
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

function parseListContent(
    line: string,
    markerEnd: number
): Pick<TaskListData, 'taskState' | 'taskCharacter'> & { content: string } {
    const remainder = line.slice(markerEnd);
    const spacingMatch = remainder.match(/^(\s*)(.*)$/);
    const markerSpaces = spacingMatch?.[1] ?? '';
    const content = spacingMatch?.[2] ?? remainder;
    const taskPrefix = parseTaskCheckboxPrefix(markerSpaces, content);

    return {
        content: taskPrefix?.content ?? content,
        taskState: taskPrefix?.taskState ?? null,
        taskCharacter: taskPrefix?.sourceCharacter
    };
}

function getFancyTypeFromStyle(style: string): string {
    if (style.startsWith('decimal')) {
        return 'decimal';
    }

    const [caseName, family] = style.split('-');
    return `${caseName}-${family}`;
}
