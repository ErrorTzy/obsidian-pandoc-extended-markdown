import { describe, expect, it } from '@jest/globals';

import {
    buildPandocProfileArgs,
    DEFAULT_EXPORT_PROFILES
} from '../../../src/pandoc';
import {
    buildProfileDraftPreview,
    compileProfileDraft,
    FALLBACK_PANDOC_CATALOG,
    parsePandocHelp,
    parsePandocManPage,
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

    it('validates formats, integers, unknown keys, and first-class duplicates', () => {
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
            expect.objectContaining({ severity: 'warning', rowId: 'two' }),
            expect.objectContaining({ severity: 'warning', rowId: 'three' })
        ]));
    });

    it('round-trips a default profile through the draft model', () => {
        const profile = DEFAULT_EXPORT_PROFILES.find(item => item.id === 'docx');
        expect(profile?.type).toBe('pandoc');
        if (profile?.type !== 'pandoc') return;

        const compiled = compileProfileDraft(
            {
                id: profile.id,
                name: profile.name,
                type: 'pandoc',
                extension: profile.extension,
                from: profile.from ?? '',
                to: profile.to,
                standalone: profile.standalone ?? false,
                resourcePaths: profile.resourcePaths ?? [],
                luaFilters: profile.luaFilters ?? [],
                metadata: profile.metadata ?? {},
                optionRows: [],
                customCommandTemplate: '',
                customShell: false
            },
            FALLBACK_PANDOC_CATALOG
        );

        expect(compiled).toEqual(profile);
        expect(buildPandocProfileArgs({ profile: compiled, variables })).toEqual(
            buildPandocProfileArgs({ profile, variables })
        );
    });

    it('builds a quoted command preview from a draft', () => {
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
        }, FALLBACK_PANDOC_CATALOG);

        expect(preview.tokens).toEqual(expect.arrayContaining([
            'pandoc',
            '-f',
            'markdown',
            '-t',
            'html',
            '--toc'
        ]));
        expect(preview.display).toContain('pandoc');
    });
});
