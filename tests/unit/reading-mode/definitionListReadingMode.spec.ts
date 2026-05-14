import { MarkdownPostProcessorContext } from 'obsidian';

import { processReadingMode } from '../../../src/reading-mode/processor';
import { pluginStateManager } from '../../../src/core/state/pluginStateManager';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';

describe('definition list reading mode rendering', () => {
    const docPath = 'definition-list-test.md';
    let config: ProcessorConfig;

    const createContext = (text: string): MarkdownPostProcessorContext => ({
        sourcePath: docPath,
        docId: 'test',
        frontmatter: null,
        addChild: jest.fn(),
        getSectionInfo: jest.fn(() => ({
            text,
            lineStart: 0,
            lineEnd: text.split('\n').length - 1
        }))
    } as unknown as MarkdownPostProcessorContext);

    const directChildren = (element: HTMLElement, tagName: string): HTMLElement[] =>
        Array.from(element.children)
            .filter(child => child.tagName === tagName)
            .map(child => child as HTMLElement);

    beforeEach(() => {
        pluginStateManager.resetDocumentCounters(docPath);
        config = {
            strictLineBreaks: false,
            strictPandocMode: false,
            enableDefinitionLists: true,
            enableFencedDivs: false,
            enableSuperSubscripts: false,
            enableUnorderedListMarkerStyles: false
        };
    });

    afterEach(() => {
        pluginStateManager.clearAllStates();
        jest.useRealTimers();
    });

    it('renders each same-term definition line as its own dd', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: details1<br>: details2<br>: details3</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: details1\n: details2\n: details3'),
            config
        );

        const list = element.querySelector('dl.pem-definition-list') as HTMLElement;
        const terms = directChildren(list, 'DT');
        const definitions = directChildren(list, 'DD');

        expect(terms.map(term => term.textContent)).toEqual(['Description Term']);
        expect(definitions.map(def => def.textContent)).toEqual(['details1', 'details2', 'details3']);
        expect(definitions[0].textContent).toBe('details1');
    });

    it('does not normalize a fenced div opener as a definition term', () => {
        jest.useFakeTimers();
        config.enableFencedDivs = true;
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p"><p>::: title</p></div>
            <div class="el-p"><p>: text</p></div>
            <div class="el-p"><p>:::</p></div>
        `;

        processReadingMode(
            section,
            createContext('::: title\n: text\n:::'),
            config
        );
        jest.runOnlyPendingTimers();

        expect(section.querySelector('dl.pem-definition-list')).toBeNull();
        expect(section.textContent).toContain(': text');
        expect(section.textContent).not.toContain('• text');
    });

    it('keeps blank-line-separated terms in one definition list', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: details1<br><br>Another Term<br>: another detail1</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: details1\n\nAnother Term\n: another detail1'),
            config
        );

        const lists = element.querySelectorAll('dl.pem-definition-list');
        const list = lists[0] as HTMLElement;

        expect(lists).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term', 'Another Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'another detail1']);
    });

    it('renders nested list content inside a definition description', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: details1<br>: - bullet<br>    : indented</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: details1\n: - bullet\n    : indented'),
            config
        );

        const list = element.querySelector('dl.pem-definition-list') as HTMLElement;
        const definitions = directChildren(list, 'DD');
        const nestedList = definitions[1].querySelector('ul > li > dl') as HTMLElement;

        expect(definitions).toHaveLength(2);
        expect(definitions[0].textContent).toBe('details1');
        expect(nestedList.querySelector('dt')?.textContent).toBe('bullet');
        expect(nestedList.querySelector('dd')?.textContent).toBe('indented');
    });

    it('renders ordered and checked list descriptions as list content', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p>Description Term<br>: 1. ordered<br>: - [x] checked</p>';

        processReadingMode(
            element,
            createContext('Description Term\n: 1. ordered\n: - [x] checked'),
            config
        );

        const list = element.querySelector('dl.pem-definition-list') as HTMLElement;
        const definitions = directChildren(list, 'DD');
        const checkbox = definitions[1].querySelector('input[type="checkbox"]') as HTMLInputElement;

        expect(definitions[0].querySelector('ol > li')?.textContent).toBe('ordered');
        expect(checkbox.checked).toBe(true);
        expect(checkbox.disabled).toBe(true);
        expect(definitions[1].querySelector('ul > li')?.textContent).toBe(' checked');
    });

    it('rebuilds malformed existing definition list markup from source lines', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p>
                    <dl class="pem-definition-list">
                        <dt class="pem-definition-term">Description Termdetails1details2</dt>
                        <dd class="pem-list-definition-desc">details3</dd>
                    </dl>
                </p>
            </div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2\n: details3'),
            config
        );
        jest.runOnlyPendingTimers();

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;

        expect(section.querySelectorAll('dl.pem-definition-list')).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2', 'details3']);
    });

    it('preserves Obsidian block wrappers when rebuilding a definition list', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p>
                    <dl class="pem-definition-list">
                        <dt class="pem-definition-term">Description Termdetails1</dt>
                        <dd class="pem-list-definition-desc">details2</dd>
                    </dl>
                </p>
            </div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2'),
            config
        );
        jest.runOnlyPendingTimers();

        const wrapper = section.querySelector('.el-p') as HTMLElement;
        const list = wrapper.querySelector(':scope > dl.pem-definition-list') as HTMLElement;

        expect(wrapper).not.toBeNull();
        expect(list).not.toBeNull();
        expect(Array.from(section.children).map(child => child.className)).toEqual(['el-p']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2']);
    });

    it('rebuilds consecutive malformed definition lists as one dl from source lines', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Description Term</dt><dd>details1</dd></dl></p>
            </div>
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Another Term</dt><dd>another detail1</dd></dl></p>
            </div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n\nAnother Term\n: another detail1'),
            config
        );
        jest.runOnlyPendingTimers();

        const lists = section.querySelectorAll('dl.pem-definition-list');
        const list = lists[0] as HTMLElement;

        expect(lists).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term', 'Another Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'another detail1']);
    });

    it('preserves unrelated rendered siblings when rebuilding from source lines', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p"><p>Before paragraph</p></div>
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Description Termdetails1</dt><dd>details2</dd></dl></p>
            </div>
            <div class="el-p"><p>After paragraph</p></div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2'),
            config
        );
        jest.runOnlyPendingTimers();

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;

        expect(section.textContent).toContain('Before paragraph');
        expect(section.textContent).toContain('After paragraph');
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2']);
    });

    it('rebuilds a definition-list block without removing trailing text', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p">
                <p><dl class="pem-definition-list"><dt>Description Term</dt><dd>details1</dd></dl></p>
            </div>
            <div class="el-p"><p>: details2</p></div>
            <div class="el-p"><p>: details3</p></div>
            <div class="el-p"><p>random text...</p></div>
        `;

        processReadingMode(
            section,
            createContext('Description Term\n: details1\n: details2\n: details3\n\nrandom text...'),
            config
        );
        jest.runOnlyPendingTimers();

        const list = section.querySelector('dl.pem-definition-list') as HTMLElement;

        expect(section.textContent).toContain('random text...');
        expect(section.querySelectorAll('dl.pem-definition-list')).toHaveLength(1);
        expect(directChildren(list, 'DT').map(term => term.textContent))
            .toEqual(['Description Term']);
        expect(directChildren(list, 'DD').map(def => def.textContent))
            .toEqual(['details1', 'details2', 'details3']);
    });

    it('rebuilds separate definition-list blocks without consuming intervening text', () => {
        jest.useFakeTimers();
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = `
            <div class="el-p"><p>before text...</p></div>
            <div class="el-p"><p><dl class="pem-definition-list"><dt>First Term</dt><dd>first detail1</dd></dl></p></div>
            <div class="el-p"><p>: first detail2</p></div>
            <div class="el-p"><p>middle text...</p></div>
            <div class="el-p"><p><dl class="pem-definition-list"><dt>Second Term</dt><dd>second detail1</dd></dl></p></div>
            <div class="el-p"><p>after text...</p></div>
        `;

        processReadingMode(
            section,
            createContext(
                'before text...\n\nFirst Term\n: first detail1\n: first detail2\n\n' +
                'middle text...\n\nSecond Term\n: second detail1\n\nafter text...'
            ),
            config
        );
        jest.runOnlyPendingTimers();

        const lists = Array.from(section.querySelectorAll('dl.pem-definition-list')) as HTMLElement[];

        expect(section.textContent).toContain('before text...');
        expect(section.textContent).toContain('middle text...');
        expect(section.textContent).toContain('after text...');
        expect(lists).toHaveLength(2);
        expect(directChildren(lists[0], 'DD').map(def => def.textContent))
            .toEqual(['first detail1', 'first detail2']);
        expect(directChildren(lists[1], 'DD').map(def => def.textContent))
            .toEqual(['second detail1']);
    });
});
