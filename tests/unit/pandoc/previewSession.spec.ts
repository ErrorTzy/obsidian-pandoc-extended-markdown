import { describe, expect, it } from '@jest/globals';

import {
    normalizePreviewExtension,
    PandocPreviewSession
} from '../../../src/pandoc/core';

describe('PandocPreviewSession', () => {
    it('normalizes preview extensions', () => {
        expect(normalizePreviewExtension('html')).toBe('.html');
        expect(normalizePreviewExtension('.odt')).toBe('.odt');
        expect(normalizePreviewExtension('')).toBe('.html');
        expect(normalizePreviewExtension('note.preview.html')).toBe('.html');
    });

    it('removes stale preview output and keeps current output tracked', async () => {
        const removed: string[] = [];
        const session = new PandocPreviewSession({
            makeTempPath: async (extension, runId) => `/tmp/preview-${runId}${extension}`,
            removeFile: async path => {
                removed.push(path);
            }
        });

        const stale = await session.beginRun('html');
        const current = await session.beginRun('html');

        expect(await session.removeIfStale(stale)).toBe(true);
        expect(await session.removeIfStale(current)).toBe(false);
        expect(removed).toEqual(['/tmp/preview-1.html']);

        await session.cleanup();

        expect(removed).toEqual([
            '/tmp/preview-1.html',
            '/tmp/preview-2.html'
        ]);
    });
});
