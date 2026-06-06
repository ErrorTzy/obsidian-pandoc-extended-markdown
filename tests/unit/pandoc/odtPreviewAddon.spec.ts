import { createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { zipSync } from 'fflate';

import {
    installOdtPreviewAddon,
    removeOdtPreviewAddon
} from '../../../src/pandoc/gui/obsidian/workspace/odtPreviewAddon';

function sha256(data: Uint8Array): string {
    return createHash('sha256').update(data).digest('hex');
}

describe('ODT preview add-on installer', () => {
    it('installs a verified archive into add-on storage', async () => {
        const archive = zipSync({
            'webodf.js': Buffer.from('window.webodf = {};')
        });
        const written = new Map<string, string>();

        const result = await installOdtPreviewAddon({
            installDir: '/addons',
            url: 'https://example.test/webodf.zip',
            version: 'test',
            expectedSha256: sha256(archive),
            download: async () => archive,
            hash: async data => sha256(data),
            fileSystem: {
                ensureDir: async () => undefined,
                writeFile: async (path, data) => {
                    written.set(path, Buffer.from(data).toString('utf8'));
                },
                removeDir: async () => undefined
            }
        });

        expect(result).toMatchObject({
            enabled: true,
            status: 'installed',
            version: 'test',
            installPath: '/addons/webodf-test'
        });
        expect(written.get('/addons/webodf-test/webodf.js')).toBe('window.webodf = {};');
    });

    it('records a failed state when checksum verification fails', async () => {
        const result = await installOdtPreviewAddon({
            installDir: '/addons',
            version: 'test',
            expectedSha256: 'not-a-real-checksum',
            download: async () => Buffer.from('bad archive'),
            hash: async data => sha256(data),
            fileSystem: {
                ensureDir: async () => undefined,
                writeFile: async () => undefined
            }
        });

        expect(result.status).toBe('failed');
        expect(result.enabled).toBe(false);
        expect(result.lastError).toContain('checksum');
    });

    it('removes installed add-on data', async () => {
        const removed: string[] = [];
        const result = await removeOdtPreviewAddon({
            enabled: true,
            status: 'installed',
            installPath: '/addons/webodf-test'
        }, {
            removeDir: async path => {
                removed.push(path);
            }
        });

        expect(result.status).toBe('not-installed');
        expect(result.enabled).toBe(false);
        expect(removed).toEqual(['/addons/webodf-test']);
    });
});
