import { execFileSync } from 'child_process';

import { findPandocDefinitionListBlocks } from '../../../src/reading-mode/features/definition-lists/sourceParser';
import { ListBlockValidator } from '../../../src/shared/utils/listBlockValidator';

function hasPandoc(): boolean {
    try {
        execFileSync('pandoc', ['--version'], { timeout: 3000, killSignal: 'SIGKILL' });
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

// Pandoc is an optional development oracle, never a runtime dependency. Run
// every case in an independent document: raw container state can span EOF.
const oracleDescribe = hasPandoc() ? describe : describe.skip;
interface NormalizedListItem {
    text: string;
    children: NormalizedListTopology[];
}

interface NormalizedListTopology {
    kind: 'bullet' | 'ordered';
    start: number | null;
    items: NormalizedListItem[];
}

interface NormalizedDefinitionList {
    items: NormalizedDefinitionItem[];
}

interface NormalizedDefinitionItem {
    term: string;
    definitions: string[];
}

const prefixes = [
    ['document start', ''],
    ['heading', '# h'],
    ['paragraph', 'Paragraph'],
    ['existing list', '- previous'],
    ['quote paragraph', '> Paragraph'],
    ['quoted list', '> - previous'],
    ['post-quote paragraph', '> - previous\n\n  continuation'],
    ['reference', '[ref]: /url'],
    ['multiline reference', '[ref]:\n  /url'],
    ['raw TeX command', '\\title{x}'],
    ['raw TeX whitespace continuation', '\\title{x}\n    continuation'],
    ['processing-instruction whitespace continuation', '<?pi?>\n    continuation'],
    ['raw HTML whitespace continuation', '<section>\n    continuation'],
    ['raw HTML subsequent paragraph', '<section>\n    first\n\n    continuation'],
    ['thematic break', '***'],
    ['setext heading', 'Heading\n==='],
    ['heading-like continuation', 'Paragraph\n# still paragraph'],
    ['pipe table', '| one | two |\n| --- | --- |'],
    ['HTML comment', '<!-- hidden -->'],
    ['native div', '<div>\ntext\n</div>'],
    ['native div indented code', '<div>\n    code\n</div>'],
    ['closed fenced div', '::: note\nparagraph\n:::'],
    ['closed code fence', 'Paragraph\n```\ncode\n```']
] as const;
const cases = prefixes.flatMap(([name, prefix]) =>
    ['- ', '1. ', 'A.  ', '#. '].flatMap(marker =>
        [false, true].map(enabled => ({ name, prefix, marker, enabled }))));

const quoteToRootCases = [
    ['bullet', '- ', '- '],
    ['decimal', '1. ', '2. '],
    ['upper alpha', 'A.  ', 'B.  '],
    ['default ordered', '#. ', '#. '],
    ['example ordered', '(@quoted) ', '(@target) ']
].flatMap(([name, quotedMarker, rootMarker]) =>
    [false, true].map(enabled => ({
        name,
        quotedMarker,
        rootMarker,
        enabled
    })));

oracleDescribe('list-spacing classifications against installed Pandoc', () => {
    it.each(cases)('$name, marker=$marker, extension=$enabled', ({ prefix, marker, enabled }) => {
        const lines = [
            ...(prefix ? prefix.split('\n') : []),
            `${marker}PANDOC_TARGET`,
            '    - PANDOC_CHILD'
        ];
        const ast: unknown = JSON.parse(execFileSync('pandoc', [
            '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
            '-t', 'json'
        ], {
            input: lines.join('\n'),
            encoding: 'utf8',
            timeout: 3000,
            killSignal: 'SIGKILL'
        }));
        const actual = ListBlockValidator.validateListBlocks(lines, {
            enableListsWithoutPrecedingBlankline: enabled
        });
        const listLeads = collectListLeads(ast);
        const expected = new Set<number>();
        ['PANDOC_TARGET', 'PANDOC_CHILD'].forEach((sentinel, offset) => {
            if (!listLeads.includes(sentinel)) {
                expected.add(lines.length - 2 + offset);
            }
        });
        expect(actual).toEqual(expected);
    });

    it.each(quoteToRootCases)(
        'reconsiders a root $name marker after a rejected quoted marker, extension=$enabled',
        ({ quotedMarker, rootMarker, enabled }) => {
            const lines = [
                'Paragraph',
                `> ${quotedMarker}QUOTED_SEED`,
                `${rootMarker}ROOT_TARGET`
            ];
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: lines.join('\n'),
                encoding: 'utf8',
                timeout: 3000,
                killSignal: 'SIGKILL'
            }));
            const listLeads = collectListLeads(ast);
            const expected = new Set<number>();
            if (!listLeads.includes('QUOTED_SEED')) {
                expected.add(1);
            }
            if (!listLeads.includes('ROOT_TARGET')) {
                expected.add(2);
            }

            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(expected);
        }
    );

    const nestedCases = [
        '- ', '1. ', '10. ', '100. ', 'A.  '
    ].flatMap(parentMarker =>
        ['- ', '1. ', '2. '].flatMap(childMarker =>
            Array.from({ length: 13 }, (_unused, indent) =>
                [false, true].map(enabled => ({
                    parentMarker, childMarker, indent, enabled
                }))).flat()
        )
    );

    it.each(nestedCases)(
        'classifies nested parent=$parentMarker child=$childMarker indent=$indent extension=$enabled',
        ({ parentMarker, childMarker, indent, enabled }) => {
            const lines = [
                `${parentMarker}PARENT_TARGET`,
                `${' '.repeat(indent)}${childMarker}CHILD_TARGET`,
                '- ROOT_TAIL'
            ];
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: lines.join('\n'), encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const expected = collectListLeads(ast).includes('CHILD_TARGET')
                ? new Set<number>() : new Set([1]);
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(expected);
        }
    );

    const wideParentTopologyCases = [4, 5, 8, 9].flatMap(indent =>
        [false, true].map(enabled => ({ indent, enabled })));

    it.each(wideParentTopologyCases)(
        'matches wide-parent topology at indent=$indent extension=$enabled',
        ({ indent, enabled }) => {
            const lines = [
                '100. PARENT_TARGET',
                `${' '.repeat(indent)}- CHILD_TARGET`,
                '101. ROOT_TAIL'
            ];
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: lines.join('\n'), encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const childIsNested = indent >= 5 && indent <= 8;
            const expectedChild: NormalizedListTopology = {
                kind: 'bullet',
                start: null,
                items: [{ text: 'CHILD_TARGET', children: [] }]
            };
            const expectedTopology: NormalizedListTopology[] = [{
                kind: 'ordered',
                start: 100,
                items: [
                    {
                        text: childIsNested
                            ? 'PARENT_TARGET'
                            : 'PARENT_TARGET - CHILD_TARGET',
                        children: childIsNested ? [expectedChild] : []
                    },
                    { text: 'ROOT_TAIL', children: [] }
                ]
            }];

            expect(collectListTopology(ast)).toEqual(expectedTopology);
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(childIsNested ? new Set() : new Set([1]));
        }
    );

    const mixedTabCases = [
        {
            name: 'two spaces then tab enters a bullet parent',
            lines: ['- PARENT_TARGET', '  \t- CHILD_TARGET', '- ROOT_TAIL'],
            childIsNested: true
        },
        {
            name: 'one space then tab remains below a five-column content indent',
            lines: ['-    PARENT_TARGET', ' \t- CHILD_TARGET', '- ROOT_TAIL'],
            childIsNested: false
        }
    ].flatMap(testCase => [false, true].map(enabled => ({ ...testCase, enabled })));

    it.each(mixedTabCases)(
        'matches mixed-tab topology: $name, extension=$enabled',
        ({ lines, childIsNested, enabled }) => {
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: lines.join('\n'), encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const expectedChild: NormalizedListTopology = {
                kind: 'bullet',
                start: null,
                items: [{ text: 'CHILD_TARGET', children: [] }]
            };
            expect(collectListTopology(ast)).toEqual([{
                kind: 'bullet',
                start: null,
                items: [
                    {
                        text: childIsNested
                            ? 'PARENT_TARGET'
                            : 'PARENT_TARGET - CHILD_TARGET',
                        children: childIsNested ? [expectedChild] : []
                    },
                    { text: 'ROOT_TAIL', children: [] }
                ]
            }]);
            expect(ListBlockValidator.validateListBlocks(lines, {
                enableListsWithoutPrecedingBlankline: enabled
            })).toEqual(childIsNested ? new Set() : new Set([1]));
        }
    );

    const definitionListCases = [
        {
            name: 'root definition list',
            source: 'ROOT_TERM\n: ROOT_DEFINITION'
        },
        {
            name: 'same-quote definition list',
            source: '> QUOTED_TERM\n> : QUOTED_DEFINITION'
        },
        {
            name: 'lazy quote definition list',
            source: '> LAZY_TERM\n: LAZY_DEFINITION'
        },
        {
            name: 'nested lazy quote definition list',
            source: '> > NESTED_LAZY_TERM\n> : NESTED_LAZY_DEFINITION'
        },
        {
            name: 'lazy quote followed by an ordinary definition list',
            source: [
                '> LAZY_TERM',
                ': LAZY_DEFINITION',
                '',
                'ORDINARY_TERM',
                ': ORDINARY_DEFINITION'
            ].join('\n')
        },
        {
            name: 'ordinary definition followed by an apparent lazy quote definition',
            source: [
                'A',
                ': da',
                '',
                '> B',
                ': db'
            ].join('\n')
        },
        {
            name: 'ordinary definition continued by unseparated quote-looking text',
            source: [
                'A',
                ': da',
                '> B',
                ': db'
            ].join('\n')
        },
        {
            name: 'lazy quote with consecutive definition markers',
            source: [
                '> Term',
                ': one',
                ': two'
            ].join('\n')
        },
        {
            name: 'lazy quote with three consecutive definition markers',
            source: [
                '> Term',
                ': one',
                ': two',
                ': three'
            ].join('\n')
        }
    ].flatMap(testCase => [false, true].map(enabled => ({ ...testCase, enabled })));

    it.each(definitionListCases)(
        'matches definition-list sequences: $name, extension=$enabled',
        ({ source, enabled }) => {
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: source, encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const actual = findPandocDefinitionListBlocks(source, {
                enableListsWithoutPrecedingBlankline: enabled
            }).map(normalizeParsedDefinitionList);
            const expected = collectDefinitionLists(ast);

            expect(actual).toHaveLength(expected.length);
            expect(actual).toEqual(expected);
        }
    );

    const nativeDefinitionListCases = [
        { name: 'bullet', marker: '- ', definitionIndent: '  ' },
        { name: 'decimal', marker: '1. ', definitionIndent: '   ' },
        { name: 'wide decimal', marker: '100. ', definitionIndent: '     ' }
    ].flatMap(testCase => [false, true].map(enabled => ({ ...testCase, enabled })));

    it.each(nativeDefinitionListCases)(
        'keeps a $name-item definition separate from a following root definition, extension=$enabled',
        ({ marker, definitionIndent, enabled }) => {
            const source = [
                `${marker}NATIVE_TERM`,
                `${definitionIndent}: NATIVE_DEFINITION`,
                '',
                'ROOT_TERM',
                ': ROOT_DEFINITION'
            ].join('\n');
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: source, encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const actual = findPandocDefinitionListBlocks(source, {
                enableListsWithoutPrecedingBlankline: enabled
            }).map(normalizeParsedDefinitionList);

            expect(actual).toEqual(collectDefinitionLists(ast));
        }
    );

    it.each([
        { name: 'root', source: 'Term\n: one\n  : two' },
        { name: 'native bullet', source: '- Term\n  : one\n    : two' }
    ].flatMap(testCase => [false, true].map(enabled => ({ ...testCase, enabled }))))(
        'matches nested definition topology for a $name owner, extension=$enabled',
        ({ source, enabled }) => {
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: source, encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const oracleList = findFirstDefinitionListNode(ast);
            const oracleItems = Array.isArray(oracleList?.c) ? oracleList.c : [];
            const oracleItem = Array.isArray(oracleItems[0]) ? oracleItems[0] : [];
            const oracleDefinitions = Array.isArray(oracleItem[1]) ? oracleItem[1] : [];
            const block = findPandocDefinitionListBlocks(source, {
                enableListsWithoutPrecedingBlankline: enabled
            })[0];
            const parsedDefinition = block.items[0].definitions[0];

            expect(block.items[0].definitions).toHaveLength(oracleDefinitions.length);
            expect(parsedDefinition.nestedDefinitionBlocks.map(normalizeParsedDefinitionList))
                .toEqual(collectDefinitionLists(oracleDefinitions[0]));
        }
    );

    it.each([false, true])(
        'preserves the code-block boundary created by excess definition padding, extension=%s',
        enabled => {
            const source = 'Term\n:     one\n  : two';
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: source, encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const oracleList = findFirstDefinitionListNode(ast);
            const oracleItems = Array.isArray(oracleList?.c) ? oracleList.c : [];
            const oracleItem = Array.isArray(oracleItems[0]) ? oracleItems[0] : [];
            const oracleDefinitions = Array.isArray(oracleItem[1]) ? oracleItem[1] : [];
            const oracleBlocks = Array.isArray(oracleDefinitions[0])
                ? oracleDefinitions[0] as Array<{ t?: string }>
                : [];
            const parsed = findPandocDefinitionListBlocks(source, {
                enableListsWithoutPrecedingBlankline: enabled
            })[0].items[0].definitions[0];

            expect(oracleDefinitions).toHaveLength(1);
            expect(oracleBlocks.map(block => block.t)).toEqual(['CodeBlock', 'Plain']);
            expect(parsed.lines).toEqual(['    one', ': two']);
            expect(parsed.nestedDefinitionBlocks).toEqual([]);
        }
    );

    it.each([false, true])(
        'respects an outer native list whose own start depends on the extension, extension=%s',
        enabled => {
            const source = [
                'Paragraph',
                '- NATIVE_TERM',
                '  : NATIVE_DEFINITION',
                '- NATIVE_TAIL'
            ].join('\n');
            const ast: unknown = JSON.parse(execFileSync('pandoc', [
                '-f', `markdown${enabled ? '+' : '-'}lists_without_preceding_blankline`,
                '-t', 'json'
            ], {
                input: source, encoding: 'utf8', timeout: 3000, killSignal: 'SIGKILL'
            }));
            const actual = findPandocDefinitionListBlocks(source, {
                enableListsWithoutPrecedingBlankline: enabled
            }).map(normalizeParsedDefinitionList);

            expect(actual).toEqual(collectDefinitionLists(ast));
        }
    );

    const quoteDefinitionPropertyCases = createQuoteDefinitionPropertyCases();

    it('matches generated definition lists across quote depths and marker runs', () => {
        expect(quoteDefinitionPropertyCases).toHaveLength(288);
        expect(collectDefinitionOracleMismatches(quoteDefinitionPropertyCases)).toEqual([]);
    });

    const quoteMarkerTransitionCases = createQuoteMarkerTransitionCases();

    it('matches generated definition lists when consecutive markers change quote depth', () => {
        expect(quoteMarkerTransitionCases).toHaveLength(144);
        const mismatches = collectDefinitionOracleMismatches(quoteMarkerTransitionCases);
        expect({
            count: mismatches.length,
            examples: mismatches.slice(0, 12)
        }).toEqual({ count: 0, examples: [] });
    });

    const nativeDefinitionPropertyCases = createNativeDefinitionPropertyCases();

    it('matches generated native-parent definition lists across widths and indents', () => {
        expect(nativeDefinitionPropertyCases).toHaveLength(864);
        const mismatches = collectDefinitionOracleMismatches(nativeDefinitionPropertyCases);
        expect({
            count: mismatches.length,
            examples: mismatches.slice(0, 12)
        }).toEqual({ count: 0, examples: [] });
    });
});

interface DefinitionOracleCase {
    name: string;
    source: string;
    enabled: boolean;
}

interface DefinitionOracleMismatch {
    name: string;
    source: string;
    expected: NormalizedDefinitionList[];
    actual: NormalizedDefinitionList[];
}

function createQuoteDefinitionPropertyCases(): DefinitionOracleCase[] {
    const cases: DefinitionOracleCase[] = [];
    const seen = new Set<string>();
    [0, 1, 2].forEach(termDepth => {
        [0, 1, 2].forEach(markerDepth => {
            ['none', 'root', 'container'].forEach(blankStyle => {
                [':', '~'].forEach(marker => {
                    [1, 2, 3].forEach(markerCount => {
                        [false, true].forEach(enabled => {
                            const blankLines = getDefinitionBlankLines(blankStyle, termDepth);
                            const source = [
                                quoteLine(termDepth, 'TERM'),
                                ...blankLines,
                                ...Array.from({ length: markerCount }, (_unused, index) =>
                                    quoteLine(markerDepth, `${marker} DEF_${index + 1}`)
                                )
                            ].join('\n');
                            const key = `${enabled}\n${source}`;
                            if (seen.has(key)) {
                                return;
                            }
                            seen.add(key);
                            cases.push({
                                name: `termDepth=${termDepth}, markerDepth=${markerDepth}, ` +
                                    `blank=${blankStyle}, marker=${marker}, count=${markerCount}, ` +
                                    `extension=${enabled}`,
                                source,
                                enabled
                            });
                        });
                    });
                });
            });
        });
    });
    return cases;
}

function createNativeDefinitionPropertyCases(): DefinitionOracleCase[] {
    const parents = [
        { name: 'bullet', marker: '- ', tail: '- ', contentIndent: 2 },
        { name: 'indented-bullet', marker: '  - ', tail: '- ', contentIndent: 4 },
        { name: 'decimal', marker: '1. ', tail: '2. ', contentIndent: 3 },
        { name: 'wide-decimal', marker: '10. ', tail: '11. ', contentIndent: 4 },
        { name: 'wider-decimal', marker: '100. ', tail: '101. ', contentIndent: 5 },
        { name: 'alpha', marker: 'A.  ', tail: 'B.  ', contentIndent: 4 }
    ];
    return parents.flatMap(parent => {
        const definitionIndents = Array.from(new Set([
            0,
            parent.contentIndent - 1,
            parent.contentIndent,
            parent.contentIndent + 1,
            parent.contentIndent + 3,
            parent.contentIndent + 4
        ]));
        return [0, 1, 2].flatMap(quoteDepth =>
            [false, true].flatMap(hasBlank =>
                definitionIndents.flatMap(definitionIndent =>
                    [1, 2].flatMap(markerCount =>
                        [false, true].map(enabled => {
                            const source = [
                                quoteLine(quoteDepth, `${parent.marker}NATIVE_TERM`),
                                ...(hasBlank ? [quoteLine(quoteDepth, '')] : []),
                                ...Array.from({ length: markerCount }, (_unused, index) =>
                                    quoteLine(
                                        quoteDepth,
                                        `${' '.repeat(definitionIndent)}: NATIVE_DEF_${index + 1}`
                                    )
                                ),
                                quoteLine(quoteDepth, `${parent.tail}NATIVE_TAIL`)
                            ].join('\n');
                            return {
                                name: `parent=${parent.name}, quoteDepth=${quoteDepth}, ` +
                                    `blank=${hasBlank}, definitionIndent=${definitionIndent}, ` +
                                    `count=${markerCount}, extension=${enabled}`,
                                source,
                                enabled
                            };
                        })
                    )
                )
            )
        );
    });
}

function createQuoteMarkerTransitionCases(): DefinitionOracleCase[] {
    const cases: DefinitionOracleCase[] = [];
    const seen = new Set<string>();
    [0, 1, 2].forEach(termDepth => {
        [0, 1, 2].forEach(firstMarkerDepth => {
            [0, 1, 2].forEach(secondMarkerDepth => {
                ['none', 'root', 'container'].forEach(blankStyle => {
                    [false, true].forEach(enabled => {
                        const source = [
                            quoteLine(termDepth, 'TERM'),
                            ...getDefinitionBlankLines(blankStyle, termDepth),
                            quoteLine(firstMarkerDepth, ': DEF_1'),
                            quoteLine(secondMarkerDepth, ': DEF_2')
                        ].join('\n');
                        const key = `${enabled}\n${source}`;
                        if (seen.has(key)) {
                            return;
                        }
                        seen.add(key);
                        cases.push({
                            name: `termDepth=${termDepth}, firstMarkerDepth=${firstMarkerDepth}, ` +
                                `secondMarkerDepth=${secondMarkerDepth}, blank=${blankStyle}, ` +
                                `extension=${enabled}`,
                            source,
                            enabled
                        });
                    });
                });
            });
        });
    });
    return cases;
}

function getDefinitionBlankLines(style: string, termDepth: number): string[] {
    if (style === 'none') {
        return [];
    }
    if (style === 'container' && termDepth > 0) {
        return [quoteLine(termDepth, '')];
    }
    return [''];
}

function quoteLine(depth: number, content: string): string {
    const prefix = Array.from({ length: depth }, () => '>').join(' ');
    return `${prefix}${prefix && content ? ' ' : ''}${content}`;
}

function collectDefinitionOracleMismatches(
    cases: DefinitionOracleCase[]
): DefinitionOracleMismatch[] {
    return cases.flatMap(testCase => {
        const ast: unknown = JSON.parse(execFileSync('pandoc', [
            '-f', `markdown${testCase.enabled ? '+' : '-'}lists_without_preceding_blankline`,
            '-t', 'json'
        ], {
            input: testCase.source,
            encoding: 'utf8',
            timeout: 3000,
            killSignal: 'SIGKILL'
        }));
        const expected = collectDefinitionLists(ast);
        const actual = findPandocDefinitionListBlocks(testCase.source, {
            enableListsWithoutPrecedingBlankline: testCase.enabled
        }).map(normalizeParsedDefinitionList);
        return JSON.stringify(actual) === JSON.stringify(expected)
            ? []
            : [{
                name: testCase.name,
                source: testCase.source,
                expected,
                actual
            }];
    });
}

function collectListLeads(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.flatMap(collectListLeads);
    }
    if (!value || typeof value !== 'object') {
        return [];
    }
    const node = value as { t?: string; c?: unknown };
    let leads: string[] = [];
    if (node.t === 'BulletList' || node.t === 'OrderedList') {
        const items = node.t === 'OrderedList' && Array.isArray(node.c) ? node.c[1] : node.c;
        if (Array.isArray(items)) {
            leads = items.map(item => Array.isArray(item) ? inlineText(item[0]).trim() : '');
        }
    }
    return [...leads, ...Object.values(value).flatMap(collectListLeads)];
}

function inlineText(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map(inlineText).join('');
    }
    if (!value || typeof value !== 'object') {
        return '';
    }
    const node = value as { t?: string; c?: unknown };
    if (node.t === 'Str' && typeof node.c === 'string') {
        return node.c;
    }
    if (node.t === 'Space' || node.t === 'SoftBreak') {
        return ' ';
    }
    return inlineText(node.c);
}

function collectListTopology(value: unknown): NormalizedListTopology[] {
    if (Array.isArray(value)) {
        return value.flatMap(collectListTopology);
    }
    if (!value || typeof value !== 'object') {
        return [];
    }
    const node = value as { t?: string; c?: unknown };
    if (node.t === 'BulletList' || node.t === 'OrderedList') {
        return [normalizeList(node)];
    }
    return Object.values(value).flatMap(collectListTopology);
}

function normalizeList(node: { t?: string; c?: unknown }): NormalizedListTopology {
    const ordered = node.t === 'OrderedList';
    const start = ordered && Array.isArray(node.c) && Array.isArray(node.c[0]) &&
        typeof node.c[0][0] === 'number'
        ? node.c[0][0]
        : null;
    const rawItems = ordered && Array.isArray(node.c) ? node.c[1] : node.c;
    const items = Array.isArray(rawItems) ? rawItems : [];
    return {
        kind: ordered ? 'ordered' : 'bullet',
        start,
        items: items.map(item => ({
            text: inlineTextWithoutLists(item).replace(/\s+/g, ' ').trim(),
            children: collectListTopology(item)
        }))
    };
}

function inlineTextWithoutLists(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map(inlineTextWithoutLists).join('');
    }
    if (!value || typeof value !== 'object') {
        return '';
    }
    const node = value as { t?: string; c?: unknown };
    if (node.t === 'BulletList' || node.t === 'OrderedList') {
        return '';
    }
    if (node.t === 'Str' && typeof node.c === 'string') {
        return node.c;
    }
    if (node.t === 'Space' || node.t === 'SoftBreak') {
        return ' ';
    }
    return inlineTextWithoutLists(node.c);
}

function collectDefinitionLists(value: unknown): NormalizedDefinitionList[] {
    if (Array.isArray(value)) {
        return value.flatMap(collectDefinitionLists);
    }
    if (!value || typeof value !== 'object') {
        return [];
    }
    const node = value as { t?: string; c?: unknown };
    if (node.t === 'DefinitionList') {
        return [normalizePandocDefinitionList(node.c)];
    }
    return Object.values(value).flatMap(collectDefinitionLists);
}

function findFirstDefinitionListNode(value: unknown): { t: string, c?: unknown } | null {
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findFirstDefinitionListNode(item);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (!value || typeof value !== 'object') {
        return null;
    }
    const node = value as { t?: string, c?: unknown };
    if (node.t === 'DefinitionList') {
        return { t: node.t, c: node.c };
    }
    for (const child of Object.values(value)) {
        const found = findFirstDefinitionListNode(child);
        if (found) {
            return found;
        }
    }
    return null;
}

function normalizePandocDefinitionList(value: unknown): NormalizedDefinitionList {
    const items = Array.isArray(value) ? value : [];
    return {
        items: items.map(item => {
            const pair = Array.isArray(item) ? item : [];
            const definitions = Array.isArray(pair[1]) ? pair[1] : [];
            return {
                term: normalizeOracleText(pair[0]),
                definitions: definitions.map(normalizeOracleText)
            };
        })
    };
}

function normalizeParsedDefinitionList(
    block: ReturnType<typeof findPandocDefinitionListBlocks>[number]
): NormalizedDefinitionList {
    return {
        items: block.items.map(item => ({
            term: item.term,
            definitions: item.definitions.map(definition => definition.plainText)
        }))
    };
}

function normalizeOracleText(value: unknown): string {
    return inlineText(value).replace(/\s+/g, ' ').trim();
}
