import { MarkdownPostProcessorContext } from 'obsidian';

import { applyUnorderedListMarkerClasses } from '../../../src/reading-mode/parsers/unorderedListMarkerParser';

describe('unordered list marker reading mode styles', () => {
    const createContext = (text: string): MarkdownPostProcessorContext => ({
        sourcePath: 'test.md',
        docId: 'test',
        frontmatter: null,
        addChild: jest.fn(),
        getSectionInfo: jest.fn(() => ({
            text,
            lineStart: 0,
            lineEnd: text.split('\n').length - 1
        }))
    } as unknown as MarkdownPostProcessorContext);

    it('maps source unordered markers to rendered list item classes', () => {
        const element = document.createElement('div');
        element.innerHTML = `
            <ul>
                <li>dash</li>
                <li>plus</li>
                <li>star</li>
            </ul>
        `;

        applyUnorderedListMarkerClasses(
            element,
            createContext('- dash\n+ plus\n* star')
        );

        const items = Array.from(element.querySelectorAll('li'));

        expect(items[0].classList.contains('pem-unordered-list-marker-dash')).toBe(true);
        expect(items[1].classList.contains('pem-unordered-list-marker-plus')).toBe(true);
        expect(items[2].classList.contains('pem-unordered-list-marker-star')).toBe(true);
    });

    it('does not assign unordered marker classes to ordered list items', () => {
        const element = document.createElement('div');
        element.innerHTML = `
            <ol>
                <li>ordered</li>
            </ol>
            <ul>
                <li>dash</li>
            </ul>
        `;

        applyUnorderedListMarkerClasses(
            element,
            createContext('1. ordered\n- dash')
        );

        const orderedItem = element.querySelector('ol > li') as HTMLElement;
        const unorderedItem = element.querySelector('ul > li') as HTMLElement;

        expect(orderedItem.classList.contains('pem-unordered-list-marker-dash')).toBe(false);
        expect(unorderedItem.classList.contains('pem-unordered-list-marker-dash')).toBe(true);
    });
});
