import { describe, expect, it } from '@jest/globals';

import {
    buildExportVariables,
    buildPreviewExportVariables,
    renderExportTemplate
} from '../../../src/pandoc';

describe('export variables', () => {
    it('resolves vault, current file, output, plugin, filter, attachment, and embed paths', () => {
        const variables = buildExportVariables({
            vault: {
                adapter: {
                    getBasePath: () => '/vault',
                    getFullPath: path => `/vault/${path}`
                },
                config: {
                    attachmentFolderPath: 'assets',
                    useMarkdownLinks: false
                }
            },
            metadataCache: {
                getCache: () => ({
                    frontmatter: { title: 'Note' },
                    embeds: [{ link: 'image.png' }]
                }),
                getFirstLinkpathDest: () => ({ path: 'assets/image.png' })
            },
            currentFile: {
                path: 'folder/note.md',
                name: 'note.md',
                basename: 'note'
            },
            outputPath: '/exports/note.html',
            pluginDir: '/vault/.obsidian/plugins/pandoc-extended-markdown'
        });

        expect(variables).toMatchObject({
            vaultDir: '/vault',
            pluginDir: '/vault/.obsidian/plugins/pandoc-extended-markdown',
            luaFilterDir: '/vault/.obsidian/plugins/pandoc-extended-markdown/lua_filter',
            currentPath: '/vault/folder/note.md',
            currentDir: '/vault/folder',
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
        });
    });

    it('uses simple placeholders and preserves unknown variables', () => {
        expect(renderExportTemplate('${outputPath} ${missing}', {
            outputPath: '/tmp/out.pdf'
        })).toBe('/tmp/out.pdf ${missing}');
    });

    it('renders Windows-style environment paths literally', () => {
        expect(renderExportTemplate('${HOME}', {
            HOME: 'C:\\Users\\Admin'
        })).toBe('C:\\Users\\Admin');
    });

    it('does not evaluate JavaScript expression templates', () => {
        const template = 'pandoc ${ options.textemplate ? `--template="${options.textemplate}"` : `` }';

        expect(renderExportTemplate(template, {
            options: { textemplate: 'dissertation.tex' }
        })).toBe(template);
    });

    it('resolves relative attachment folders from the current file directory', () => {
        const variables = buildExportVariables({
            vault: {
                adapter: {
                    getBasePath: () => '/vault',
                    getFullPath: path => `/vault/${path}`
                },
                config: {
                    attachmentFolderPath: './attachments'
                }
            },
            currentFile: {
                path: 'folder/note.md',
                name: 'note.md',
                basename: 'note'
            },
            outputPath: '/exports/note.html',
            pluginDir: '/plugin'
        });

        expect(variables.attachmentFolderPath).toBe('/vault/folder/attachments');
    });

    it('builds copyable preview variables from the active file and output settings', () => {
        const variables = buildPreviewExportVariables({
            app: {
                vault: {
                    adapter: {
                        getBasePath: () => '/vault',
                        getFullPath: (path: string) => `/vault/${path}`
                    },
                    config: {
                        attachmentFolderPath: 'assets'
                    }
                },
                metadataCache: {
                    getCache: () => null,
                    getFirstLinkpathDest: () => null
                },
                workspace: {
                    getActiveFile: () => ({
                        path: 'folder/note.md',
                        name: 'note.md',
                        basename: 'note'
                    })
                }
            } as any,
            manifest: {
                id: 'pandoc-extended-markdown',
                dir: '.obsidian/plugins/pandoc-extended-markdown'
            } as any,
            settings: {
                defaultOutputFolderMode: 'custom',
                customOutputFolder: 'exports'
            } as any,
            extension: '.html'
        });

        expect(variables).toMatchObject({
            currentPath: '/vault/folder/note.md',
            currentDir: '/vault/folder',
            outputPath: '/vault/exports/note.html',
            outputDir: '/vault/exports',
            pluginDir: '/vault/.obsidian/plugins/pandoc-extended-markdown',
            luaFilterDir: '/vault/.obsidian/plugins/pandoc-extended-markdown/lua_filter',
            attachmentFolderPath: '/vault/assets'
        });
    });
});
