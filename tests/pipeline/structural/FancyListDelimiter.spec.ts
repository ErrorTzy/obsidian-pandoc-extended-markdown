import { FancyListMarkerWidget } from '../../../src/live-preview/widgets/listWidgets';

describe('FancyListMarkerWidget', () => {
    let widget: FancyListMarkerWidget;

    beforeEach(() => {
        // Create minimal DOM environment for testing
        global.document = {
            createElement: jest.fn((tagName: string) => {
                const element: any = {
                    tagName: tagName.toUpperCase(),
                    className: '',
                    textContent: '',
                    children: [],
                    appendChild: jest.fn(function(this: any, child: any) {
                        this.children.push(child);
                        return child;
                    }),
                    querySelector: jest.fn(function(this: any, selector: string) {
                        if (selector === '.list-number') {
                            return this.children.find((child: any) => 
                                child.className && child.className.includes('list-number')
                            );
                        }
                        return null;
                    }),
                    addEventListener: jest.fn()
                };
                return element;
            })
        } as any;
    });

    afterEach(() => {
        // Clean up
        delete (global as any).document;
    });

    describe('delimiter rendering', () => {
        it('should render dot delimiter for upper alpha lists', () => {
            widget = new FancyListMarkerWidget('A', '.', undefined, undefined);
            const element = widget.toDOM();
            const innerSpan = element.querySelector('.list-number');
            expect(innerSpan?.textContent).toBe('A. '); // Should include the dot and space
        });

        it('should render dot delimiter for lower alpha lists', () => {
            widget = new FancyListMarkerWidget('a', '.', undefined, undefined);
            const element = widget.toDOM();
            const innerSpan = element.querySelector('.list-number');
            expect(innerSpan?.textContent).toBe('a. '); // Should include the dot and space
        });

        it('should render parenthesis delimiter for lists with parentheses', () => {
            widget = new FancyListMarkerWidget('a', ')', undefined, undefined);
            const element = widget.toDOM();
            const innerSpan = element.querySelector('.list-number');
            expect(innerSpan?.textContent).toBe('a) '); // Should include the parenthesis and space
        });

        it('should render dot delimiter for upper roman lists', () => {
            widget = new FancyListMarkerWidget('I', '.', undefined, undefined);
            const element = widget.toDOM();
            const innerSpan = element.querySelector('.list-number');
            expect(innerSpan?.textContent).toBe('I. '); // Should include the dot and space
        });

        it('should render dot delimiter for lower roman lists', () => {
            widget = new FancyListMarkerWidget('i', '.', undefined, undefined);
            const element = widget.toDOM();
            const innerSpan = element.querySelector('.list-number');
            expect(innerSpan?.textContent).toBe('i. '); // Should include the dot and space
        });

        it('should render parenthesis delimiter for roman lists with parentheses', () => {
            widget = new FancyListMarkerWidget('i', ')', undefined, undefined);
            const element = widget.toDOM();
            const innerSpan = element.querySelector('.list-number');
            expect(innerSpan?.textContent).toBe('i) '); // Should include the parenthesis and space
        });
    });
});