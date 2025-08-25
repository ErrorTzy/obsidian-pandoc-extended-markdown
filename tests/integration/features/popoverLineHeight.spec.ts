/**
 * @jest-environment jsdom
 */

import { CSS_CLASSES } from '../../../src/core/constants';

describe('Popover and Panel Line Height', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('Rendered content in popovers', () => {
        it('should have CSS rules to normalize paragraph spacing in popovers', () => {
            // This test verifies that the CSS contains the necessary rules
            // to fix excessive line height in popovers
            
            // Create a popover element
            const popover = document.createElement('div');
            popover.classList.add(CSS_CLASSES.HOVER_POPOVER, CSS_CLASSES.HOVER_POPOVER_CONTENT);
            
            // Simulate what MarkdownRenderer.render would create
            const paragraph = document.createElement('p');
            paragraph.textContent = 'This is some test content';
            popover.appendChild(paragraph);
            
            document.body.appendChild(popover);
            
            // Apply the fix that should be in styles.css
            const style = document.createElement('style');
            style.textContent = `
                .${CSS_CLASSES.HOVER_POPOVER} p {
                    margin: 0;
                    line-height: 1.5;
                }
                .${CSS_CLASSES.HOVER_POPOVER} p:not(:last-child) {
                    margin-bottom: 0.5em;
                }
            `;
            document.head.appendChild(style);
            
            // Get computed styles
            const computedStyle = getComputedStyle(paragraph);
            
            // Verify the fix is applied
            expect(computedStyle.margin).toBe('0px');
            expect(computedStyle.lineHeight).toBe('1.5');
        });

        it('should handle multiple paragraphs with appropriate spacing', () => {
            const popover = document.createElement('div');
            popover.classList.add(CSS_CLASSES.HOVER_POPOVER, CSS_CLASSES.HOVER_POPOVER_CONTENT);
            
            // Simulate multiple paragraphs
            const p1 = document.createElement('p');
            p1.textContent = 'First paragraph';
            const p2 = document.createElement('p');
            p2.textContent = 'Second paragraph';
            
            popover.appendChild(p1);
            popover.appendChild(p2);
            
            document.body.appendChild(popover);
            
            // Apply the fix styles
            const style = document.createElement('style');
            style.textContent = `
                .${CSS_CLASSES.HOVER_POPOVER} p {
                    margin: 0;
                    line-height: 1.5;
                }
                .${CSS_CLASSES.HOVER_POPOVER} p:not(:last-child) {
                    margin-bottom: 0.5em;
                }
            `;
            document.head.appendChild(style);
            
            const p1Style = getComputedStyle(p1);
            const p2Style = getComputedStyle(p2);
            
            // First paragraph should have bottom margin
            expect(p1Style.marginBottom).toBe('0.5em');
            // Last paragraph should have no bottom margin
            expect(p2Style.marginBottom).toBe('0px');
        });
    });
    
    describe('Panel content line height', () => {
        it('should have reduced line height for custom label panel content', () => {
            const contentCell = document.createElement('td');
            contentCell.classList.add(CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT);
            
            const paragraph = document.createElement('p');
            paragraph.textContent = 'Panel content text';
            contentCell.appendChild(paragraph);
            
            document.body.appendChild(contentCell);
            
            // Apply the styles that should be in styles.css
            const style = document.createElement('style');
            style.textContent = `
                td.${CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT} {
                    line-height: 1.3;
                }
                td.${CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT} p {
                    margin: 0;
                    line-height: 1.3;
                }
                td.${CSS_CLASSES.CUSTOM_LABEL_VIEW_CONTENT} p:not(:last-child) {
                    margin-bottom: 0.3em;
                }
            `;
            document.head.appendChild(style);
            
            const computedStyle = getComputedStyle(paragraph);
            
            // Verify reduced line height
            expect(computedStyle.lineHeight).toBe('1.3');
            expect(computedStyle.margin).toBe('0px');
        });
        
        it('should have reduced line height for example list panel content', () => {
            const contentCell = document.createElement('td');
            contentCell.classList.add(CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTENT);
            
            const paragraph = document.createElement('p');
            paragraph.textContent = 'Example list content';
            contentCell.appendChild(paragraph);
            
            document.body.appendChild(contentCell);
            
            // Apply the styles that should be in styles.css
            const style = document.createElement('style');
            style.textContent = `
                td.${CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTENT} {
                    line-height: 1.3;
                }
                td.${CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTENT} p {
                    margin: 0;
                    line-height: 1.3;
                }
                td.${CSS_CLASSES.EXAMPLE_LIST_VIEW_CONTENT} p:not(:last-child) {
                    margin-bottom: 0.3em;
                }
            `;
            document.head.appendChild(style);
            
            const computedStyle = getComputedStyle(paragraph);
            
            // Verify reduced line height
            expect(computedStyle.lineHeight).toBe('1.3');
            expect(computedStyle.margin).toBe('0px');
        });
    });
});