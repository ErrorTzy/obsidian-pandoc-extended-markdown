import { describe, expect, it } from '@jest/globals';

import {
    buildPandocEnv,
    buildPandocProfileArgs,
    buildTemplateVariableContext,
    DEFAULT_EXPORT_PROFILES,
    normalizePandocExportSettings,
    splitCommandLineArgs
} from '../../../src/pandoc';
import type { ExportVariables, PandocExportProfile } from '../../../src/pandoc/core/export/types';

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
    it.each([undefined, []])('automatically applies bundled syntax to Markdown profiles with filters %j', luaFilters => {
        const profile: PandocExportProfile = {
            id: 'saved', name: 'Saved', type: 'pandoc', to: 'html', extension: '.html',
            from: 'markdown-smart+wikilinks_title_after_pipe', luaFilters
        };
        const before = JSON.stringify(profile);
        const args = buildPandocProfileArgs({ profile, variables });
        expect(args[2]).toBe('/plugin/lua_filter/CustomLabelReader.lua-smart+wikilinks_title_after_pipe');
        expect(args).toContain('--preserve-tabs');
        expect(args.filter(arg => arg === '--lua-filter')).toHaveLength(2);
        expect(args).toEqual(expect.arrayContaining([
            '/plugin/lua_filter/FencedDivExtendedSyntax.lua',
            '/plugin/lua_filter/CustomLabelList.lua'
        ]));
        expect(JSON.stringify(profile)).toBe(before);
    });

    it('does not apply bundled syntax automatically to other readers', () => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'html', name: 'HTML input', type: 'pandoc', to: 'docx', extension: '.docx',
                from: 'html', luaFilters: ['/custom/filter.lua']
            }, variables
        });
        expect(args[2]).toBe('html');
        expect(args.filter(arg => arg === '--lua-filter')).toHaveLength(1);
        expect(args).not.toContain('--preserve-tabs');
    });

    it('applies bundled filters only once when already configured', () => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'html', name: 'HTML', type: 'pandoc', to: 'html', extension: '.html',
                luaFilters: ['${luaFilterDir}/FencedDivExtendedSyntax.lua', '${luaFilterDir}/CustomLabelList.lua']
            }, variables
        });
        expect(args.filter(arg => arg === '/plugin/lua_filter/FencedDivExtendedSyntax.lua')).toHaveLength(1);
        expect(args.filter(arg => arg === '/plugin/lua_filter/CustomLabelList.lua')).toHaveLength(1);
    });

    it.each(['FencedDivExtendedSyntax.lua', 'CustomLabelList.lua'])
    ('keeps the bundled processing order when only %s is configured', file => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'html', name: 'HTML', type: 'pandoc', to: 'html', extension: '.html',
                luaFilters: [`${variables.luaFilterDir}/${file}`]
            }, variables
        });
        expect(args.indexOf('/plugin/lua_filter/FencedDivExtendedSyntax.lua'))
            .toBeLessThan(args.indexOf('/plugin/lua_filter/CustomLabelList.lua'));
    });

    it.each([
        ['--lua-filter', '${luaFilterDir}/CustomLabelList.lua'],
        ['--lua-filter=${luaFilterDir}/CustomLabelList.lua'],
        ['-L', '${luaFilterDir}/CustomLabelList.lua'],
        ['-L${luaFilterDir}/CustomLabelList.lua']
    ])('does not repeat a bundled filter configured in extra args %j', (...extraArgs) => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'html', name: 'HTML', type: 'pandoc', to: 'html', extension: '.html', extraArgs
            }, variables
        });
        expect(args.filter(arg => arg.includes('/plugin/lua_filter/CustomLabelList.lua'))).toHaveLength(1);
        expect(args).toContain('/plugin/lua_filter/FencedDivExtendedSyntax.lua');
    });

    it('adds the label filter after a fenced-div filter supplied in export extra args', () => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'html', name: 'HTML', type: 'pandoc', to: 'html', extension: '.html'
            }, variables, extraArgs: ['--lua-filter=/plugin/lua_filter/FencedDivExtendedSyntax.lua']
        });
        expect(args.filter(arg => arg.includes('FencedDivExtendedSyntax.lua'))).toHaveLength(1);
        expect(args.indexOf('--lua-filter=/plugin/lua_filter/FencedDivExtendedSyntax.lua'))
            .toBeLessThan(args.indexOf('/plugin/lua_filter/CustomLabelList.lua'));
    });

    it('automatically selects the source-aware reader for saved bundled-filter profiles', () => {
        const profile: PandocExportProfile = {
            id: 'saved', name: 'Saved', type: 'pandoc', to: 'html', extension: '.html',
            from: 'markdown-smart+wikilinks_title_after_pipe',
            luaFilters: ['${luaFilterDir}/CustomLabelList.lua']
        };
        const before = JSON.stringify(profile);
        const args = buildPandocProfileArgs({ profile, variables });
        expect(args[2]).toBe('/plugin/lua_filter/CustomLabelReader.lua-smart+wikilinks_title_after_pipe');
        expect(args).toContain('--preserve-tabs');
        expect(JSON.stringify(profile)).toBe(before);
    });

    it.each(['html', 'commonmark', '/custom/reader.lua'])('retains an explicit %s reader', from => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'saved', name: 'Saved', type: 'pandoc', to: 'html', extension: '.html',
                from, luaFilters: ['${luaFilterDir}/CustomLabelList.lua']
            }, variables
        });
        expect(args[2]).toBe(from);
        expect(args).not.toContain('--preserve-tabs');
    });

    it('keeps unrelated custom filters alongside the bundled syntax filters', () => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'custom', name: 'Custom', type: 'pandoc', to: 'html', extension: '.html',
                luaFilters: ['/custom/CustomLabelList.lua']
            }, variables
        });
        expect(args).toContain('/custom/CustomLabelList.lua');
        expect(args).toContain('/plugin/lua_filter/CustomLabelList.lua');
        expect(args[2]).toBe('/plugin/lua_filter/CustomLabelReader.lua+wikilinks_title_after_pipe');
    });

    it('keeps an explicit reader override in extra arguments', () => {
        const args = buildPandocProfileArgs({
            profile: {
                id: 'saved', name: 'Saved', type: 'pandoc', to: 'html', extension: '.html',
                luaFilters: ['${luaFilterDir}/CustomLabelList.lua']
            }, variables, extraArgs: ['--from=html']
        });
        expect(args.at(-1)).toBe('--from=html');
    });

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

    it('keeps an explicit saved profile list instead of re-adding deleted defaults', () => {
        const settings = normalizePandocExportSettings({
            profiles: [{
                id: 'html',
                name: 'HTML',
                type: 'pandoc',
                to: 'html',
                extension: '.html'
            }]
        });

        expect(settings.profiles.map(profile => profile.id)).toEqual(['html']);
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
            '/plugin/lua_filter/CustomLabelReader.lua+wikilinks_title_after_pipe',
            '-t',
            'html',
            '--preserve-tabs',
            '-o',
            '/exports/note.html',
            '--standalone',
            '--resource-path',
            '/vault',
            '--resource-path',
            '/vault/assets',
            '--lua-filter',
            '/plugin/lua_filter/FencedDivExtendedSyntax.lua',
            '--lua-filter',
            '/plugin/lua_filter/CustomLabelList.lua',
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

    it('resolves outputExtension from the output format for editable output rows', () => {
        const profile: PandocExportProfile = {
            id: 'markdown',
            name: 'Markdown',
            type: 'pandoc',
            to: 'markdown',
            extension: '.html',
            outputPath: '${outputDir}/${currentFileName}${outputExtension}'
        };

        expect(buildPandocProfileArgs({ profile, variables })).toEqual([
            '/vault/note.md',
            '-f',
            '/plugin/lua_filter/CustomLabelReader.lua+wikilinks_title_after_pipe',
            '-t',
            'markdown',
            '--preserve-tabs',
            '-o',
            '/exports/note.md',
            '--lua-filter',
            '/plugin/lua_filter/FencedDivExtendedSyntax.lua',
            '--lua-filter',
            '/plugin/lua_filter/CustomLabelList.lua'
        ]);
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

    it('merges injected platform defaults, user env, and runtime variables', () => {
        const env = buildPandocEnv({
            TEXINPUTS: '${pluginDir}/tex:',
            CUSTOM_OUT: '${outputPath}'
        }, variables, {
            PATH: '/opt/homebrew/bin:${PATH}'
        }, {
            HOME: '/home/test',
            PATH: '/usr/bin'
        });

        expect(env.TEXINPUTS).toBe('/plugin/tex:');
        expect(env.CUSTOM_OUT).toBe('/exports/note.html');
        expect(env.HOME).toBe('/home/test');
        expect(env.PATH).toBe('/opt/homebrew/bin:/usr/bin');
    });

    it('resolves opted-in runtime env variables in profile arguments', () => {
        const profile: PandocExportProfile = {
            id: 'html',
            name: 'HTML',
            type: 'pandoc',
            to: 'html',
            extension: '.html',
            resourcePaths: ['${PEM_RESOURCE_DIR}', '${currentDir}']
        };
        const context = buildTemplateVariableContext(variables, {
            includeRuntimeEnv: true,
            runtimeEnv: {
                PEM_RESOURCE_DIR: '/env/resources',
                currentDir: '/env/current'
            }
        });

        expect(buildPandocProfileArgs({
            profile,
            variables: context.variables
        })).toEqual(expect.arrayContaining([
            '--resource-path',
            '/env/resources',
            '--resource-path',
            '/vault'
        ]));
    });

    it('does not read runtime env variables when no env map is injected', () => {
        try {
            process.env.PEM_RUNTIME_RESOURCE_DIR = '/runtime/resources';
            const context = buildTemplateVariableContext(variables, {
                includeRuntimeEnv: true
            });

            expect(context.runtimeEnvNames).not.toContain('PEM_RUNTIME_RESOURCE_DIR');
            expect(context.variables.PEM_RUNTIME_RESOURCE_DIR).toBeUndefined();
        } finally {
            delete process.env.PEM_RUNTIME_RESOURCE_DIR;
        }
    });

    it('splits quoted extra argument strings', () => {
        expect(splitCommandLineArgs('--metadata title="My note" --toc')).toEqual([
            '--metadata',
            'title=My note',
            '--toc'
        ]);
    });
});
