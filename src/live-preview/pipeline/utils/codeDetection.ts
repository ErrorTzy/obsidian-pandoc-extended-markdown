import { EditorState, Text } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { SyntaxNodeRef } from '@lezer/common';
import { CodeRegion } from '../../../shared/types/codeTypes';

/**
 * Detects code blocks, inline code, and math regions in a document
 * by leveraging the parsed CodeMirror syntax tree. This keeps detection
 * aligned with the editor's understanding of the document instead of
 * running separate text parsers that can drift over time.
 */
export function detectCodeRegions(state: EditorState): CodeRegion[] {
    const regions: CodeRegion[] = [];
    
    syntaxTree(state).iterate({
        enter: (node) => handleSyntaxNode(node, regions)
    });
    
    return sortRegions(regions);
}

const CODE_BLOCK_NODE_NAMES = new Set(['FencedCode', 'CodeBlock', 'IndentedCode']);
const INLINE_CODE_NODE_NAMES = new Set(['InlineCode']);

function handleSyntaxNode(node: SyntaxNodeRef, regions: CodeRegion[]): boolean | void {
    const nodeName = node.type.name;
    
    if (CODE_BLOCK_NODE_NAMES.has(nodeName)) {
        regions.push(createRegion(node.from, node.to, 'codeblock'));
        return false;
    }
    
    if (INLINE_CODE_NODE_NAMES.has(nodeName)) {
        regions.push(createRegion(node.from, node.to, 'inline-code'));
        return false;
    }
    
    if (isMathNode(nodeName)) {
        regions.push(createRegion(node.from, node.to, 'math'));
        return false;
    }
    
    return undefined;
}

function createRegion(from: number, to: number, type: CodeRegion['type']): CodeRegion {
    return { from, to, type };
}

function isMathNode(nodeName: string): boolean {
    // Obsidian adds Math/MathBlock/InlineMath nodes. Keep this generic to remain compatible.
    return nodeName.includes('Math');
}

function sortRegions(regions: CodeRegion[]): CodeRegion[] {
    return regions.sort((a, b) => {
        if (a.from === b.from) {
            return a.to - b.to;
        }
        return a.from - b.from;
    });
}


/**
 * Check if a line is entirely inside a code block (not inline code)
 */
export function isLineInCodeBlock(lineNumber: number, doc: Text, codeRegions: CodeRegion[]): boolean {
    const line = doc.line(lineNumber);
    
    // Only check code blocks, not inline code
    for (const region of codeRegions) {
        if (region.type === 'codeblock') {
            // Check if the entire line is within the code block
            if (line.from >= region.from && line.to <= region.to) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Check if a line is inside a code region (code block or inline code)
 * This is kept for backward compatibility but should be used carefully
 */
export function isLineInCodeRegion(lineNumber: number, doc: Text, codeRegions: CodeRegion[]): boolean {
    return isLineInCodeBlock(lineNumber, doc, codeRegions);
}

/**
 * Check if a position range is completely inside a code region
 */
export function isRangeCompletelyInCodeRegion(from: number, to: number, codeRegions: CodeRegion[]): boolean {
    for (const region of codeRegions) {
        // Check if the range is completely inside a code region
        if (from >= region.from && to <= region.to) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a position range overlaps with any code region
 */
export function isRangeInCodeRegion(from: number, to: number, codeRegions: CodeRegion[]): boolean {
    return isRangeCompletelyInCodeRegion(from, to, codeRegions);
}
