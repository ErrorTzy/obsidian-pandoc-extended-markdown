/**
 * @jest-environment jsdom
 */

import { extractSectionLines, createTextNodeWalker, createSmartTextNodeWalker } from '../../../src/reading-mode/utils/domUtils';

// Mock obsidian module
jest.mock('obsidian', () => ({
    getSectionInfo: jest.fn((element: HTMLElement) => {
        // Return mock section info based on element attributes
        if (element.hasAttribute('data-section-text')) {
            return {
                text: element.getAttribute('data-section-text')
            };
        }
        return null;
    })
}));

describe('DOM Utilities', () => {
    describe('extractSectionLines', () => {
        it('should extract lines from section with valid section info', () => {
            // Create mock DOM structure
            document.body.innerHTML = `
                <div class="markdown-preview-section" data-section-text="Line 1\nLine 2\nLine 3">
                    <p id="test-element">Test content</p>
                </div>
            `;

            const element = document.getElementById('test-element') as HTMLElement;
            const lines = extractSectionLines(element);

            expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
        });

        it('should return null when element is not in a section', () => {
            document.body.innerHTML = `
                <div>
                    <p id="test-element">Test content</p>
                </div>
            `;

            const element = document.getElementById('test-element') as HTMLElement;
            const lines = extractSectionLines(element);

            expect(lines).toBeNull();
        });

        it('should return null when section info is not available', () => {
            document.body.innerHTML = `
                <div class="markdown-preview-section">
                    <p id="test-element">Test content</p>
                </div>
            `;

            const element = document.getElementById('test-element') as HTMLElement;
            const lines = extractSectionLines(element);

            expect(lines).toBeNull();
        });

        it('should handle empty text content', () => {
            document.body.innerHTML = `
                <div class="markdown-preview-section" data-section-text="">
                    <p id="test-element">Test content</p>
                </div>
            `;

            const element = document.getElementById('test-element') as HTMLElement;
            const lines = extractSectionLines(element);

            // Empty text should still split into an array with one empty string
            expect(lines).toEqual(['']);
        });
    });

    describe('createTextNodeWalker', () => {
        it('should create a walker that traverses text nodes', () => {
            document.body.innerHTML = `
                <div id="container">
                    Text 1
                    <span>Text 2</span>
                    Text 3
                    <div>Text 4</div>
                </div>
            `;

            const container = document.getElementById('container') as HTMLElement;
            const walker = createTextNodeWalker(container);
            const textContents: string[] = [];

            let node;
            while (node = walker.nextNode()) {
                if (node.textContent) {
                    textContents.push(node.textContent.trim());
                }
            }

            // Filter out empty strings from whitespace
            const nonEmptyTexts = textContents.filter(t => t.length > 0);
            expect(nonEmptyTexts).toEqual(['Text 1', 'Text 2', 'Text 3', 'Text 4']);
        });

        it('should apply custom filter when provided', () => {
            document.body.innerHTML = `
                <div id="container">
                    <span class="include">Include this</span>
                    <span class="exclude">Exclude this</span>
                    <span class="include">Include this too</span>
                </div>
            `;

            const container = document.getElementById('container') as HTMLElement;
            const walker = createTextNodeWalker(container, (node) => {
                const parent = node.parentElement;
                if (parent?.classList.contains('exclude')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            });

            const textContents: string[] = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent) {
                    textContents.push(node.textContent.trim());
                }
            }

            const nonEmptyTexts = textContents.filter(t => t.length > 0);
            expect(nonEmptyTexts).toEqual(['Include this', 'Include this too']);
        });

        it('should work with Element type as well as HTMLElement', () => {
            document.body.innerHTML = `<div id="container">Text content</div>`;

            const container = document.getElementById('container') as Element;
            const walker = createTextNodeWalker(container);

            let node = walker.nextNode();
            expect(node?.textContent).toBe('Text content');
        });
    });

    describe('createSmartTextNodeWalker', () => {
        it('should skip code blocks', () => {
            document.body.innerHTML = `
                <div id="container">
                    Regular text
                    <code>Code text</code>
                    More regular text
                </div>
            `;

            const container = document.getElementById('container') as HTMLElement;
            const walker = createSmartTextNodeWalker(container);
            const textContents: string[] = [];

            let node;
            while (node = walker.nextNode()) {
                if (node.textContent) {
                    textContents.push(node.textContent.trim());
                }
            }

            const nonEmptyTexts = textContents.filter(t => t.length > 0);
            expect(nonEmptyTexts).toEqual(['Regular text', 'More regular text']);
        });

        it('should skip math elements', () => {
            document.body.innerHTML = `
                <div id="container">
                    Regular text
                    <span class="cm-math">Math formula</span>
                    <div class="math">Another formula</div>
                    <mjx-container>MathJax content</mjx-container>
                    Final text
                </div>
            `;

            const container = document.getElementById('container') as HTMLElement;
            const walker = createSmartTextNodeWalker(container);
            const textContents: string[] = [];

            let node;
            while (node = walker.nextNode()) {
                if (node.textContent) {
                    textContents.push(node.textContent.trim());
                }
            }

            const nonEmptyTexts = textContents.filter(t => t.length > 0);
            expect(nonEmptyTexts).toEqual(['Regular text', 'Final text']);
        });

        it('should skip nested code and math elements', () => {
            document.body.innerHTML = `
                <div id="container">
                    Start text
                    <div>
                        <code>
                            <span>Nested code</span>
                        </code>
                    </div>
                    <div>
                        <span class="math">
                            <span>Nested math</span>
                        </span>
                    </div>
                    End text
                </div>
            `;

            const container = document.getElementById('container') as HTMLElement;
            const walker = createSmartTextNodeWalker(container);
            const textContents: string[] = [];

            let node;
            while (node = walker.nextNode()) {
                if (node.textContent) {
                    textContents.push(node.textContent.trim());
                }
            }

            const nonEmptyTexts = textContents.filter(t => t.length > 0);
            expect(nonEmptyTexts).toEqual(['Start text', 'End text']);
        });
    });
});