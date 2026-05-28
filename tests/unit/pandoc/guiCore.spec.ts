import { describe, expect, it } from '@jest/globals';

import {
    buildPandocProfileArgs,
    DEFAULT_EXPORT_PROFILES
} from '../../../src/pandoc';
import {
    buildProfileDraftPreview,
    compileProfileDraft,
    createProfileDraft,
    FALLBACK_OPTIONS,
    FALLBACK_PANDOC_CATALOG,
    findOptionSpec,
    getFormatExtensionChoices,
    mergeOptionSpecs,
    parseExtensionListOutput,
    parsePandocFormatValue,
    parsePandocHelp,
    parsePandocManPage,
    quoteToken,
    searchOptionKeys,
    searchOptions,
    validateProfileDraft
} from '../../../src/pandoc/gui-core';
import { ExportVariables } from '../../../src/pandoc/types';
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

describe('pandoc GUI core', () => {
    it('parses option keys and value placeholders from pandoc help', () => {
        const options = parsePandocHelp(`
  -f FORMAT, -r FORMAT  --from=FORMAT, --read=FORMAT
  -s                    --standalone
                        --columns=NUMBER
                        --eol=crlf|lf|native
                        --toc[=true|false], --table-of-contents[=true|false]
`);

        expect(options).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: '--from',
                aliases: expect.arrayContaining(['-f', '-r', '--read']),
                valueKind: 'format'
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
                valueKind: 'none'
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
                key: '--output',
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

        expect(options.map(option => option.key)).toEqual(['--to', '--resource-path']);
        expect(findOptionSpec({
            ...FALLBACK_PANDOC_CATALOG,
            options
        }, '-t')).toMatchObject({
            key: '--to',
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
    });

    it('parses pandoc extension lists with default inclusion state', () => {
        expect(parseExtensionListOutput(`
+footnotes
-wikilinks_title_after_pipe
ignored
`)).toEqual([
            { name: 'footnotes', defaultEnabled: true },
            { name: 'wikilinks_title_after_pipe', defaultEnabled: false }
        ]);
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
                editable: true
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
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, 'table of contents')[0].option.key).toBe('--toc');
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, 'table contents')).toHaveLength(0);
        expect(searchOptions(FALLBACK_PANDOC_CATALOG, 'table contents', 20, true)[0].option.key).toBe('--toc');
    });

    it('autosuggests by option keys only', () => {
        expect(searchOptionKeys(FALLBACK_PANDOC_CATALOG, 'fr')[0].option.key).toBe('-f');
        expect(searchOptionKeys(FALLBACK_PANDOC_CATALOG, 'table contents')).toHaveLength(0);
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
