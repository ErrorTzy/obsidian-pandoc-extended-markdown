import { DefinitionData, ParsedLine } from '../parsers/parser';

export interface DefinitionListBlock {
    lines: ParsedLine[];
    termTexts: string[];
    definitionTexts: string[];
    endIndex: number;
}

export function findDefinitionListBlocks(parsedLines: ParsedLine[]): DefinitionListBlock[] {
    const blocks: DefinitionListBlock[] = [];
    let index = 0;

    while (index < parsedLines.length) {
        const startIndex = findNextDefinitionBlockStart(parsedLines, index);
        if (startIndex === -1) {
            break;
        }

        const block = readDefinitionListBlock(parsedLines, startIndex);
        blocks.push(block);
        index = block.endIndex;
    }

    return blocks;
}

export function isStandaloneDefinitionList(
    parsedLines: ParsedLine[],
    blocks: DefinitionListBlock[] = findDefinitionListBlocks(parsedLines)
): boolean {
    const lines = parsedLines.filter(line => line.content.trim().length > 0);
    if (blocks.length !== 1) {
        return false;
    }

    const blockLineCount = blocks[0].lines
        .filter(line => line.content.trim().length > 0)
        .length;
    return blockLineCount === lines.length;
}

function findNextDefinitionBlockStart(parsedLines: ParsedLine[], startIndex: number): number {
    for (let index = startIndex; index < parsedLines.length; index++) {
        if (canStartDefinitionGroup(parsedLines, index)) {
            return index;
        }
    }

    return -1;
}

function readDefinitionListBlock(parsedLines: ParsedLine[], startIndex: number): DefinitionListBlock {
    const termTexts: string[] = [];
    const definitionTexts: string[] = [];
    let index = startIndex;
    let endIndex = startIndex;

    while (canStartDefinitionGroup(parsedLines, index)) {
        termTexts.push(getDefinitionContent(parsedLines[index]));
        endIndex = index + 1;
        index = nextNonBlankIndex(parsedLines, index + 1);

        while (parsedLines[index]?.type === 'definition-item') {
            definitionTexts.push(getDefinitionContent(parsedLines[index]));
            index++;
            endIndex = index;
        }

        const nextGroupIndex = nextNonBlankIndex(parsedLines, index);
        if (nextGroupIndex === index || !canStartDefinitionGroup(parsedLines, nextGroupIndex)) {
            break;
        }
        index = nextGroupIndex;
        endIndex = index;
    }

    return {
        lines: parsedLines.slice(startIndex, endIndex),
        termTexts,
        definitionTexts,
        endIndex
    };
}

function canStartDefinitionGroup(parsedLines: ParsedLine[], index: number): boolean {
    if (parsedLines[index]?.type !== 'definition-term') {
        return false;
    }

    return parsedLines[nextNonBlankIndex(parsedLines, index + 1)]?.type === 'definition-item';
}

function nextNonBlankIndex(parsedLines: ParsedLine[], startIndex: number): number {
    let index = startIndex;
    while (index < parsedLines.length && parsedLines[index].content.trim().length === 0) {
        index++;
    }
    return index;
}

function getDefinitionContent(parsedLine: ParsedLine): string {
    return (parsedLine.metadata as DefinitionData).content.trim();
}
