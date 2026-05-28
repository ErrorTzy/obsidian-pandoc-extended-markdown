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
    mergeOptionSpecs,
    parsePandocHelp,
    parsePandocManPage,
    quoteToken,
    searchOptionKeys,
    searchOptions,
    validateProfileDraft
} from '../../../src/pandoc/gui-core';
import { ExportVariables } from '../../../src/pandoc/types';

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
                        --columns=NUMBER
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
            })
        ]));
    });

    it('extracts richer descriptions from man page option blocks', () => {
        const options = parsePandocManPage(`
     -o FILE, --output=FILE
          Write output to FILE instead of stdout.

     --data-dir=DIRECTORY
          Specify the user data directory.
`);

        expect(options).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: '--output',
                description: 'Write output to FILE instead of stdout.'
            }),
            expect.objectContaining({
                key: '--data-dir',
                valueKind: 'directory'
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
                        --resource-path=SEARCHPATH
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

        for (const key of ['-f', '-t', '--resource-path', '-L']) {
            const fallback = findOptionSpec(FALLBACK_PANDOC_CATALOG, key);
            const runtime = findOptionSpec(merged, key);
            expect(runtime).toMatchObject({
                valueKind: fallback?.valueKind,
                mapsTo: fallback?.mapsTo
            });
        }
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

        expect(compiled).toEqual(profile);
        expect(draft.optionRows.map(row => row.key)).toEqual(expect.arrayContaining([
            '-f',
            '-t',
            '-s',
            '--resource-path',
            '-L'
        ]));
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
