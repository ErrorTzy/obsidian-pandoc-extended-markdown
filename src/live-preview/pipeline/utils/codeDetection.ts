import { EditorState, Text } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { CodeRegion } from '../../../shared/types/codeTypes';

/**
 * Detects code blocks, inline code, and math regions in a document
 */
export function detectCodeRegions(doc: Text, state: EditorState): CodeRegion[] {
    return detectCodeRegionsFromSyntaxTree(state, doc);
}

function detectCodeRegionsFromSyntaxTree(state: EditorState, doc: Text): CodeRegion[] {
    const regions: CodeRegion[] = [];
    const inlineCandidates: CodeRegion[] = [];
    const blockCandidates: CodeRegion[] = [];
    const mathCandidates: CodeRegion[] = [];
    const blockStarts: number[] = [];
    const blockEnds: number[] = [];
    
    const tree = ensureSyntaxTree(state, doc.length, 1000) ?? syntaxTree(state);
    
    tree.iterate({
        enter: node => {
            const name = node.type.name.toLowerCase();
            
            if (isInlineCodeNode(name)) {
                inlineCandidates.push({
                    from: node.from,
                    to: node.to,
                    type: 'inline-code'
                });
                return;
            }
            
            if (isMathNode(name)) {
                mathCandidates.push({
                    from: node.from,
                    to: node.to,
                    type: 'math'
                });
            }
            
            if (isCodeBlockStartNode(name)) {
                blockStarts.push(node.from);
            }
            
            if (isCodeBlockEndNode(name)) {
                blockEnds.push(node.to);
            }
            
            if (isCodeBlockNode(name)) {
                blockCandidates.push({
                    from: node.from,
                    to: node.to,
                    type: 'codeblock'
                });
            }
        }
    });
    
    const pairedBlocks = pairCodeBlockRegions(blockStarts, blockEnds, doc.length);
    const mergedBlocks = pairedBlocks.length > 0
        ? pairedBlocks
        : mergeRegions(blockCandidates, true);
    const expandedBlocks = expandRegionsToFullLines(mergedBlocks, doc);
    
    const inlineRegions = mergeRegions(inlineCandidates, false);
    const mathRegions = mergeRegions(mathCandidates, true);
    
    regions.push(...expandedBlocks);
    regions.push(...inlineRegions);
    regions.push(...mathRegions);
    
    return regions;
}

function isInlineCodeNode(name: string): boolean {
    return name.includes('inline-code') || name.includes('code_inline') || name.includes('inlinecode');
}

function isCodeBlockStartNode(name: string): boolean {
    return name.includes('codeblock-begin');
}

function isCodeBlockEndNode(name: string): boolean {
    return name.includes('codeblock-end');
}

function isCodeBlockNode(name: string): boolean {
    if (name.includes('inline-code')) {
        return false;
    }
    return (
        name.includes('codeblock') ||
        name.includes('code-block') ||
        name.includes('fenced') ||
        name.includes('hmd-codeblock')
    );
}

function isMathNode(name: string): boolean {
    return name.includes('math');
}

function pairCodeBlockRegions(starts: number[], ends: number[], docLength: number): CodeRegion[] {
    const regions: CodeRegion[] = [];
    const sortedStarts = [...starts].sort((a, b) => a - b);
    const sortedEnds = [...ends].sort((a, b) => a - b);
    let endIndex = 0;
    
    for (const start of sortedStarts) {
        while (endIndex < sortedEnds.length && sortedEnds[endIndex] <= start) {
            endIndex++;
        }
        if (endIndex < sortedEnds.length) {
            regions.push({
                from: start,
                to: sortedEnds[endIndex],
                type: 'codeblock'
            });
            endIndex++;
        } else {
            regions.push({
                from: start,
                to: docLength,
                type: 'codeblock'
            });
        }
    }
    
    return regions;
}

function mergeRegions(regions: CodeRegion[], mergeAdjacent: boolean): CodeRegion[] {
    if (regions.length === 0) {
        return regions;
    }
    
    const sorted = [...regions].sort((a, b) => a.from - b.from || a.to - b.to);
    const merged: CodeRegion[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];
        const overlaps = current.from <= (mergeAdjacent ? last.to : last.to - 1);
        
        if (current.type === last.type && overlaps) {
            last.to = Math.max(last.to, current.to);
        } else if (!(current.from === last.from && current.to === last.to && current.type === last.type)) {
            merged.push(current);
        }
    }
    
    return merged;
}

function expandRegionsToFullLines(regions: CodeRegion[], doc: Text): CodeRegion[] {
    return regions.map(region => {
        if (region.type !== 'codeblock') {
            return region;
        }
        const startLine = doc.lineAt(region.from);
        const endLine = doc.lineAt(Math.max(region.to - 1, region.from));
        return {
            ...region,
            from: startLine.from,
            to: endLine.to
        };
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
    if (from === to) return false;
    for (const region of codeRegions) {
        if (from < region.to && to > region.from) {
            return true;
        }
    }
    return false;
}
