import { describe, expect, it } from '@jest/globals';

import {
    buildPandocEnv,
    buildPandocProfileArgs,
    DEFAULT_EXPORT_PROFILES,
    splitCommandLineArgs
} from '../../../src/pandoc';
import { ExportVariables, PandocExportProfile } from '../../../src/pandoc/types';

const variables: ExportVariables = {
    vaultDir: '/vault',
    pluginDir: '/plugin',
    luaFilterDir: '/plugin/lua_filter',
    currentPath: '/vault/note.md',
    currentDir: '/vault',
    currentFileName: 'note',
    currentFileFullName: 'note.md',
    outputPath: '/exports/note.html',
    outputDir: '/exports',
    outputFileName: 'note',
    outputFileFullName: 'note.html',
    attachmentFolderPath: '/vault/assets',
    embedDirs: '/vault/assets',
    fromFormat: 'markdown+wikilinks_title_after_pipe',
    metadata: { title: 'Note' }
};

describe('export profiles', () => {
    it('ships the reference plugin core export formats as default profiles', () => {
        expect(DEFAULT_EXPORT_PROFILES.map(profile => profile.name)).toEqual([
            'Markdown',
            'Markdown Hugo',
            'HTML',
            'TextBundle',
            'Typst',
            'PDF',
            'DOCX',
            'ODT',
            'RTF',
            'EPUB',
            'LaTeX',
            'MediaWiki',
            'reStructuredText',
            'Textile',
            'OPML',
            'Bibliography',
            'PPTX'
        ]);
    });

    it('builds argument arrays with paths, filters, metadata, and extra args', () => {
        const profile: PandocExportProfile = {
            id: 'html',
            name: 'HTML',
            type: 'pandoc',
            to: 'html',
            extension: '.html',
            standalone: true,
            resourcePaths: ['${currentDir}', '${attachmentFolderPath}'],
            luaFilters: ['${luaFilterDir}/FencedDivExtendedSyntax.lua'],
            metadata: { title: '${currentFileName}' },
            extraArgs: ['--embed-resources']
        };

        expect(buildPandocProfileArgs({
            profile,
            variables,
            extraArgs: ['--toc']
        })).toEqual([
            '/vault/note.md',
            '-f',
            'markdown+wikilinks_title_after_pipe',
            '-t',
            'html',
            '-o',
            '/exports/note.html',
            '--standalone',
            '--resource-path',
            '/vault',
            '--resource-path',
            '/vault/assets',
            '--lua-filter',
            '/plugin/lua_filter/FencedDivExtendedSyntax.lua',
            '--metadata',
            'title=note',
            '--embed-resources',
            '--toc'
        ]);
    });

    it('lets TextBundle profiles override the output argument', () => {
        const profile = DEFAULT_EXPORT_PROFILES.find(item => item.id === 'textbundle');

        expect(profile?.type).toBe('pandoc');
        if (profile?.type !== 'pandoc') return;

        const args = buildPandocProfileArgs({ profile, variables });

        expect(args.filter(arg => arg === '-o')).toHaveLength(1);
        expect(args).toContain('/exports/note.textbundle/text.md');
        expect(args).not.toContain('/exports/note.html');
    });

    it('includes bundled plugin syntax filters in Pandoc defaults', () => {
        const profile = DEFAULT_EXPORT_PROFILES.find(item => item.id === 'docx');

        expect(profile?.type).toBe('pandoc');
        if (profile?.type !== 'pandoc') return;

        const args = buildPandocProfileArgs({ profile, variables });

        expect(args).toEqual(expect.arrayContaining([
            '--lua-filter',
            '/plugin/lua_filter/FencedDivExtendedSyntax.lua',
            '--lua-filter',
            '/plugin/lua_filter/CustomLabelList.lua'
        ]));
    });

    it('merges platform defaults, user env, and runtime variables', () => {
        const env = buildPandocEnv({
            TEXINPUTS: '${pluginDir}/tex:',
            CUSTOM_OUT: '${outputPath}'
        }, variables);

        expect(env.TEXINPUTS).toBe('/plugin/tex:');
        expect(env.CUSTOM_OUT).toBe('/exports/note.html');
        expect(env.PATH).toBeDefined();
    });

    it('splits quoted extra argument strings', () => {
        expect(splitCommandLineArgs('--metadata title="My note" --toc')).toEqual([
            '--metadata',
            'title=My note',
            '--toc'
        ]);
    });
});
