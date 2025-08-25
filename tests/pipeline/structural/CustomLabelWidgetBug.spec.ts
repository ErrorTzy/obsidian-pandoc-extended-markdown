import { CustomLabelInlineNumberWidget } from '../../../src/live-preview/widgets/customLabelWidget';

describe('CustomLabel Widget Type Bug', () => {
    it('CustomLabelInlineNumberWidget should accept string type for number parameter', () => {
        // The bug: CustomLabelInlineNumberWidget expects a string but is being passed a number
        // This test verifies the type mismatch issue
        
        const mockView = {} as any;
        
        // This should work - widget expects a string
        const widget1 = new CustomLabelInlineNumberWidget('1', mockView);
        expect(widget1).toBeDefined();
        
        // This is what's actually happening in CustomLabelProcessor.ts line 241
        // It passes a number, but the widget expects a string
        const numberValue = 1;
        // @ts-expect-error - This highlights the type mismatch
        const widget2 = new CustomLabelInlineNumberWidget(numberValue, mockView);
        
        // When toDOM is called, it tries to use this.number as a string
        const dom = widget2.toDOM();
        
        // The bug: textContent expects a string but gets a number
        // This causes the number to be converted to string incorrectly
        expect(dom.textContent).toBe('1'); // This might fail or behave unexpectedly
    });

    it('should demonstrate the label eating bug scenario', () => {
        // Simulating what happens with {::Alpha}
        const rawLabel = 'Alpha';
        const processedLabel = 'Alpha';
        
        // When cursor is outside, it shows (Alpha)
        // When cursor is inside, it should show {::Alpha}
        // But the bug causes it to show {::pha} instead
        
        // The issue is in how the widget replacements are calculated
        const markerStart = 0;
        const markerEnd = 9; // Length of "{::Alpha}"
        const CUSTOM_LABEL_PREFIX_LENGTH = 1; // Length of "{"
        
        // Opening bracket replacement: from 0 to 1
        const openBracketFrom = markerStart;
        const openBracketTo = markerStart + CUSTOM_LABEL_PREFIX_LENGTH;
        
        // Double colon replacement: from 1 to 3
        const colonStart = markerStart + CUSTOM_LABEL_PREFIX_LENGTH;
        const colonFrom = colonStart;
        const colonTo = colonStart + 2;
        
        // Label content: from 3 to 8
        const labelStart = colonStart + 2;
        const labelEnd = markerEnd - 1; // Exclude closing bracket
        
        // These positions should preserve the full text
        expect(openBracketTo).toBe(1);
        expect(colonTo).toBe(3);
        expect(labelEnd).toBe(8);
        
        // The total coverage should be the full marker
        expect(labelEnd + 1).toBe(markerEnd);
    });

    it('should demonstrate the placeholder label eating bug', () => {
        // Simulating what happens with {::P(#a)}
        const rawLabel = 'P(#a)';
        const processedLabel = 'P1';
        
        // The bug: When clicked, {::P(#a)} becomes {::}
        // This suggests the label content is being completely replaced/eaten
        
        const fullMarker = '{::P(#a)}';
        const markerStart = 0;
        const markerEnd = fullMarker.length;
        
        // When processing placeholders, the ranges need to be calculated correctly
        const CUSTOM_LABEL_PREFIX_LENGTH = 1; // "{"
        const colonStart = markerStart + CUSTOM_LABEL_PREFIX_LENGTH;
        const labelStart = colonStart + 2; // After "::"
        const labelEnd = markerEnd - 1; // Before "}"
        
        // The label content is from position 3 to 8
        expect(labelStart).toBe(3);
        expect(labelEnd).toBe(8);
        
        // The placeholder "(#a)" starts at position 4 within the label
        const placeholderIndexInLabel = rawLabel.indexOf('(#a)');
        const placeholderStart = labelStart + placeholderIndexInLabel;
        const placeholderEnd = placeholderStart + 4; // Length of "(#a)"
        
        expect(placeholderStart).toBe(4); // Position 4 in the full string
        expect(placeholderEnd).toBe(8);
        
        // When replacing the placeholder with a number widget,
        // we must ensure the replacement boundaries are correct
        // Otherwise, text gets eaten
    });
});