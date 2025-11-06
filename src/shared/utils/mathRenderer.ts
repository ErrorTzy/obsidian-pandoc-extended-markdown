import { MATH_SYMBOLS } from '../../core/constants';
import { ListPatterns } from '../patterns';

export function renderMathToText(mathContent: string): string {
    let rendered = mathContent;
    
    // Replace LaTeX commands with their Unicode equivalents
    for (const [latex, unicode] of Object.entries(MATH_SYMBOLS.LATEX_TO_UNICODE)) {
        rendered = rendered.replace(new RegExp(latex.replace(ListPatterns.BACKSLASH_ESCAPE, '\\\\'), 'g'), unicode);
    }
    
    // Remove remaining backslashes and spaces that were part of commands
    rendered = ListPatterns.cleanMathExpression(rendered);
    
    return rendered;
}

export function tokenizeMath(mathContent: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let i = 0;
    
    while (i < mathContent.length) {
        if (mathContent[i] === '\\') {
            // Start of a LaTeX command
            if (current) {
                tokens.push(current);
                current = '';
            }
            
            // Read the full command
            let command = '\\';
            i++;
            
            // Read command name (letters)
            while (i < mathContent.length && /[a-zA-Z]/.test(mathContent[i])) {
                command += mathContent[i];
                i++;
            }
            
            // Check if there's a trailing space that should be part of the command
            // This happens when the command is followed by non-letter characters
            if (i < mathContent.length && mathContent[i] === ' ') {
                // Only include space if command consists of letters (actual LaTeX command)
                if (command.length > 1) {
                    command += ' ';
                    i++;
                }
            }
            
            tokens.push(command);
        } else {
            current += mathContent[i];
            i++;
        }
    }
    
    if (current) {
        tokens.push(current);
    }
    
    return tokens;
}

export function truncateMathContent(mathContent: string, maxRenderedLength: number): string {
    // For complex math truncation, we'll render progressively and stop when we exceed the limit
    const tokens = tokenizeMath(mathContent);
    let result = '$';
    
    // Render all tokens together to get the actual formatted output
    let accumulatedTokens: string[] = [];
    
    for (const token of tokens) {
        // Test if adding this token would exceed the limit
        const testTokens = [...accumulatedTokens, token];
        const testLatex = testTokens.join('');
        const testRendered = renderMathToText(testLatex);
        
        if (testRendered.length <= maxRenderedLength) {
            accumulatedTokens.push(token);
        } else {
            // We've reached the limit
            break;
        }
    }
    
    // Build the result from accumulated tokens
    let latexContent = accumulatedTokens.join('');
    
    // Remove trailing spaces before closing the math expression
    // This is crucial for valid LaTeX syntax
    latexContent = latexContent.trimEnd();
    
    result += latexContent;
    
    // Close the math expression
    if (!result.endsWith('$')) {
        result += '$';
    }
    
    return result;
}

export function truncateMathAtLimit(
    mathBuffer: string,
    currentResult: string,
    remainingSpace: number
): string {
    if (remainingSpace > 1) {
        const truncatedMath = truncateMathContent(mathBuffer, remainingSpace - 1);
        return currentResult + truncatedMath.slice(1) + '…';
    } else if (currentResult.endsWith('$')) {
        return currentResult.slice(0, -1) + '…';
    } else {
        return currentResult + '…';
    }
}
