import { App, MarkdownPostProcessorContext, MarkdownRenderer } from 'obsidian';

import { processReadingMode } from '../../../src/reading-mode/processor';
import { processFencedDivs, scheduleFencedDivProcessing } from '../../../src/reading-mode/features/fenced-divs/processor';
import { waitForFencedDivRun } from '../../../src/reading-mode/features/fenced-divs/processingCoordinator';
import { CSS_CLASSES } from '../../../src/core/constants';
import { ProcessorConfig } from '../../../src/shared/types/processorConfig';

describe('fenced div reading mode rendering', () => {
    const docPath = 'fenced-div-reading-mode.md';

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

    const createConfig = (
        overrides: Partial<ProcessorConfig & { enableFencedDivs: boolean }> = {}
    ): ProcessorConfig & { enableFencedDivs: boolean } => ({
        strictLineBreaks: false,
        enableListsWithoutPrecedingBlankline: true,
        enableSuperSubscripts: false,
        enableCustomLabelLists: false,
        enableFencedDivs: true,
        enableFencedDivExtras: true,
        ...overrides
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders a Pandoc fenced div block and later @id citations', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.theorem #thm:pythagoras title="Theorem &"}</p>',
            '<p>For a right triangle, a^2^ + b^2^ = c^2^.</p>',
            '<p>:::</p>',
            '<p>See @thm:pythagoras for the result.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                '::: {.theorem #thm:pythagoras title="Theorem &"}',
                'For a right triangle, a^2^ + b^2^ = c^2^.',
                ':::',
                '',
                'See @thm:pythagoras for the result.'
            ].join('\n')),
            createConfig()
        );

        const fencedDiv = element.querySelector('.pem-fenced-div') as HTMLElement | null;
        expect(fencedDiv).toBeTruthy();
        expect(fencedDiv?.classList.contains('theorem')).toBe(true);
        expect(fencedDiv?.classList.contains('pem-fenced-div-theorem')).toBe(true);
        expect(fencedDiv?.dataset.pandocDivId).toBe('thm:pythagoras');
        expect(fencedDiv?.textContent).not.toContain('Theorem:');
        expect(fencedDiv?.textContent).toContain('For a right triangle');
        expect(fencedDiv?.textContent).not.toContain(':::');

        const title = fencedDiv?.querySelector(`.${CSS_CLASSES.FENCED_DIV_TITLE}`);
        expect(title?.textContent).toBe('Theorem 1');

        const reference = element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`) as HTMLElement | null;
        expect(reference?.dataset.pandocDivRef).toBe('thm:pythagoras');
        expect(reference?.textContent).toBe('Theorem 1');
        expect(element.textContent).not.toContain('@thm:pythagoras');
    });

    it('applies lists_without_preceding_blankline inside a fenced div without consuming content', () => {
        const source = [
            '::: note',
            'paragraph',
            '- parent',
            '  - CHILD_MUST_STAY',
            ':::',
            '',
            'AFTER_MUST_STAY'
        ].join('\n');
        const createElement = (): HTMLDivElement => {
            const element = document.createElement('div');
            element.innerHTML = [
                '<p>::: note</p>',
                '<p>paragraph</p>',
                '<ul><li>parent<ul><li>CHILD_MUST_STAY</li></ul></li></ul>',
                '<p>:::</p>',
                '<p class="after">AFTER_MUST_STAY</p>'
            ].join('');
            return element;
        };

        const strictElement = createElement();
        const strictAfter = strictElement.querySelector('.after');
        processReadingMode(
            strictElement,
            createContext(source),
            createConfig({ enableListsWithoutPrecedingBlankline: false })
        );

        const lenientElement = createElement();
        const lenientList = lenientElement.querySelector('ul');
        const lenientChild = lenientElement.querySelector('ul ul li');
        processReadingMode(lenientElement, createContext(source), createConfig());

        const strictDiv = strictElement.querySelector('.pem-fenced-div');
        const lenientDiv = lenientElement.querySelector('.pem-fenced-div');
        expect(strictDiv?.querySelectorAll('ul, ol')).toHaveLength(0);
        expect(strictDiv?.textContent).toContain('paragraph\n- parent\n  - CHILD_MUST_STAY');
        expect(lenientDiv?.querySelectorAll('ul')).toHaveLength(2);
        expect(Array.from(lenientDiv?.querySelectorAll('li') ?? []).map(item => item.textContent))
            .toEqual(['parentCHILD_MUST_STAY', 'CHILD_MUST_STAY']);
        expect(lenientDiv?.querySelector('.pem-fenced-div-content > ul')).toBe(lenientList);
        expect(lenientDiv?.querySelector('ul ul li')).toBe(lenientChild);
        expect(strictElement.querySelector('.after')).toBe(strictAfter);
        expect(strictDiv?.contains(strictAfter)).toBe(false);
        expect(strictElement.textContent).toContain('AFTER_MUST_STAY');
    });

    it('extracts a closing fence that Obsidian materializes inside a nested list item', () => {
        const source = [
            '::: note',
            'paragraph',
            '- parent',
            '  - CHILD_MUST_STAY',
            ':::',
            '',
            'AFTER_MUST_STAY'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: note<br>paragraph</p>',
            '<div class="el-ul"><ul><li>parent<ul>',
            '<li>CHILD_MUST_STAY<br>\n:::\n</li>',
            '</ul></li></ul></div>',
            '<p class="after">AFTER_MUST_STAY</p>'
        ].join('');
        const list = element.querySelector('.el-ul');
        const child = element.querySelector('ul ul li');
        const after = element.querySelector('.after');

        processFencedDivs(element, docPath, createConfig(), false, source);

        const fencedDiv = element.querySelector('.pem-fenced-div');
        expect(fencedDiv).not.toBeNull();
        expect(fencedDiv?.querySelector('.pem-fenced-div-content > .el-ul')).toBe(list);
        expect(fencedDiv?.querySelector('ul ul li')).toBe(child);
        expect(child?.textContent).toBe('CHILD_MUST_STAY');
        expect(fencedDiv?.textContent).not.toContain(':::');
        expect(element.querySelector('.after')).toBe(after);
        expect(fencedDiv?.contains(after)).toBe(false);
    });

    it('splits a native list at a captured closing without moving or recreating the outside tail', () => {
        const source = [
            '::: note', '- inside', '  - child', ':::', '- OUTSIDE_MUST_STAY'
        ].join('\n');
        const element = document.createElement('div');
        element.innerHTML = '<p>::: note</p><div class="el-ul"><ul>' +
            '<li class="inside">inside<ul><li class="child">child<br>:::</li></ul></li>' +
            '<li class="outside">OUTSIDE_MUST_STAY</li></ul></div>';
        const tailList = element.querySelector('ul');
        const inside = element.querySelector('.inside');
        const child = element.querySelector('.child');
        const outside = element.querySelector('.outside') as HTMLElement;
        const listener = jest.fn();
        outside.addEventListener('click', listener);

        processFencedDivs(element, docPath, createConfig(), false, source);

        const fencedDiv = element.querySelector('.pem-fenced-div');
        expect(fencedDiv?.querySelector('.inside')).toBe(inside);
        expect(fencedDiv?.querySelector('.child')).toBe(child);
        expect(child?.textContent).toBe('child');
        expect(fencedDiv?.textContent).not.toContain(':::');
        expect(fencedDiv?.contains(outside)).toBe(false);
        expect(Array.from(element.children).find(block => block.matches('.el-ul'))
            ?.querySelector('ul')).toBe(tailList);
        expect(outside.parentElement).toBe(tailList);
        outside.click();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('matches captured list closings against rendered inline source, retaining live links', async () => {
        const source = '::: note\n- [inside](https://example.test)\n  - child\n:::';
        const element = document.createElement('div');
        element.innerHTML = '<p>::: note</p><ul><li>' +
            '<a href="https://example.test">inside</a><ul><li>child<br>:::</li></ul></li></ul>';
        const link = element.querySelector('a');
        const child = element.querySelector('ul ul li');
        processReadingMode(element, createContext(source), createConfig(), {} as App);

        await new Promise(resolve => window.setTimeout(resolve, 100));

        expect(element.querySelector('.pem-fenced-div a')).toBe(link);
        expect(element.querySelector('.pem-fenced-div ul ul li')).toBe(child);
        expect(child?.textContent).toBe('child');
        expect(element.querySelector('.pem-fenced-div')?.textContent).not.toContain(':::');
    });

    it('finishes section assembly before releasing dependent list processors', async () => {
        const source = '::: note\n- inside\n:::';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>::: note</p><ul><li>inside<br>:::</li></ul>';

        processReadingMode(section, createContext(source), createConfig(), {} as App);
        await waitForFencedDivRun(section);

        expect(section.querySelector('.pem-fenced-div li')?.textContent).toBe('inside');
        expect(section.querySelector('.pem-fenced-div')?.textContent).not.toContain(':::');
    });

    it('uses host inline extensions when checking a captured source prefix', async () => {
        const source = '::: note\n- CUSTOM_INLINE_SOURCE\n  - child\n:::';
        const section = document.createElement('div');
        section.innerHTML = '<p>::: note</p><ul><li><span>host-rendered value</span>' +
            '<ul><li>child<br>:::</li></ul></li></ul>';
        const liveInline = section.querySelector('span');
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const implementation = renderMock.getMockImplementation();
        renderMock.mockImplementationOnce(async (...args: unknown[]) => {
            await implementation?.(...args);
            const target = args[2] as HTMLElement;
            target.innerHTML = target.innerHTML.replace('CUSTOM_INLINE_SOURCE', 'host-rendered value');
        });

        processReadingMode(section, createContext(source), createConfig(), {} as App);
        await waitForFencedDivRun(section);

        expect(section.querySelector('.pem-fenced-div span')).toBe(liveInline);
        expect(section.querySelector('.pem-fenced-div ul ul li')?.textContent).toBe('child');
    });

    it('does not remove a captured closing when source content is repeated or reordered', async () => {
        const source = '::: note\n- first\n  - second\n:::';
        const section = document.createElement('div');
        section.innerHTML = '<p>::: note</p><ul><li>second<ul><li>first first<br>:::</li></ul></li></ul>';
        const list = section.querySelector('ul');
        const before = list?.innerHTML;

        processReadingMode(section, createContext(source), createConfig({
            enableUnorderedListMarkerStyles: false
        }), {} as App);
        await waitForFencedDivRun(section);

        expect(section.querySelector('ul')).toBe(list);
        expect(list?.innerHTML).toBe(before);
    });

    it('revalidates the captured DOM prefix after awaiting its source renderer', async () => {
        const source = '::: note\n- [inside](https://example.test)\n  - child\n:::';
        const section = document.createElement('div');
        section.innerHTML = '<p>::: note</p><ul><li><a href="https://example.test">inside</a>' +
            '<ul><li>child<br>:::</li></ul></li></ul>';
        const list = section.querySelector('ul');
        const liveLink = section.querySelector('a')!;
        const renderMock = MarkdownRenderer.render as jest.Mock;
        const implementation = renderMock.getMockImplementation();
        let releaseRender: () => void = () => undefined;
        let signalStarted: () => void = () => undefined;
        const started = new Promise<void>(resolve => { signalStarted = resolve; });
        const gate = new Promise<void>(resolve => { releaseRender = resolve; });
        renderMock.mockImplementationOnce(async (...args: unknown[]) => {
            signalStarted();
            await gate;
            return implementation?.(...args);
        });

        processReadingMode(section, createContext(source), createConfig({
            enableUnorderedListMarkerStyles: false
        }), {} as App);
        await started;
        liveLink.textContent = 'NEW_CONTENT_MUST_STAY';
        const before = list?.innerHTML;
        releaseRender();
        await waitForFencedDivRun(section);

        expect(section.querySelector('ul')).toBe(list);
        expect(list?.innerHTML).toBe(before);
        expect(section.querySelector('a')).toBe(liveLink);
    });

    it('cancels stale section assembly before mutating its DOM', async () => {
        const source = '::: note\n- inside\n:::';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>::: note</p><ul><li>inside<br>:::</li></ul>';
        const before = section.innerHTML;
        let current = true;
        const assembly = scheduleFencedDivProcessing(section, docPath, createConfig(), source, {
            isCurrent: () => current
        });
        current = false;

        await assembly;

        expect(section.innerHTML).toBe(before);
    });

    it('settles a superseded section schedule without losing the replacement assembly', async () => {
        const source = '::: note\n- inside\n:::';
        const section = document.createElement('div');
        section.className = 'markdown-preview-section';
        section.innerHTML = '<p>::: note</p><ul><li>inside<br>:::</li></ul>';
        const superseded = scheduleFencedDivProcessing(section, docPath, createConfig(), source);
        const active = scheduleFencedDivProcessing(section, docPath, createConfig(), source);

        await Promise.all([superseded, active]);

        expect(section.querySelectorAll('.pem-fenced-div')).toHaveLength(1);
        expect(section.querySelector('.pem-fenced-div li')?.textContent).toBe('inside');
    });

    it('renders adjacent and nested fenced divs without leaking fence markers', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.outer #outer title="Outer &"}</p>',
            '<p>Outer opening content.</p>',
            '<p>::: {.inner #inner title="Inner &"}</p>',
            '<p>Nested content.</p>',
            '<p>:::</p>',
            '<p>::: {.warning #warn title="Warning &"}</p>',
            '<p>Sibling warning.</p>',
            '<p>:::</p>',
            '<p>:::</p>',
            '<p>Refs @outer @inner @warn.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                '::: {.outer #outer title="Outer &"}',
                'Outer opening content.',
                '',
                '::: {.inner #inner title="Inner &"}',
                'Nested content.',
                ':::',
                '::: {.warning #warn title="Warning &"}',
                'Sibling warning.',
                ':::',
                ':::',
                '',
                'Refs @outer @inner @warn.'
            ].join('\n')),
            createConfig()
        );

        const blocks = Array.from(element.querySelectorAll('.pem-fenced-div'));
        expect(blocks).toHaveLength(3);
        expect(blocks[0].querySelector(':scope > .pem-fenced-div-content > .pem-fenced-div .pem-fenced-div-title')?.textContent).toBe('Inner 1');
        expect(blocks.map(block => block.querySelector('.pem-fenced-div-title')?.textContent)).toEqual([
            'Outer 1',
            'Inner 1',
            'Warning 1'
        ]);
        expect(element.textContent).not.toContain(':::');

        const references = Array.from(
            element.querySelectorAll(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)
        ).map(reference => reference.textContent);
        expect(references).toEqual(['Outer 1', 'Inner 1', 'Warning 1']);
        expect(element.textContent).not.toContain('@outer @inner @warn');
    });

    it('preserves rendered math nodes when splitting multiline fenced div paragraphs', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: title</p>',
            '<p>',
            'Plain content and <span class="math math-inline">inline math</span><br>',
            '<span class="math math-block">math block</span>Plain content and <span class="math math-inline">inline math</span><br>',
            '::: nested<br>',
            'Plain content and <span class="math math-inline is-loaded">nested inline math</span><br>',
            '<span class="math math-block is-loaded">nested block</span>Plain content and <span class="math math-inline is-loaded">nested inline math</span><br>',
            ':::<br>',
            ':::',
            '</p>'
        ].join('');
        const originalNestedInline = element.querySelector('.math-inline.is-loaded');
        const originalNestedBlock = element.querySelector('.math-block.is-loaded');

        processFencedDivs(element, docPath, createConfig());

        const fencedDiv = element.querySelector('.pem-fenced-div') as HTMLElement | null;
        const nestedFencedDiv = fencedDiv?.querySelector('.pem-fenced-div-inner') as HTMLElement | null;

        expect(fencedDiv).toBeTruthy();
        expect(nestedFencedDiv).toBeTruthy();
        expect(fencedDiv?.querySelectorAll('.math-inline')).toHaveLength(4);
        expect(fencedDiv?.querySelectorAll('.math-block')).toHaveLength(2);
        expect(nestedFencedDiv?.querySelectorAll('.math-inline')).toHaveLength(2);
        expect(nestedFencedDiv?.querySelectorAll('.math-block')).toHaveLength(1);
        expect(nestedFencedDiv?.querySelector('.math-inline.is-loaded')).toBe(originalNestedInline);
        expect(nestedFencedDiv?.querySelector('.math-block.is-loaded')).toBe(originalNestedBlock);
        expect(element.textContent).not.toContain(':::');
    });

    it('renders readable shorthand and later @id citations when readable shorthand is enabled', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: Theorem #thm title="Theorem &" data=1</p>',
            '<p>Readable content.</p>',
            '<p>:::</p>',
            '<p>See @thm.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: Theorem #thm title="Theorem &" data=1\nReadable content.\n:::\n\nSee @thm.'),
            createConfig()
        );

        const fencedDiv = element.querySelector('.pem-fenced-div') as HTMLElement | null;
        expect(fencedDiv?.dataset.pandocDivId).toBe('thm');
        expect(fencedDiv?.querySelector('.pem-fenced-div-title')?.textContent).toBe('Theorem 1');
        const reference = element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`) as HTMLElement | null;
        expect(reference?.dataset.pandocDivRef).toBe('thm');
        expect(reference?.textContent).toBe('Theorem 1');
        expect(element.textContent).not.toContain('@thm');
    });

    it('adds every source class and prefixed CSS hook to rendered reading-mode blocks', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.class1 .class2 #native}</p>',
            '<p>Native content.</p>',
            '<p>:::</p>',
            '<p>::: class3 class4 #readable</p>',
            '<p>Readable content.</p>',
            '<p>:::</p>',
            '<p>::: Case & accent #placeholder</p>',
            '<p>Placeholder content.</p>',
            '<p>:::</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                '::: {.class1 .class2 #native}',
                'Native content.',
                ':::',
                '',
                '::: class3 class4 #readable',
                'Readable content.',
                ':::',
                '',
                '::: Case & accent #placeholder',
                'Placeholder content.',
                ':::'
            ].join('\n')),
            createConfig()
        );

        const blocks = Array.from(element.querySelectorAll('.pem-fenced-div')) as HTMLElement[];

        expect(blocks).toHaveLength(3);
        expect(blocks[0].classList.contains('class1')).toBe(true);
        expect(blocks[0].classList.contains('class2')).toBe(true);
        expect(blocks[0].classList.contains('pem-fenced-div-class1')).toBe(true);
        expect(blocks[0].classList.contains('pem-fenced-div-class2')).toBe(true);
        expect(blocks[1].classList.contains('class3')).toBe(true);
        expect(blocks[1].classList.contains('class4')).toBe(true);
        expect(blocks[1].classList.contains('pem-fenced-div-class3')).toBe(true);
        expect(blocks[1].classList.contains('pem-fenced-div-class4')).toBe(true);
        expect(blocks[2].classList.contains('Case')).toBe(true);
        expect(blocks[2].classList.contains('&')).toBe(true);
        expect(blocks[2].classList.contains('accent')).toBe(true);
        expect(blocks[2].classList.contains('pem-fenced-div-case')).toBe(true);
        expect(blocks[2].classList.contains('pem-fenced-div-accent')).toBe(true);
        expect(blocks[2].classList.contains('pem-fenced-div-&')).toBe(false);
    });

    it('renders explicit title shorthand and later @id citations when readable shorthand is enabled', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.logic #logic:a} explicit title after attributes &</p>',
            '<p>Readable content.</p>',
            '<p>:::</p>',
            '<p>::: explicit title before attributes & {.logic #logic:b}</p>',
            '<p>More readable content.</p>',
            '<p>:::</p>',
            '<p>See @logic:a and @logic:b.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                '::: {.logic #logic:a} explicit title after attributes &',
                'Readable content.',
                ':::',
                '::: explicit title before attributes & {.logic #logic:b}',
                'More readable content.',
                ':::',
                '',
                'See @logic:a and @logic:b.'
            ].join('\n')),
            createConfig()
        );

        const titles = Array.from(element.querySelectorAll('.pem-fenced-div-title'))
            .map(title => title.textContent);
        expect(titles).toEqual([
            'explicit title after attributes 1',
            'explicit title before attributes 1'
        ]);

        const references = Array.from(
            element.querySelectorAll(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)
        ).map(reference => reference.textContent);
        expect(references).toEqual([
            'explicit title after attributes 1',
            'explicit title before attributes 1'
        ]);
        expect(element.textContent).not.toContain('@logic:a');
        expect(element.textContent).not.toContain('@logic:b');
    });

    it('continues generated counters across reading-mode preview sections', () => {
        const preview = document.createElement('div');
        preview.className = 'markdown-preview-view';
        const firstSection = document.createElement('div');
        firstSection.className = 'markdown-preview-section';
        firstSection.innerHTML = [
            '<p>::: {.case title="Case &"}</p>',
            '<p>Top-level case.</p>',
            '<p>:::</p>',
            '<p>::: {.case title="Case &.&"}</p>',
            '<p>Nested case.</p>',
            '<p>:::</p>'
        ].join('');
        const secondSection = document.createElement('div');
        secondSection.className = 'markdown-preview-section';
        secondSection.innerHTML = [
            '<p>::: Case & {.case}</p>',
            '<p>Top-level case shortcut.</p>',
            '<p>:::</p>',
            '<p>::: Case &.& {.case}</p>',
            '<p>Nested case shortcut.</p>',
            '<p>:::</p>'
        ].join('');
        preview.append(firstSection, secondSection);
        document.body.appendChild(preview);

        processFencedDivs(firstSection, docPath, createConfig());
        processFencedDivs(secondSection, docPath, createConfig());

        const titles = Array.from(preview.querySelectorAll('.pem-fenced-div-title'))
            .map(title => title.textContent);

        expect(titles).toEqual([
            'Case 1',
            'Case 1.1',
            'Case 2',
            'Case 2.1'
        ]);
    });

    it('leaves readable shorthand untouched when readable shorthand is disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: Theorem #thm data=1</p>',
            '<p>Readable content.</p>',
            '<p>:::</p>',
            '<p>See @thm.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: Theorem #thm data=1\nReadable content.\n:::\n\nSee @thm.'),
            createConfig({ enableReadableFencedDivSyntax: false })
        );

        expect(element.querySelector('.pem-fenced-div')).toBeNull();
        expect(element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)).toBeNull();
        expect(element.textContent).toContain('::: Theorem #thm data=1');
    });

    it('renders Pandoc fenced div titles and references when readable shorthand is disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.theorem #thm title="Theorem &"}</p>',
            '<p>Strict content.</p>',
            '<p>:::</p>',
            '<p>See @thm.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: {.theorem #thm title="Theorem &"}\nStrict content.\n:::\n\nSee @thm.'),
            createConfig({ enableReadableFencedDivSyntax: false })
        );

        expect(element.querySelector('.pem-fenced-div')).not.toBeNull();
        expect(element.querySelector('.pem-fenced-div-title')?.textContent).toBe('Theorem 1');
        expect(element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)?.textContent).toBe('Theorem 1');
    });

    it('renders base fenced div blocks without generated titles or references when extras are disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.theorem #thm title="Theorem &"}</p>',
            '<p>Content.</p>',
            '<p>:::</p>',
            '<p>See @thm.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: {.theorem #thm title="Theorem &"}\nContent.\n:::\n\nSee @thm.'),
            createConfig({ enableFencedDivExtras: false })
        );

        expect(element.querySelector('.pem-fenced-div')).not.toBeNull();
        expect(element.querySelector('.pem-fenced-div-title')).toBeNull();
        expect(element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)).toBeNull();
        expect(element.textContent).toContain('See @thm.');
    });

    it('does not render fenced div openers that Pandoc keeps inside a paragraph', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>Paragraph before.</p>',
            '<p>::: {.note #invalid}</p>',
            '<p>Still paragraph text.</p>',
            '<p>:::</p>',
            '<p>::: {.note #valid}</p>',
            '<p>Actual div.</p>',
            '<p>:::</p>',
            '<p>See @invalid and @valid.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext([
                'Paragraph before.',
                '::: {.note #invalid}',
                'Still paragraph text.',
                ':::',
                '',
                '::: {.note #valid}',
                'Actual div.',
                ':::',
                '',
                'See @invalid and @valid.'
            ].join('\n')),
            createConfig()
        );

        const blocks = Array.from(element.querySelectorAll('.pem-fenced-div'));
        const references = Array.from(
            element.querySelectorAll(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)
        ).map(reference => reference.textContent);

        expect(blocks).toHaveLength(1);
        expect((blocks[0] as HTMLElement).dataset.pandocDivId).toBe('valid');
        expect(references).toEqual(['Note']);
        expect(element.textContent).toContain('::: {.note #invalid}');
        expect(element.textContent).toContain('@invalid');
    });

    it('uses source opening depth when a missed closing would otherwise nest later blocks', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: Overall Limit {}</p>',
            '<p>Limit equation.</p>',
            '<p>Formal definition.</p>',
            '<p>Game semantics paragraph.</p>',
            '<p>Let limits be defined.</p>',
            '<p>::: Addition law {}<br>Addition content.<br>:::</p>'
        ].join('');

        processFencedDivs(
            element,
            docPath,
            createConfig(),
            false,
            [
                '::: Overall Limit {}',
                '',
                'Limit equation.',
                '',
                'Formal definition.',
                '',
                'Game semantics paragraph.',
                ':::',
                '',
                '### Limit Laws',
                '',
                'Let limits be defined.',
                '',
                '::: Addition law {}',
                'Addition content.',
                ':::'
            ].join('\n')
        );

        const blocks = Array.from(element.querySelectorAll('.pem-fenced-div')) as HTMLElement[];
        const titles = blocks.map(block => block.querySelector('.pem-fenced-div-title')?.textContent);
        const parentIndices = blocks.map(block => {
            const parentBlock = block.parentElement?.closest('.pem-fenced-div') as HTMLElement | null;
            return parentBlock ? blocks.indexOf(parentBlock) : -1;
        });

        expect(titles).toEqual(['Overall Limit', 'Addition law']);
        expect(parentIndices).toEqual([-1, -1]);
        expect(blocks[0].textContent).toContain('Game semantics paragraph.');
        expect(blocks[0].textContent).not.toContain('Addition law');
        expect(element.textContent).toContain('Let limits be defined.');
    });

    it('closes a reading-mode fenced div when an Obsidian comment hides the closing marker', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: Title</p>',
            '<p>inside-title</p>',
            '<p>outside-title</p>',
            '<p>:::</p>',
            '<p>tail-text</p>'
        ].join('');

        processFencedDivs(
            element,
            docPath,
            createConfig(),
            false,
            [
                '::: Title',
                'inside-title',
                '%%',
                ':::',
                '%%',
                'outside-title',
                ':::',
                '',
                'tail-text'
            ].join('\n')
        );

        const blocks = Array.from(element.querySelectorAll('.pem-fenced-div')) as HTMLElement[];

        expect(blocks).toHaveLength(1);
        expect(blocks[0].textContent).toContain('inside-title');
        expect(blocks[0].textContent).not.toContain('outside-title');
        expect(element.textContent).toContain('outside-title');
        expect(element.textContent).toContain(':::');
        expect(element.textContent).toContain('tail-text');
    });

    it('leaves fenced div syntax untouched when the feature is disabled', () => {
        const element = document.createElement('div');
        element.innerHTML = [
            '<p>::: {.note #note}</p>',
            '<p>Body.</p>',
            '<p>:::</p>',
            '<p>See @note.</p>'
        ].join('');

        processReadingMode(
            element,
            createContext('::: {.note #note}\nBody.\n:::\n\nSee @note.'),
            createConfig({ enableFencedDivs: false })
        );

        expect(element.querySelector('.pem-fenced-div')).toBeNull();
        expect(element.querySelector(`.${CSS_CLASSES.FENCED_DIV_REFERENCE}`)).toBeNull();
        expect(element.textContent).toContain('::: {.note #note}');
        expect(element.textContent).toContain('@note');
    });
});
