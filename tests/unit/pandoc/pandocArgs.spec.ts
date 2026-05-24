import { describe, expect, it } from '@jest/globals';

import { buildPandocConvertArgs } from '../../../src/pandoc';

describe('buildPandocConvertArgs', () => {
    it('builds a minimal conversion command', () => {
        expect(buildPandocConvertArgs({
            inputPath: '/vault/note.md',
            from: 'markdown',
            to: 'html'
        })).toEqual([
            '/vault/note.md',
            '-f',
            'markdown',
            '-t',
            'html'
        ]);
    });

    it('adds output, standalone, resource paths, filters, metadata, and extra args', () => {
        expect(buildPandocConvertArgs({
            inputPath: '/vault/note.md',
            from: 'markdown+wikilinks_title_after_pipe',
            to: 'html',
            outputPath: '/exports/note.html',
            standalone: true,
            resourcePaths: ['/vault', '/vault/assets'],
            luaFilters: ['/plugin/lua_filter/FencedDivExtendedSyntax.lua'],
            metadata: { title: 'Note' },
            extraArgs: ['--embed-resources']
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
            'title=Note',
            '--embed-resources'
        ]);
    });
});
