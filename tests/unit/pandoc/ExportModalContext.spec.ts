import { describe, expect, it } from '@jest/globals';

import {
    normalizePandocExportSettings
} from '../../../src/pandoc';
import {
    initialOutputFolder
} from '../../../src/pandoc/gui/obsidian/modals/ExportModalContext';

function createPlugin(settings = normalizePandocExportSettings()) {
    return {
        app: {
            vault: {
                adapter: {
                    getBasePath: () => '/vault',
                    getFullPath: (path: string) => `/vault/${path}`
                }
            },
            metadataCache: {}
        },
        manifest: { id: 'pandoc-extended-markdown' },
        settings: { pandocExport: settings },
        saveSettings: async () => undefined
    } as any;
}

const currentFile = {
    path: 'folder/note.md',
    name: 'note.md',
    basename: 'note'
} as any;

describe('ExportModalContext', () => {
    it('initializes the modal output folder from the configured default folder', () => {
        const plugin = createPlugin(normalizePandocExportSettings({
            defaultOutputFolderMode: 'custom',
            customOutputFolder: '/custom-exports',
            lastOutputFolder: '/stale-last-export'
        }));

        expect(initialOutputFolder(plugin, currentFile)).toBe('/custom-exports');
    });

    it('keeps last export folder only when last folder mode is selected', () => {
        const plugin = createPlugin(normalizePandocExportSettings({
            defaultOutputFolderMode: 'last',
            customOutputFolder: '/custom-exports',
            lastOutputFolder: '/last-export'
        }));

        expect(initialOutputFolder(plugin, currentFile)).toBe('/last-export');
    });
});
