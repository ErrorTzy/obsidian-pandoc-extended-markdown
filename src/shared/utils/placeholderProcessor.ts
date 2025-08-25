/**
 * Processes placeholders in custom labels, replacing (#name) with sequential numbers.
 * Each unique placeholder name gets a unique number starting from 1.
 * 
 * @param label - The label containing placeholders
 * @returns The label with placeholders replaced by numbers
 */
import { ListPatterns } from '../patterns';

export function processPlaceholders(label: string): string {
    const placeholderMap = new Map<string, number>();
    let nextNumber = 1;
    
    return label.replace(ListPatterns.PLACEHOLDER_PATTERN, (match, name) => {
        if (!placeholderMap.has(name)) {
            placeholderMap.set(name, nextNumber++);
        }
        return placeholderMap.get(name)!.toString();
    });
}

/**
 * Manages placeholder numbering context for a document.
 * Tracks which placeholders have been assigned numbers and maintains consistency.
 */
export class PlaceholderContext {
    private placeholderMap = new Map<string, number>();
    private nextNumber = 1;
    private processedLabels = new Map<string, string>();
    private definedLabels = new Set<string>();  // Track which labels are actually defined
    
    /**
     * Process a label with placeholders, maintaining consistent numbering.
     * 
     * @param rawLabel - The raw label with placeholders
     * @returns The processed label with numbers
     */
    processLabel(rawLabel: string): string {
        // Check if we've already processed this exact label
        if (this.processedLabels.has(rawLabel)) {
            return this.processedLabels.get(rawLabel)!;
        }
        
        const processedLabel = rawLabel.replace(ListPatterns.PLACEHOLDER_PATTERN, (match, name) => {
            if (!this.placeholderMap.has(name)) {
                this.placeholderMap.set(name, this.nextNumber++);
            }
            return this.placeholderMap.get(name)!.toString();
        });
        
        this.processedLabels.set(rawLabel, processedLabel);
        this.definedLabels.add(processedLabel);  // Mark this label as defined
        return processedLabel;
    }
    
    /**
     * Get the number assigned to a placeholder name.
     * 
     * @param name - The placeholder name
     * @returns The assigned number, or null if not found
     */
    getPlaceholderNumber(name: string): number | null {
        return this.placeholderMap.get(name) || null;
    }
    
    /**
     * Get the processed version of a label without modifying state.
     * Used for references to existing labels.
     * 
     * A label reference is valid if:
     * 1. It doesn't contain placeholders and has been defined before, OR
     * 2. It contains placeholders that have all appeared in previous list labels
     * 
     * @param rawLabel - The raw label to look up
     * @returns The processed label if valid, null if invalid
     */
    getProcessedLabel(rawLabel: string): string | null {
        // If this exact label was defined, return its processed form
        if (this.processedLabels.has(rawLabel)) {
            return this.processedLabels.get(rawLabel)!;
        }
        
        // For references, only process if the placeholders have been seen before
        let allPlaceholdersKnown = true;
        
        // First check if all placeholders in this label are known
        const matches = [...rawLabel.matchAll(ListPatterns.PLACEHOLDER_PATTERN)];
        for (const match of matches) {
            if (!this.placeholderMap.has(match[1])) {
                allPlaceholdersKnown = false;
                break;
            }
        }
        
        // If not all placeholders are known, this is an undefined reference
        if (!allPlaceholdersKnown && matches.length > 0) {
            return null;
        }
        
        // Process the label with known placeholders
        const processedLabel = rawLabel.replace(ListPatterns.PLACEHOLDER_PATTERN, (match, name) => {
            return this.placeholderMap.get(name)?.toString() || match;
        });
        
        // For pure expressions (like "(#a)+(#b)"), they don't need to be defined
        // They're valid as long as all placeholders are known
        // But single letters without placeholders are NOT pure expressions - they're labels that need to be defined
        if (this.isPureExpression(rawLabel) && allPlaceholdersKnown && matches.length > 0) {
            return processedLabel;
        }
        
        // For partial matches (like P(#good)' when P(#good)''' is defined),
        // check if the base form exists in defined labels
        const baseProcessedLabel = this.getBaseLabel(processedLabel);
        for (const definedLabel of this.definedLabels) {
            if (definedLabel.startsWith(baseProcessedLabel)) {
                // This is a valid reference to a variation of a defined label
                return processedLabel;
            }
        }
        
        // Check if this exact processed label is defined
        if (!this.definedLabels.has(processedLabel)) {
            return null;  // This label was never defined
        }
        
        return processedLabel;
    }
    
    /**
     * Check if a label is a pure expression (contains only placeholders and operators).
     * Pure expressions like "(#a)+(#b)" or "P(#a),(#b)" are valid references without needing to be defined.
     * After removing placeholders, checks if remaining characters are only operators, spaces, and simple prefixes.
     * 
     * @param label - The label to check for pure expression pattern
     * @returns true if the label is a pure expression that doesn't need prior definition
     * @throws Does not throw exceptions - handles malformed input gracefully
     * @example
     * isPureExpression("P(#a),(#b)"); // returns true
     * isPureExpression("theorem1");   // returns false (needs definition)
     */
    private isPureExpression(label: string): boolean {
        // Remove all placeholders and see if we're left with only operators and spaces
        const withoutPlaceholders = label.replace(ListPatterns.PLACEHOLDER_PATTERN, '');
        // Check if remaining characters are only operators, spaces, primes, parentheses, commas, and simple prefixes
        // Allow single letter prefixes like "P" in "P(#a),(#b)"
        return ListPatterns.PURE_EXPRESSION_PATTERN.test(withoutPlaceholders);
    }
    
    /**
     * Get the base label without trailing primes or other modifiers.
     * Used to match variations like "P1'" against defined labels like "P1'''".
     * Enables partial matching of label references against their defined counterparts.
     * 
     * @param label - The label to extract base form from
     * @returns The base label with trailing primes/quotes removed
     * @throws Does not throw exceptions - handles all string input safely
     * @example
     * getBaseLabel("theorem1'''"); // returns "theorem1"
     * getBaseLabel("P1'");        // returns "P1"
     */
    private getBaseLabel(label: string): string {
        // Remove trailing primes (', '', ''', etc.)
        return ListPatterns.removeTrailingQuotes(label);
    }
    
    /**
     * Reset the context for a new document.
     */
    reset(): void {
        this.placeholderMap.clear();
        this.processedLabels.clear();
        this.definedLabels.clear();
        this.nextNumber = 1;
    }
    
    /**
     * Get the current placeholder mappings for debugging.
     */
    getPlaceholderMappings(): Map<string, number> {
        return new Map(this.placeholderMap);
    }
    
    /**
     * Check if a label is defined.
     */
    isLabelDefined(processedLabel: string): boolean {
        return this.definedLabels.has(processedLabel);
    }
}