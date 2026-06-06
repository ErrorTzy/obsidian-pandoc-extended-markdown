import { describe, expect, it } from '@jest/globals';
import { App, Platform } from 'obsidian';

import { DEFAULT_SETTINGS } from '../../../src/core/settings';
import { registerPandocExportCommands } from '../../../src/pandoc/gui/obsidian/commands/registerPandocCommands';

describe('registerPandocExportCommands', () => {
    it('skips desktop commands on mobile', () => {
        const original = Platform.isDesktop;
        Platform.isDesktop = false;
        const plugin = {
            app: new App(),
            manifest: { id: 'pandoc-extended-markdown' },
            settings: { ...DEFAULT_SETTINGS },
            saveSettings: jest.fn(),
            addCommand: jest.fn(),
            registerEvent: jest.fn()
        } as any;

        registerPandocExportCommands(plugin, {} as never);

        expect(plugin.addCommand).not.toHaveBeenCalled();
        Platform.isDesktop = original;
    });
});
