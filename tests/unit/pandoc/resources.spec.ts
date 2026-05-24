import { describe, expect, it, jest } from '@jest/globals';

import { releaseBundledPandocLuaFilters } from '../../../src/pandoc/resources';

describe('Pandoc Lua filter resources', () => {
    it('writes bundled filters into the plugin lua_filter directory', async () => {
        const adapter = {
            exists: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
            mkdir: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
            write: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
        };

        await releaseBundledPandocLuaFilters({
            app: {
                vault: { adapter }
            } as any,
            manifest: {
                id: 'pandoc-extended-markdown',
                dir: '.obsidian/plugins/pandoc-extended-markdown'
            } as any
        });

        expect(adapter.mkdir).toHaveBeenCalledWith(
            '.obsidian/plugins/pandoc-extended-markdown/lua_filter'
        );
        expect(adapter.write).toHaveBeenCalledWith(
            '.obsidian/plugins/pandoc-extended-markdown/lua_filter/CustomLabelList.lua',
            '-- mocked lua filter'
        );
        expect(adapter.write).toHaveBeenCalledWith(
            '.obsidian/plugins/pandoc-extended-markdown/lua_filter/FencedDivExtendedSyntax.lua',
            '-- mocked lua filter'
        );
    });
});
