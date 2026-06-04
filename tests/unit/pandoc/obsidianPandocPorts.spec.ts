import { describe, expect, it, jest } from '@jest/globals';

import {
    normalizePandocExportSettings
} from '../../../src/pandoc';
import {
    ObsidianPandocUserInteractionPort
} from '../../../src/pandoc/gui/obsidian/notices';
import {
    ObsidianPandocWorkspacePort
} from '../../../src/pandoc/gui/obsidian/workspace';

function createApp() {
    return {
        vault: {
            adapter: {
                getBasePath: () => '/vault',
                getFullPath: (path: string) => `/vault/${path}`
            },
            config: {
                attachmentFolderPath: 'assets',
                useMarkdownLinks: false
            },
            configDir: '.obsidian'
        },
        metadataCache: {
            getCache: (path: string) => path === 'folder/note.md' ? {
                frontmatter: { title: 'Note' },
                embeds: [{ link: 'image.png' }]
            } : null,
            getFirstLinkpathDest: () => ({
                path: 'assets/image.png',
                name: 'image.png',
                basename: 'image'
            })
        },
        workspace: {
            getActiveFile: () => ({
                path: 'folder/note.md',
                name: 'note.md',
                basename: 'note'
            })
        }
    } as any;
}

describe('ObsidianPandocWorkspacePort', () => {
    it('adapts vault paths, plugin paths, frontmatter, embeds, and variables', async () => {
        const settings = normalizePandocExportSettings({
            defaultOutputFolderMode: 'current'
        });
        const port = new ObsidianPandocWorkspacePort({
            app: createApp(),
            manifest: {
                id: 'pandoc-extended-markdown',
                dir: '.obsidian/plugins/pem'
            } as any,
            settings
        });

        await expect(port.vaultPath()).resolves.toBe('/vault');
        await expect(port.pluginPath()).resolves.toBe('/vault/.obsidian/plugins/pem');
        await expect(port.currentFile()).resolves.toEqual({
            path: 'folder/note.md',
            name: 'note.md',
            basename: 'note'
        });
        await expect(port.readFrontmatter('folder/note.md')).resolves.toEqual({ title: 'Note' });
        await expect(port.resolveEmbeds('folder/note.md')).resolves.toEqual([{
            sourcePath: 'folder/note.md',
            targetPath: '/vault/assets/image.png'
        }]);
        await expect(port.attachmentFolder('folder/note.md')).resolves.toBe('/vault/assets');
        expect(port.defaultOutputFolder('folder/note.md')).toBe('/vault/folder');

        expect(port.exportVariables({
            currentFilePath: 'folder/note.md',
            currentFileName: 'note.md',
            currentFileBaseName: 'note'
        }, '/exports/note.html', ':')).toMatchObject({
            currentPath: '/vault/folder/note.md',
            pluginDir: '/vault/.obsidian/plugins/pem',
            attachmentFolderPath: '/vault/assets',
            embedDirs: '/vault/assets',
            metadata: { title: 'Note' }
        });
    });

    it('persists through the injected settings callback', async () => {
        const saveSettings = jest.fn(async () => undefined);
        const settings = normalizePandocExportSettings();
        const port = new ObsidianPandocWorkspacePort({
            app: createApp(),
            manifest: { id: 'pandoc-extended-markdown' } as any,
            settings,
            saveSettings
        });

        await port.saveSettings(settings);

        expect(saveSettings).toHaveBeenCalledWith(settings);
    });
});

describe('ObsidianPandocUserInteractionPort', () => {
    it('delegates file actions to the desktop adapter', async () => {
        const desktop = {
            chooseFolder: jest.fn(async () => '/exports'),
            confirmOverwrite: jest.fn(async path => path.replace('.html', '-copy.html')),
            openPath: jest.fn(async () => undefined),
            revealPath: jest.fn(async () => undefined)
        };
        const port = new ObsidianPandocUserInteractionPort({ desktop });

        await expect(port.chooseFolder({})).resolves.toBe('/exports');
        await expect(port.confirmOverwrite('/exports/note.html'))
            .resolves.toBe('/exports/note-copy.html');
        await port.openOutput('/exports/note.html');
        await port.revealOutput('/exports/note.html');

        expect(desktop.openPath).toHaveBeenCalledWith('/exports/note.html');
        expect(desktop.revealPath).toHaveBeenCalledWith('/exports/note.html');
    });

    it('uses an injected notice factory for progress and status messages', () => {
        const updates: string[] = [];
        const closed: string[] = [];
        const notices: Array<{ message: string; timeout?: number }> = [];
        const port = new ObsidianPandocUserInteractionPort({
            createNotice: (message, timeout) => {
                notices.push({ message, timeout });
                return {
                    hide: () => closed.push(message),
                    setMessage: nextMessage => updates.push(nextMessage)
                };
            }
        });

        const progress = port.showProgress('Exporting...');
        progress.update('Still exporting...');
        progress.close();
        port.showError('Export failed.');
        port.showSuccess('Exported.');

        expect(notices).toEqual([
            { message: 'Exporting...', timeout: 0 },
            { message: 'Export failed.', timeout: 8000 },
            { message: 'Exported.', timeout: undefined }
        ]);
        expect(updates).toEqual(['Still exporting...']);
        expect(closed).toEqual(['Exporting...']);
    });
});
