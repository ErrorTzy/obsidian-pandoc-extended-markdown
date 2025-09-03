import { UI_CONSTANTS } from '../../../core/constants';
import { renderMathToText, truncateMathAtLimit } from '../../../shared/utils/mathRenderer';
import { ListPatterns } from '../../../shared/patterns';

export function truncateLabel(label: string): string {
    // Truncate at max length, replace last character with ellipsis if longer
    if (label.length > UI_CONSTANTS.LABEL_MAX_LENGTH) {
        return label.slice(0, UI_CONSTANTS.LABEL_TRUNCATION_LENGTH) + '…';
    }
    return label;
}

export function truncateContent(content: string): string {
    // Truncate at max length, replace last character with ellipsis if longer
    if (content.length > UI_CONSTANTS.CONTENT_MAX_LENGTH) {
        return content.slice(0, UI_CONSTANTS.CONTENT_TRUNCATION_LENGTH) + '…';
    }
    return content;
}

export function truncateContentWithRendering(content: string, maxLength: number = UI_CONSTANTS.CONTENT_MAX_LENGTH): string {
    // If no math content, use simple truncation
    if (!content.includes('$')) {
        if (content.length > maxLength) {
            return content.slice(0, maxLength - 1) + '…';
        }
        return content;
    }

    const parseResult = parseContentWithMath(content, maxLength);
    // Always return the normalized result to ensure math spaces are cleaned up
    return parseResult.result;
}

interface ParseResult {
    result: string;
    truncated: boolean;
}

interface MathDelimiterResult {
    result: string;
    renderedLength: number;
    mathBuffer: string;
    inMath: boolean;
    shouldBreak: boolean;
}

interface CharacterResult {
    result: string;
    renderedLength: number;
    shouldBreak: boolean;
}

/**
 * Parses content containing LaTeX math expressions and truncates it based on rendered length.
 * Handles math delimiters ($...$) intelligently by calculating the actual rendered length
 * of math expressions rather than their raw LaTeX character count.
 * 
 * @param content - The content string containing potential math expressions
 * @returns ParseResult object with the processed result and truncation flag
 * @throws Does not throw exceptions - handles malformed math gracefully
 * @example
 * const result = parseContentWithMath('Text with $E=mc^2$ formula');
 * // Considers rendered length of math when truncating
 */
function parseContentWithMath(content: string, maxLength: number = UI_CONSTANTS.CONTENT_MAX_LENGTH): ParseResult {
    // First, normalize any math content with trailing spaces
    const normalizedContent = normalizeMathSpaces(content);
    
    // Initialize parsing state with max length
    const state = initializeParsingState(maxLength);
    
    // Process each character
    for (let i = 0; i < normalizedContent.length; i++) {
        const char = normalizedContent[i];
        const parseResult = processCharacter(char, state);
        
        if (parseResult.shouldBreak) {
            return { result: parseResult.result, truncated: true };
        }
    }
    
    // Handle unclosed math at end of string
    if (state.inMath) {
        return handleUnclosedMathWrapper(state);
    }
    
    return { result: state.result, truncated: false };
}

function normalizeMathSpaces(content: string): string {
    if (content.includes('$')) {
        return ListPatterns.cleanWhitespaceBeforeDollar(content);
    }
    return content;
}

interface ParsingState {
    renderedLength: number;
    result: string;
    inMath: boolean;
    mathBuffer: string;
    maxLength: number;
}

function initializeParsingState(maxLength: number = UI_CONSTANTS.CONTENT_MAX_LENGTH): ParsingState {
    return {
        renderedLength: 0,
        result: '',
        inMath: false,
        mathBuffer: '',
        maxLength: maxLength
    };
}

function processCharacter(char: string, state: ParsingState): { result: string; shouldBreak: boolean } {
    if (char === '$') {
        const mathResult = processMathDelimiter(
            state.inMath,
            state.mathBuffer,
            state.result,
            state.renderedLength,
            state.maxLength
        );
        
        // Update state
        state.result = mathResult.result;
        state.renderedLength = mathResult.renderedLength;
        state.mathBuffer = mathResult.mathBuffer;
        state.inMath = mathResult.inMath;
        
        return { result: mathResult.result, shouldBreak: mathResult.shouldBreak };
    } else if (state.inMath) {
        state.mathBuffer += char;
        return { result: state.result, shouldBreak: false };
    } else {
        const textResult = processRegularCharacter(char, state.result, state.renderedLength, state.maxLength);
        state.result = textResult.result;
        state.renderedLength = textResult.renderedLength;
        return { result: textResult.result, shouldBreak: textResult.shouldBreak };
    }
}

function handleUnclosedMathWrapper(state: ParsingState): ParseResult {
    const finalResult = handleUnclosedMath(state.mathBuffer, state.result, state.renderedLength, state.maxLength);
    return { result: finalResult.result, truncated: finalResult.truncated };
}

/**
 * Processes a math delimiter character ($) to handle transitions into and out of math mode.
 * When entering math mode, starts buffering LaTeX content. When exiting, renders the
 * buffered math and checks if it fits within the remaining length limit.
 * 
 * @param inMath - Whether currently inside a math expression
 * @param mathBuffer - Buffer containing accumulated LaTeX content
 * @param currentResult - The result string built so far
 * @param currentLength - Current rendered length of the result
 * @returns MathDelimiterResult with updated state and potential truncation
 * @throws Does not throw exceptions - handles invalid math expressions
 * @example
 * const result = processMathDelimiter(false, '', 'Text ', 5);
 * // Starts math mode and begins buffering LaTeX content
 */
function processMathDelimiter(
    inMath: boolean,
    mathBuffer: string,
    currentResult: string,
    currentLength: number,
    maxLength: number = UI_CONSTANTS.CONTENT_MAX_LENGTH
): MathDelimiterResult {
    if (inMath) {
        // End of math block - trim trailing spaces from math buffer
        const trimmedBuffer = mathBuffer.trimEnd();
        const renderedMath = renderMathToText(trimmedBuffer);
        const remainingSpace = maxLength - currentLength;
        
        if (renderedMath.length <= remainingSpace) {
            // Entire math fits
            return {
                result: currentResult + trimmedBuffer + '$',
                renderedLength: currentLength + renderedMath.length,
                mathBuffer: '',
                inMath: false,
                shouldBreak: false
            };
        } else {
            // Math doesn't fit, truncate
            const truncatedResult = truncateMathAtLimit(
                mathBuffer, 
                currentResult, 
                remainingSpace
            );
            return {
                result: truncatedResult,
                renderedLength: maxLength,
                mathBuffer: '',
                inMath: false,
                shouldBreak: true
            };
        }
    } else {
        // Start of math block
        return {
            result: currentResult + '$',
            renderedLength: currentLength,
            mathBuffer: '',
            inMath: true,
            shouldBreak: false
        };
    }
}

/**
 * Processes a regular (non-math) character and adds it to the result if within limits.
 * Appends the character if there's remaining space, otherwise truncates with ellipsis.
 * Each regular character contributes 1 to the rendered length.
 * 
 * @param char - The character to process and potentially add
 * @param currentResult - The result string built so far
 * @param currentLength - Current rendered length of the result
 * @returns CharacterResult with updated result and truncation decision
 * @throws Does not throw exceptions - handles all character inputs safely
 * @example
 * const result = processRegularCharacter('a', 'Hello ', 6);
 * // Adds 'a' if within limit, otherwise truncates with ellipsis
 */
function processRegularCharacter(
    char: string,
    currentResult: string,
    currentLength: number,
    maxLength: number = UI_CONSTANTS.CONTENT_MAX_LENGTH
): CharacterResult {
    if (currentLength < maxLength) {
        return {
            result: currentResult + char,
            renderedLength: currentLength + 1,
            shouldBreak: false
        };
    } else {
        // We've reached the limit
        const truncated = currentResult.length > 0 && !currentResult.endsWith('…') 
            ? currentResult.slice(0, -1) + '…' 
            : currentResult + '…';
        return {
            result: truncated,
            renderedLength: maxLength,
            shouldBreak: true
        };
    }
}

function handleUnclosedMath(
    mathBuffer: string,
    currentResult: string,
    currentLength: number,
    maxLength: number = UI_CONSTANTS.CONTENT_MAX_LENGTH
): ParseResult {
    const renderedMath = renderMathToText(mathBuffer);
    const remainingSpace = maxLength - currentLength;
    
    if (renderedMath.length <= remainingSpace) {
        // Math fits
        return {
            result: currentResult + mathBuffer.trimEnd() + '$',
            truncated: false
        };
    } else {
        // Math doesn't fit, truncate it
        const truncatedResult = truncateMathAtLimit(
            mathBuffer,
            currentResult,
            remainingSpace
        );
        return {
            result: truncatedResult,
            truncated: true
        };
    }
}