import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';

import {
    buildPandocProfileArgs,
    DEFAULT_EXPORT_PROFILES,
    PandocService
} from '../../../src/pandoc';
import FALLBACK_PANDOC_OPTIONS_METADATA from '../../../src/pandoc/metadata/pandoc-options.json';
import {
    buildProfileDraftPreview,
    compileProfileDraft,
    createProfileDraft,
    FALLBACK_OPTIONS,
    FALLBACK_PANDOC_CATALOG,
    findOptionSpec,
    getFormatExtensionChoices,
    mergeOptionSpecs,
    metadataToOptionSpecs,
    optionLabel,
    optionValueTypeText,
    pandocValueWidgetTypeMap,
    parseExtensionListOutput,
    parsePandocExtensionDescriptions,
    parsePandocFormatValue,
    parsePandocHelp,
    parsePandocManPage,
    parsePandocOptionsMetadata,
    PandocCatalogService,
    quoteToken,
    rebuildPandocOptionsText,
    resolvePandocValueWidget,
    searchOptionKeys,
    searchOptions,
    validateProfileDraft
} from '../../../src/pandoc/gui-core';
import { ExportVariables } from '../../../src/pandoc/types';
import type { PandocOptionsMetadata } from '../../../src/pandoc/gui-core';
import { FORMAT_EXTENSION_FIXTURE_CATALOG } from './formatExtensionFixture';

const variables: ExportVariables = {
    vaultDir: '/vault',
    pluginDir: '/plugin',
    luaFilterDir: '/plugin/lua_filter',
    currentPath: '/vault/note.md',
    currentDir: '/vault',
    currentFileName: 'note',
    currentFileFullName: 'note.md',
    outputPath: '/exports/note.docx',
    outputDir: '/exports',
    outputFileName: 'note',
    outputFileFullName: 'note.docx',
    attachmentFolderPath: '/vault/assets',
    embedDirs: '/vault/assets',
    fromFormat: 'markdown',
    metadata: {}
};

const PANDOC_OPTIONS_FIXTURE = 'tests/unit/pandoc/fixtures/pandoc-options.man.txt';

describe('pandoc GUI core', () => {
    it('parses option keys and value placeholders from pandoc help', () => {
        const options = parsePandocHelp(`
  -f FORMAT, -r FORMAT  --from=FORMAT, --read=FORMAT
  -s                    --standalone
                        --columns=NUMBER
                        --eol=crlf|lf|native
                        --toc[=true|false], --table-of-contents[=true|false]
  -H FILE              --include-in-header=FILE|URL
`);

        expect(options).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: '--from',
                aliases: expect.arrayContaining(['-f', '-r', '--read']),
                valueKind: 'format',
                valueSeparators: {
                    '-f': 'space',
                    '-r': 'space',
                    '--from': 'equals',
                    '--read': 'equals'
                }
            }),
            expect.objectContaining({
                key: '--columns',
                valueKind: 'integer'
            }),
            expect.objectContaining({
                key: '--standalone',
                valueKind: 'none'
            }),
            expect.objectContaining({
                key: '--eol',
                valueKind: 'enum',
                values: ['crlf', 'lf', 'native']
            }),
            expect.objectContaining({
                key: '--toc',
                valueKind: 'none',
                valuePlaceholder: 'NONE|BOOLEAN',
                valueAlternatives: [
                    expect.objectContaining({ id: 'none', valueKind: 'none' }),
                    expect.objectContaining({
                        id: 'BOOLEAN',
                        valueKind: 'enum',
                        values: ['true', 'false']
                    })
                ]
            }),
            expect.objectContaining({
                key: '-H',
                aliases: [],
                valuePlaceholder: 'FILE',
                valueKind: 'file'
            }),
            expect.objectContaining({
                key: '--include-in-header',
                aliases: [],
                valuePlaceholder: 'FILE|URL',
                valueAlternatives: [
                    expect.objectContaining({ id: 'FILE' }),
                    expect.objectContaining({ id: 'URL' })
                ]
            })
        ]));
    });

    it('extracts richer descriptions from man page option blocks', () => {
        const options = parsePandocManPage(`
     -o FILE, --output=FILE
          Write output to FILE instead of stdout.

     --data-dir=DIRECTORY
          Specify the user data directory.

     --wrap=auto|none|preserve
          Determine how text is wrapped.
`);

        expect(options).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: '-o',
                description: 'Write output to FILE instead of stdout.'
            }),
            expect.objectContaining({
                key: '--data-dir',
                valueKind: 'directory'
            }),
            expect.objectContaining({
                key: '--wrap',
                valueKind: 'enum',
                values: ['auto', 'none', 'preserve']
            })
        ]));
    });

    it('parses union placeholders into value alternatives', () => {
        const options = parsePandocManPage(`
     --wrap=auto|none|preserve
          Determine how text is wrapped.

     --syntax-highlighting=default|none|idiomatic|STYLE|FILE
          Set the syntax highlighting source.

     --template=FILE|URL
          Use the specified template.
`);

        expect(findOptionSpec({ ...FALLBACK_PANDOC_CATALOG, options }, '--wrap')).toMatchObject({
            valueKind: 'enum',
            values: ['auto', 'none', 'preserve'],
            valueAlternatives: [
                expect.objectContaining({
                    id: 'ENUM',
                    values: ['auto', 'none', 'preserve']
                })
            ]
        });
        expect(findOptionSpec({ ...FALLBACK_PANDOC_CATALOG, options }, '--syntax-highlighting'))
            .toMatchObject({
                valueKind: 'enum',
                valueAlternatives: [
                    expect.objectContaining({
                        id: 'ENUM',
                        values: ['default', 'none', 'idiomatic']
                    }),
                    expect.objectContaining({
                        id: 'STYLE',
                        valueKind: 'enum'
                    }),
                    expect.objectContaining({
                        id: 'FILE',
                        valueKind: 'file'
                    })
                ]
            });
        expect(findOptionSpec({ ...FALLBACK_PANDOC_CATALOG, options }, '--template'))
            .toMatchObject({
                valueKind: 'file',
                valueAlternatives: [
                    expect.objectContaining({ id: 'FILE', valueKind: 'file' }),
                    expect.objectContaining({ id: 'URL', placeholder: 'URL' })
                ]
            });
    });

    it('expands optional bracket value syntax into explicit alternatives', () => {
        const options = parsePandocManPage(`
     --list-extensions[=FORMAT]
          List supported extensions.

     -M KEY[=VAL], --metadata=KEY[:VAL]
          Set metadata.

     -p, --preserve-tabs[=true|false]
          Preserve tabs.

     -N, --number-sections=[true|false]
          Number section headings.

     --number-offset=NUMBER[,NUMBER,...]
          Offsets for section heading numbers.
`);
        const catalog = { ...FALLBACK_PANDOC_CATALOG, options };

        expect(findOptionSpec(catalog, '--list-extensions')).toMatchObject({
            valuePlaceholder: 'NONE|FORMAT',
            valueKind: 'none',
            valueAlternatives: [
                expect.objectContaining({ id: 'none', valueKind: 'none' }),
                expect.objectContaining({ id: 'FORMAT', valueKind: 'format' })
            ]
        });
        expect(findOptionSpec(catalog, '-M')).toMatchObject({
            valuePlaceholder: 'KEY|KEY=VAL',
            valueAlternatives: [
                expect.objectContaining({ id: 'KEY', valueKind: 'keyValue' }),
                expect.objectContaining({ id: 'KEY=VAL', valueKind: 'keyValue' })
            ]
        });
        expect(findOptionSpec(catalog, '--metadata')).toMatchObject({
            valuePlaceholder: 'KEY|KEY:VAL',
            valueAlternatives: [
                expect.objectContaining({ id: 'KEY', valueKind: 'keyValue' }),
                expect.objectContaining({ id: 'KEY:VAL', valueKind: 'keyValue' })
            ]
        });
        expect(findOptionSpec(catalog, '-p')).toMatchObject({
            key: '-p',
            aliases: [],
            valueKind: 'none',
            valuePlaceholder: undefined
        });
        expect(findOptionSpec(catalog, '--preserve-tabs')).toMatchObject({
            valuePlaceholder: 'NONE|BOOLEAN',
            valueAlternatives: [
                expect.objectContaining({ id: 'none', valueKind: 'none' }),
                expect.objectContaining({
                    id: 'BOOLEAN',
                    valueKind: 'enum',
                    values: ['true', 'false']
                })
            ]
        });
        expect(findOptionSpec(catalog, '-N')).toMatchObject({
            key: '-N',
            aliases: [],
            valueKind: 'none',
            valuePlaceholder: undefined
        });
        expect(findOptionSpec(catalog, '--number-sections')).toMatchObject({
            valuePlaceholder: 'NONE|BOOLEAN'
        });
        expect(findOptionSpec(catalog, '--number-offset')).toMatchObject({
            valuePlaceholder: 'NUMBER|NUMBER,NUMBER,...',
            valueAlternatives: [
                expect.objectContaining({ id: 'NUMBER', valueKind: 'integer' }),
                expect.objectContaining({ id: 'NUMBER,NUMBER,...', valueKind: 'integer' })
            ]
        });
    });

    it('preserves distinct value syntax for aliases in one man page signature', () => {
        const options = parsePandocManPage(`
     -H FILE, --include-in-header=FILE|URL
          Include contents of FILE, verbatim, at the end of the header.

     -f FORMAT, --from=FORMAT
          Specify input format.
`);
        const catalog = { ...FALLBACK_PANDOC_CATALOG, options };
        const shortInclude = findOptionSpec(catalog, '-H');
        const longInclude = findOptionSpec(catalog, '--include-in-header');
        const from = findOptionSpec(catalog, '--from');

        expect(shortInclude).toMatchObject({
            key: '-H',
            aliases: [],
            valuePlaceholder: 'FILE',
            valueKind: 'file',
            description: expect.stringContaining('Include contents')
        });
        expect(shortInclude?.valueAlternatives).toBeUndefined();
        expect(longInclude).toMatchObject({
            key: '--include-in-header',
            aliases: [],
            valuePlaceholder: 'FILE|URL',
            valueAlternatives: [
                expect.objectContaining({ id: 'FILE', valueKind: 'file' }),
                expect.objectContaining({ id: 'URL', placeholder: 'URL' })
            ],
            description: shortInclude?.description
        });
        expect(from).toMatchObject({
            key: '-f',
            aliases: ['--from'],
            valuePlaceholder: 'FORMAT',
            valueKind: 'format',
            valueSeparators: {
                '-f': 'space',
                '--from': 'equals'
            }
        });
    });

    it('stores equivalent man page flags as separate names sharing one group', () => {
        const metadata = parsePandocOptionsMetadata(`
OPTIONS
   General options
     -f FORMAT, -r FORMAT, --from=FORMAT, --read=FORMAT
          Specify input format. FORMAT can be:

          • markdown (Pandoc's Markdown)

          • gfm  (GitHub-Flavored Markdown), or the deprecated and less accu‐
            rate markdown_github.

          Extensions can be individually enabled or disabled.
`);
        const names = metadata.optionNames.filter(name => ['-f', '-r', '--from', '--read'].includes(name.name));
        const groupIds = new Set(names.map(name => name.groupId));
        const spec = parsePandocManPage(`
OPTIONS
   General options
     -f FORMAT, -r FORMAT, --from=FORMAT, --read=FORMAT
          Specify input format. FORMAT can be:

          • markdown (Pandoc's Markdown)

          • gfm  (GitHub-Flavored Markdown), or the deprecated and less accu‐
            rate markdown_github.

          Extensions can be individually enabled or disabled.
`)[0];

        expect(names.map(name => name.name)).toEqual(['-f', '-r', '--from', '--read']);
        expect(groupIds.size).toBe(1);
        expect(spec.aliases).toEqual(['-r', '--from', '--read']);
        expect(spec.description).toContain('markdown (Pandoc');
        expect(spec.description).toContain('less accurate markdown_github');
        expect(spec.description).toContain('Extensions can be individually enabled');
    });

    it('rebuilds normalized options text from parsed metadata', () => {
        const metadata = parsePandocOptionsMetadata(`
OPTIONS
   General options
     --wrap=auto|none|preserve
          Determine how text is wrapped.

          • auto wraps text.

          • none preserves line breaks.

   Reader options
     --columns=NUMBER
          Specify the column width.

EXIT CODES
`);

        expect(rebuildPandocOptionsText(metadata)).toBe([
            'OPTIONS',
            'General options',
            '--wrap=auto|none|preserve',
            'Determine how text is wrapped.',
            '• auto wraps text.',
            '• none preserves line breaks.',
            'Reader options',
            '--columns=NUMBER',
            'Specify the column width.'
        ].join('\n'));
    });

    it('rebuilds the complete bundled Pandoc OPTIONS section from metadata', () => {
        const metadata = FALLBACK_PANDOC_OPTIONS_METADATA as PandocOptionsMetadata;
        const sourceText = readFileSync(PANDOC_OPTIONS_FIXTURE, 'utf8');
        const normalizedSource = normalizePandocOptionsSource(sourceText);
        const expectedSections = [
            'General options',
            'Reader options',
            'General writer options',
            'Options affecting specific writers',
            'Citation rendering',
            'Math rendering in HTML',
            'Options for wrapper scripts'
        ];
        const actualSections = metadata.sections
            .filter(section => section.id !== 'options')
            .map(section => section.title);

        expect(actualSections).toEqual(expectedSections);
        expect(metadata.optionGroups.length).toBeGreaterThan(100);
        expect(metadata.optionNames.length).toBeGreaterThan(metadata.optionGroups.length);
        expect(rebuildPandocOptionsText(metadata)).toBe(normalizedSource);
        expect(metadata.normalizedOptionsText).toBe(normalizedSource);
        for (const section of expectedSections) {
            expect(metadata.normalizedOptionsText).toContain(`\n${section}\n`);
        }
    });

    it('keeps bundled option specs aligned with each option name value syntax', () => {
        const metadata = FALLBACK_PANDOC_OPTIONS_METADATA as PandocOptionsMetadata;
        const options = metadataToOptionSpecs(metadata);

        for (const name of metadata.optionNames) {
            const matches = options.filter(option => [option.key, ...option.aliases].includes(name.name));
            const expectedPlaceholder = normalizeFixtureValueSyntax(name.valueSyntax);
            const expectedSeparator = normalizeFixtureValueSeparator(name.valueSyntax);

            expect(matches).toHaveLength(1);
            expect(matches[0].valuePlaceholder).toBe(expectedPlaceholder);
            if (expectedSeparator) {
                expect(matches[0].valueSeparators?.[name.name]).toBe(expectedSeparator);
            }
        }

        for (const option of options) {
            if (!option.valuePlaceholder) continue;
            expect(optionLabel(option)).not.toContain(option.valuePlaceholder);
        }
    });

    it('ignores man page prose that only mentions options', () => {
        const options = parsePandocManPage(`
     --from and --to options below. Pandoc can also produce PDF output.
     --pdf-engine option or -t context, -t html, or -t ms to the command line.
     -t FORMAT, -w FORMAT, --to=FORMAT, --write=FORMAT
          Specify output format.
          --resource-path baz:bim is equivalent to --resource-path
     --resource-path=SEARCHPATH
          List of paths to search for images and other resources.
`);

        expect(options.map(option => option.key)).toEqual(['-t', '--resource-path']);
        expect(findOptionSpec({
            ...FALLBACK_PANDOC_CATALOG,
            options
        }, '-t')).toMatchObject({
            key: '-t',
            valueKind: 'format',
            mapsTo: 'to'
        });
        expect(findOptionSpec({
            ...FALLBACK_PANDOC_CATALOG,
            options
        }, '--resource-path')).toMatchObject({
            valueKind: 'pathList',
            mapsTo: 'resourcePath'
        });
    });

    it('keeps fallback semantics aligned with runtime option extraction', () => {
        const runtimeOptions = mergeOptionSpecs(
            parsePandocHelp(`
  -f FORMAT, -r FORMAT  --from=FORMAT, --read=FORMAT
  -t FORMAT, -w FORMAT  --to=FORMAT, --write=FORMAT
  -s                    --standalone
                        --resource-path=SEARCHPATH
                        --eol=crlf|lf|native
  -L SCRIPTPATH         --lua-filter=SCRIPTPATH
`),
            parsePandocManPage(`
     --pdf-engine option or -t context, -t html, or -t ms to the command line.
     -t FORMAT, -w FORMAT, --to=FORMAT, --write=FORMAT
          Specify output format.
          --resource-path baz:bim is equivalent to --resource-path
     --resource-path=SEARCHPATH
          List of paths to search for images and other resources.
`)
        );
        const merged = {
            ...FALLBACK_PANDOC_CATALOG,
            options: mergeOptionSpecs(FALLBACK_OPTIONS, runtimeOptions)
        };

        for (const key of ['-f', '-t', '-s', '--resource-path', '--eol', '-L']) {
            const fallback = findOptionSpec(FALLBACK_PANDOC_CATALOG, key);
            const runtime = findOptionSpec(merged, key);
            expect(runtime).toMatchObject({
                valueKind: fallback?.valueKind,
                mapsTo: fallback?.mapsTo,
                values: fallback?.values
            });
        }
    });

    it('keeps manual fallback values for known enum options', () => {
        expect(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--eol')).toMatchObject({
            valueKind: 'enum',
            values: ['crlf', 'lf', 'native']
        });
        expect(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--wrap')).toMatchObject({
            valueKind: 'enum',
            values: ['auto', 'none', 'preserve']
        });
        const alternatives = findOptionSpec(FALLBACK_PANDOC_CATALOG, '--syntax-highlighting')?.valueAlternatives;
        expect(alternatives).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ENUM',
                values: expect.arrayContaining(['default', 'none', 'idiomatic'])
            }),
            expect.objectContaining({
                id: 'STYLE',
                values: expect.arrayContaining(['pygments'])
            }),
            expect.objectContaining({ id: 'FILE' })
        ]));
        expect(alternatives?.find(alternative => alternative.id === 'FILE')?.values).toBeUndefined();
    });

    it('formats fallback labels and mixed placeholder value types without leaking placeholders', () => {
        const output = findOptionSpec(FALLBACK_PANDOC_CATALOG, '-o');
        const idPrefix = findOptionSpec(FALLBACK_PANDOC_CATALOG, '--id-prefix');
        const extractMedia = findOptionSpec(FALLBACK_PANDOC_CATALOG, '--extract-media');
        const shortHeader = findOptionSpec(FALLBACK_PANDOC_CATALOG, '-H');
        const longHeader = findOptionSpec(FALLBACK_PANDOC_CATALOG, '--include-in-header');

        expect(optionValueTypeText(output)).toBe('OFILE');
        expect(optionLabel(idPrefix!)).toBe('--id-prefix');
        expect(optionValueTypeText(idPrefix)).toBe('STRING');
        expect(optionValueTypeText(extractMedia)).toBe('DIR | FILE.zip');
        expect(extractMedia?.valueAlternatives).toEqual([
            expect.objectContaining({ id: 'DIR', valueKind: 'directory' }),
            expect.objectContaining({ id: 'FILE.zip', valueKind: 'file' })
        ]);
        expect(shortHeader).toMatchObject({
            key: '-H',
            aliases: [],
            valuePlaceholder: 'FILE',
            valueKind: 'file'
        });
        expect(longHeader).toMatchObject({
            key: '--include-in-header',
            aliases: [],
            valuePlaceholder: 'FILE|URL',
            valueAlternatives: [
                expect.objectContaining({ id: 'FILE' }),
                expect.objectContaining({ id: 'URL' })
            ]
        });
        expect(shortHeader?.description).toBe(longHeader?.description);
    });

    it('enriches runtime highlight styles on the STYLE alternative only', async () => {
        const service = new PandocService({
            runner: async request => pandocResult(request.args, runtimeOutputForArgs(request.args))
        });
        const catalogService = new PandocCatalogService({
            service,
            shellRunner: async () => pandocResult([], `
OPTIONS
   General writer options
     --syntax-highlighting=default|none|idiomatic|STYLE|FILE
          Set the syntax highlighting source.
`)
        });
        const catalog = await catalogService.loadCatalog();
        const spec = findOptionSpec(catalog, '--syntax-highlighting');
        const enumAlternative = spec?.valueAlternatives?.find(alternative => alternative.id === 'ENUM');
        const style = spec?.valueAlternatives?.find(alternative => alternative.id === 'STYLE');
        const file = spec?.valueAlternatives?.find(alternative => alternative.id === 'FILE');

        expect(enumAlternative?.values).toEqual(expect.arrayContaining(['default', 'none', 'idiomatic']));
        expect(enumAlternative?.values).not.toContain('solarized');
        expect(style?.values).toEqual(expect.arrayContaining(['solarized']));
        expect(file?.values).toBeUndefined();
    });

    it('parses pandoc extension lists with default inclusion state', () => {
        expect(parseExtensionListOutput(`
+footnotes
-wikilinks_title_after_pipe
ignored
`, {
            footnotes: 'Allows footnotes.',
            wikilinks_title_after_pipe: 'Supports URL-first wikilinks.'
        })).toEqual([
            { name: 'footnotes', defaultEnabled: true, description: 'Allows footnotes.' },
            {
                name: 'wikilinks_title_after_pipe',
                defaultEnabled: false,
                description: 'Supports URL-first wikilinks.'
            }
        ]);
    });

    it('extracts extension descriptions from pandoc man page blocks', () => {
        const descriptions = parsePandocExtensionDescriptions(`
   Extension: smart
     Interpret straight quotes as curly quotes.

     This extension can be enabled/disabled for the following formats:

   Extension: superscript, subscript
     Allows super/subscript markup.

   Extension: citations (org)
     Enables org citation syntax.
`);

        expect(descriptions).toMatchObject({
            smart: 'Interpret straight quotes as curly quotes.',
            superscript: 'Allows super/subscript markup.',
            subscript: 'Allows super/subscript markup.',
            citations: 'Enables org citation syntax.'
        });
    });

    it('classifies format extensions as included, compatible, or incompatible', () => {
        expect(parsePandocFormatValue('markdown+wikilinks_title_after_pipe-alerts')).toEqual({
            baseFormat: 'markdown',
            modifiers: [
                { operator: '+', name: 'wikilinks_title_after_pipe' },
                { operator: '-', name: 'alerts' }
            ]
        });
        expect(getFormatExtensionChoices(
            FORMAT_EXTENSION_FIXTURE_CATALOG,
            'markdown+wikilinks_title_after_pipe+not_real'
        )).toEqual(expect.arrayContaining([
            expect.objectContaining({
                name: 'fenced_divs',
                state: 'included',
                checked: true,
                editable: false
            }),
            expect.objectContaining({
                name: 'wikilinks_title_after_pipe',
                state: 'enabled',
                checked: true,
                editable: true,
                description: 'Supports URL-first wikilinks.'
            }),
            expect.objectContaining({
                name: 'not_real',
                state: 'incompatible',
                checked: true,
                editable: false
            })
        ]));
    });

    it('searches by alias, normalized key, and description text', () => {
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, 'from')[0].option.key).toBe('-f');
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, '--from')[0].option.key).toBe('-f');
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, '--read')[0].option.key).toBe('-f');
        expect(optionLabel(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--read')!)).toBe('-f, -r, --from, --read');
        expect(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--from')?.description).toContain('FORMAT can be:');
        expect(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--from')?.description).toContain('markdown (Pandoc');
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, 'table of contents')[0].option.key).toBe('--toc');
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, 'table contents')).toHaveLength(0);
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, 'table contents', 20, true)[0].option.key).toBe('--toc');
    });

    it('autosuggests by option keys only', () => {
        expect(searchOptionKeys(FALLBACK_PANDOC_CATALOG, 'fr')[0].option.key).toBe('-f');
        expect(searchOptionKeys(FALLBACK_PANDOC_CATALOG, 'table contents')).toHaveLength(0);
    });

    it('formats option value type labels shared by command and search panels', () => {
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--standalone'))).toBe('');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--toc'))).toBe('none | BOOLEAN');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '-t'))).toBe('FORMAT');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--resource-path'))).toBe('SEARCHPATH');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '-L'))).toBe('SCRIPT');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--eol'))).toBe('ENUM');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--list-extensions')))
            .toBe('none | FORMAT');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '-M'))).toBe('KEY | KEY=VAL');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--metadata'))).toBe('KEY | KEY:VAL');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '-p'))).toBe('');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--preserve-tabs')))
            .toBe('none | BOOLEAN');
        expect(optionValueTypeText(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--syntax-highlighting')))
            .toBe('ENUM | STYLE | FILE');
        expect(optionValueTypeText()).toBe('unknown');
    });

    it('routes pandoc value types to internal command-builder widgets', () => {
        const typeMap = pandocValueWidgetTypeMap();
        expect(typeMap).toMatchObject({
            KEY: 'keyWidget',
            'KEY=VAL': 'keyValueWidget',
            'KEY:VAL': 'keyValueWidget',
            FORMAT: 'formatWidget',
            OFILE: 'outputFileWidget',
            PATH: 'pathWidget'
        });
        expect(resolvePandocValueWidget(
            findOptionSpec(FALLBACK_PANDOC_CATALOG, '--metadata')?.valueAlternatives?.[1]
        )).toMatchObject({
            widgetType: 'keyValueWidget',
            separator: ':'
        });
        expect(resolvePandocValueWidget(
            findOptionSpec(FALLBACK_PANDOC_CATALOG, '-M')?.valueAlternatives?.[1]
        )).toMatchObject({
            widgetType: 'keyValueWidget',
            separator: '='
        });
        expect(resolvePandocValueWidget(findOptionSpec(FALLBACK_PANDOC_CATALOG, '-t'))).toMatchObject({
            widgetType: 'formatWidget'
        });
        expect(resolvePandocValueWidget(findOptionSpec(FALLBACK_PANDOC_CATALOG, '-o'))).toMatchObject({
            widgetType: 'outputFileWidget'
        });
        expect(resolvePandocValueWidget(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--resource-path'))).toMatchObject({
            widgetType: 'pathWidget'
        });
        expect(resolvePandocValueWidget(findOptionSpec(FALLBACK_PANDOC_CATALOG, '--eol'))).toMatchObject({
            widgetType: 'selectWidget'
        });
    });

    it('validates formats, integers, and unknown keys', () => {
        const draft = {
            id: 'bad',
            name: 'Bad',
            type: 'pandoc' as const,
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [
                { id: 'one', key: '--columns', value: 'wide', enabled: true },
                { id: 'two', key: '--not-real', value: '', enabled: true },
                { id: 'three', key: '--to', value: 'docx', enabled: true }
            ],
            customCommandTemplate: '',
            customShell: false
        };

        expect(validateProfileDraft(draft, FALLBACK_PANDOC_CATALOG)).toEqual(expect.arrayContaining([
            expect.objectContaining({ severity: 'error', rowId: 'one' }),
            expect.objectContaining({ severity: 'warning', rowId: 'two' })
        ]));
    });

    it('warns when manually added core options override built-in rows', () => {
        const draft = {
            id: 'duplicates',
            name: 'Duplicates',
            type: 'pandoc' as const,
            extension: '.html',
            from: '',
            to: '',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [
                { id: 'input', key: 'input file', value: '${currentPath}', enabled: true, role: 'input' as const },
                { id: 'from', key: '-f', value: 'markdown', enabled: true },
                { id: 'to', key: '-t', value: 'html', enabled: true },
                { id: 'output', key: '-o', value: '${outputPath}', enabled: true },
                { id: 'from-duplicate', key: '--from', value: 'html', enabled: true },
                { id: 'to-duplicate', key: '--write', value: 'plain', enabled: true },
                { id: 'output-duplicate', key: '--output', value: '${outputDir}/other.txt', enabled: true }
            ],
            customCommandTemplate: '',
            customShell: false
        };

        expect(validateProfileDraft(draft, FALLBACK_PANDOC_CATALOG)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'warning',
                rowId: 'from-duplicate',
                message: expect.stringContaining('later value wins')
            }),
            expect.objectContaining({
                severity: 'warning',
                rowId: 'to-duplicate',
                message: expect.stringContaining('later value wins')
            }),
            expect.objectContaining({
                severity: 'warning',
                rowId: 'output-duplicate',
                message: expect.stringContaining('later value wins')
            })
        ]));
    });

    it('does not warn for supported path template variables', () => {
        const draft = {
            id: 'paths',
            name: 'Paths',
            type: 'pandoc' as const,
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [
                { id: 'known', key: '--resource-path', value: '${currentDir}', enabled: true },
                { id: 'unknown', key: '--data-dir', value: '${missingDir}', enabled: true }
            ],
            customCommandTemplate: '',
            customShell: false
        };

        const issues = validateProfileDraft(draft, FALLBACK_PANDOC_CATALOG);

        expect(issues).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ rowId: 'known' })
        ]));
        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'warning',
                rowId: 'unknown',
                message: expect.stringContaining('missingDir')
            })
        ]));
    });

    it('does not warn for file values on hybrid enum options', () => {
        const draft = {
            id: 'hybrid',
            name: 'Hybrid',
            type: 'pandoc' as const,
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [
                { id: 'highlight', key: '--syntax-highlighting', value: '${pluginDir}/theme.theme', enabled: true }
            ],
            customCommandTemplate: '',
            customShell: false
        };

        expect(validateProfileDraft(draft, FALLBACK_PANDOC_CATALOG)).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                rowId: 'highlight',
                message: expect.stringContaining('not a known value')
            })
        ]));
    });

    it('accepts runtime env variables when they are part of the template context', () => {
        const draft = {
            id: 'paths',
            name: 'Paths',
            type: 'pandoc' as const,
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [
                { id: 'input', key: 'input file', value: '${currentPath}', enabled: true, role: 'input' as const },
                { id: 'from', key: '-f', value: 'markdown', enabled: true },
                { id: 'to', key: '-t', value: 'html', enabled: true },
                { id: 'output', key: '-o', value: '${PEM_OUTPUT_DIR}/note.html', enabled: true }
            ],
            customCommandTemplate: '',
            customShell: false
        };

        expect(validateProfileDraft(draft, FALLBACK_PANDOC_CATALOG))
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ rowId: 'output', message: expect.stringContaining('PEM_OUTPUT_DIR') })
            ]));
        expect(validateProfileDraft(draft, FALLBACK_PANDOC_CATALOG, [
            ...Object.keys(variables),
            'PEM_OUTPUT_DIR'
        ])).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ rowId: 'output' })
        ]));
    });

    it('round-trips a default profile through the draft model', () => {
        const profile = DEFAULT_EXPORT_PROFILES.find(item => item.id === 'docx');
        expect(profile?.type).toBe('pandoc');
        if (profile?.type !== 'pandoc') return;

        const draft = createProfileDraft(profile);
        const compiled = compileProfileDraft(draft, FALLBACK_PANDOC_CATALOG);
        const fromRow = draft.optionRows.find(row => row.key === '-f');
        const toRow = draft.optionRows.find(row => row.key === '-t');

        expect(compiled).toMatchObject({
            ...profile,
            inputPath: '${currentPath}',
            outputPath: '${outputDir}/${currentFileName}${outputExtension}'
        });
        expect(fromRow?.value).toBe('${fromFormat}');
        expect(toRow?.value).toBe(profile.to);
        expect(validateProfileDraft(draft, FALLBACK_PANDOC_CATALOG)).toEqual([]);
        expect(draft.optionRows.map(row => row.key)).toEqual(expect.arrayContaining([
            'input file',
            '-f',
            '-t',
            '-o',
            '--resource-path',
            '-L'
        ]));
        expect(draft.optionRows.map(row => row.key)).not.toContain('-s');
        expect(buildPandocProfileArgs({ profile: compiled, variables })).toEqual(
            buildPandocProfileArgs({ profile, variables })
        );
    });

    it('builds a quoted command preview with resolved variables from a draft', () => {
        const preview = buildProfileDraftPreview({
            id: 'html',
            name: 'HTML',
            type: 'pandoc',
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: true,
            resourcePaths: ['${currentDir}'],
            luaFilters: [],
            metadata: { title: 'My note' },
            optionRows: [{ id: 'toc', key: '--toc', value: '', enabled: true }],
            customCommandTemplate: '',
            customShell: false
        }, FALLBACK_PANDOC_CATALOG, variables);

        expect(preview.tokens).toEqual(expect.arrayContaining([
            'pandoc',
            '/vault/note.md',
            '-f',
            'markdown',
            '-t',
            'html',
            '--resource-path',
            '/vault',
            '--toc'
        ]));
        expect(preview.display).not.toContain('${');
        expect(preview.display).toContain('pandoc');
    });

    it('compiles colon-separated metadata rows from the command builder', () => {
        const compiled = compileProfileDraft({
            id: 'html',
            name: 'HTML',
            type: 'pandoc',
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [
                { id: 'title', key: '--metadata', value: 'title:My note', enabled: true }
            ],
            customCommandTemplate: '',
            customShell: false
        }, FALLBACK_PANDOC_CATALOG);

        expect(compiled).toMatchObject({
            metadata: { title: 'My note' }
        });
    });

    it('uses parsed equals syntax for long option values in command previews', () => {
        const preview = buildProfileDraftPreview({
            id: 'html',
            name: 'HTML',
            type: 'pandoc',
            extension: '.html',
            from: 'markdown',
            to: 'html',
            standalone: false,
            resourcePaths: [],
            luaFilters: [],
            metadata: {},
            optionRows: [
                { id: 'tabs', key: '--preserve-tabs', value: 'false', enabled: true },
                { id: 'header', key: '-H', value: 'header.html', enabled: true },
                { id: 'long-header', key: '--include-in-header', value: 'header-url', enabled: true }
            ],
            customCommandTemplate: '',
            customShell: false
        }, FALLBACK_PANDOC_CATALOG, variables);

        expect(preview.tokens).toEqual(expect.arrayContaining([
            '--preserve-tabs=false',
            '-H',
            'header.html',
            '--include-in-header=header-url'
        ]));
        expect(preview.tokens).not.toEqual(expect.arrayContaining(['--preserve-tabs', 'false']));
    });

    it('quotes Windows path tokens without doubling path separators', () => {
        const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
        Object.defineProperty(process, 'platform', { value: 'win32' });

        try {
            expect(quoteToken('C:\\Users\\Scott\\My Note.md')).toBe('"C:\\Users\\Scott\\My Note.md"');
            expect(quoteToken('C:\\Images;D:\\Shared')).toBe('"C:\\Images;D:\\Shared"');
        } finally {
            Object.defineProperty(process, 'platform', descriptor ?? { value: 'linux' });
        }
    });
});

function normalizePandocOptionsSource(text: string): string {
    const lines = text.split(/\r?\n/);
    const chunks: string[] = [];
    let currentDescriptionIndex: number | undefined;

    for (const line of lines) {
        if (line.trim() === 'EXIT CODES') break;
        if (line.trim().length === 0) {
            currentDescriptionIndex = undefined;
            continue;
        }
        if (line.trim() === 'OPTIONS') {
            chunks.push('OPTIONS');
            currentDescriptionIndex = undefined;
            continue;
        }
        if (isFixtureSectionHeading(line) || isFixtureOptionSignature(line)) {
            chunks.push(line.trim());
            currentDescriptionIndex = undefined;
            continue;
        }

        const normalized = normalizeFixtureLine(line);
        const bullet = normalized.match(/^•\s*(.*)$/);
        if (bullet) {
            chunks.push(`• ${bullet[1]}`);
            currentDescriptionIndex = chunks.length - 1;
            continue;
        }
        if (currentDescriptionIndex === undefined) {
            chunks.push(normalized);
            currentDescriptionIndex = chunks.length - 1;
        } else {
            chunks[currentDescriptionIndex] = normalizeFixtureLine(
                `${chunks[currentDescriptionIndex]} ${normalized}`
            );
        }
    }

    return chunks.join('\n');
}

function normalizeFixtureValueSyntax(valueSyntax: string | undefined): string | undefined {
    if (!valueSyntax) return undefined;
    return expandFixtureOptionalValueSyntax(valueSyntax.replace(/^=/, '').trim()) || undefined;
}

function normalizeFixtureValueSeparator(valueSyntax: string | undefined): 'space' | 'equals' | undefined {
    if (!valueSyntax) return undefined;
    return valueSyntax.startsWith('=') || valueSyntax.startsWith('[=') ? 'equals' : 'space';
}

function expandFixtureOptionalValueSyntax(valueSyntax: string): string {
    const wholeOptional = valueSyntax.match(/^\[(.*)\]$/);
    if (wholeOptional) {
        return joinFixtureValueSyntax(
            'NONE',
            expandFixtureOptionalValueSyntax(wholeOptional[1].replace(/^=/, ''))
        );
    }
    if (/^=?\[?true\|false\]?$/.test(valueSyntax)) return 'BOOLEAN';
    const optionalSuffix = valueSyntax.match(/^(.+)\[([^\]]+)\]$/);
    if (optionalSuffix) {
        return joinFixtureValueSyntax(
            expandFixtureOptionalValueSyntax(optionalSuffix[1]),
            expandFixtureOptionalValueSyntax(`${optionalSuffix[1]}${optionalSuffix[2]}`)
        );
    }
    return valueSyntax;
}

function joinFixtureValueSyntax(...values: string[]): string {
    return Array.from(new Set(values.filter(Boolean))).join('|');
}

function runtimeOutputForArgs(args: string[]): string {
    const command = args.join(' ');
    if (command === '--version') return 'pandoc 3.6.0\n';
    if (command === '--help') {
        return '--syntax-highlighting=default|none|idiomatic|STYLE|FILE\n';
    }
    if (command === '--list-input-formats') return 'markdown\n';
    if (command === '--list-output-formats') return 'html\n';
    if (command === '--list-highlight-styles') return 'pygments\nsolarized\n';
    return '';
}

function pandocResult(args: string[], stdout: string) {
    return {
        executable: 'pandoc',
        args,
        exitCode: 0,
        signal: null,
        stdout,
        stderr: '',
        timedOut: false,
        durationMs: 0,
        ok: true
    };
}

function isFixtureSectionHeading(line: string): boolean {
    return /^\s{3}\S/.test(line) && !isFixtureOptionSignature(line);
}

function isFixtureOptionSignature(line: string): boolean {
    if (!/^\s{5,}-/.test(line)) return false;
    return splitFixtureSignature(line.trim())
        .every(part => /^-{1,2}[A-Za-z0-9][A-Za-z0-9-]*(?:\s+\S+|=\S+|\[[^\]]+\])?$/.test(part));
}

function splitFixtureSignature(signature: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < signature.length; index += 1) {
        const char = signature[index];
        if (char === '[') depth += 1;
        if (char === ']') depth = Math.max(0, depth - 1);
        if (char === ',' && depth === 0) {
            parts.push(signature.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(signature.slice(start).trim());
    return parts.filter(Boolean);
}

function normalizeFixtureLine(line: string): string {
    return line
        .trim()
        .replace(/[\u00ad\u2010]\s+/g, '')
        .replace(/\s+/g, ' ');
}
