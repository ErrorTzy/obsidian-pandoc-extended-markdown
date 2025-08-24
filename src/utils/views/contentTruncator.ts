import { UI_CONSTANTS } from '../../constants';
import { renderMathToText, truncateMathAtLimit } from '../mathRenderer';

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

export function truncateContentWithRendering(content: string): string {
    // If no math content, use simple truncation
    if (!content.includes('$')) {
        return truncateContent(content);
    }

    const parseResult = parseContentWithMath(content);
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

function parseContentWithMath(content: string): ParseResult {
    // First, normalize any math content with trailing spaces
    const normalizedContent = normalizeMathSpaces(content);
    
    // Initialize parsing state
    const state = initializeParsingState();
    
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
        return content.replace(/\s+\$/g, '$');
    }
    return content;
}

interface ParsingState {
    renderedLength: number;
    result: string;
    inMath: boolean;
    mathBuffer: string;
}

function initializeParsingState(): ParsingState {
    return {
        renderedLength: 0,
        result: '',
        inMath: false,
        mathBuffer: ''
    };
}

function processCharacter(char: string, state: ParsingState): { result: string; shouldBreak: boolean } {
    if (char === '$') {
        const mathResult = processMathDelimiter(
            state.inMath,
            state.mathBuffer,
            state.result,
            state.renderedLength
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
        const textResult = processRegularCharacter(char, state.result, state.renderedLength);
        state.result = textResult.result;
        state.renderedLength = textResult.renderedLength;
        return { result: textResult.result, shouldBreak: textResult.shouldBreak };
    }
}

function handleUnclosedMathWrapper(state: ParsingState): ParseResult {
    const finalResult = handleUnclosedMath(state.mathBuffer, state.result, state.renderedLength);
    return { result: finalResult.result, truncated: finalResult.truncated };
}

function processMathDelimiter(
    inMath: boolean,
    mathBuffer: string,
    currentResult: string,
    currentLength: number
): MathDelimiterResult {
    if (inMath) {
        // End of math block - trim trailing spaces from math buffer
        const trimmedBuffer = mathBuffer.trimEnd();
        const renderedMath = renderMathToText(trimmedBuffer);
        const remainingSpace = UI_CONSTANTS.CONTENT_MAX_LENGTH - currentLength;
        
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
                renderedLength: UI_CONSTANTS.CONTENT_MAX_LENGTH,
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

function processRegularCharacter(
    char: string,
    currentResult: string,
    currentLength: number
): CharacterResult {
    if (currentLength < UI_CONSTANTS.CONTENT_MAX_LENGTH) {
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
            renderedLength: UI_CONSTANTS.CONTENT_MAX_LENGTH,
            shouldBreak: true
        };
    }
}

function handleUnclosedMath(
    mathBuffer: string,
    currentResult: string,
    currentLength: number
): ParseResult {
    const renderedMath = renderMathToText(mathBuffer);
    const remainingSpace = UI_CONSTANTS.CONTENT_MAX_LENGTH - currentLength;
    
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