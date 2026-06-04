import { describe, expect, it } from '@jest/globals';

import {
    selectPreviewRendererPlan
} from '../../../src/pandoc/core';

describe('selectPreviewRendererPlan', () => {
    it('selects preview renderer plans from format and extension', () => {
        expect(selectPreviewRendererPlan('html', '.html').kind).toBe('html');
        expect(selectPreviewRendererPlan('latex', '.tex').kind).toBe('text');
        expect(selectPreviewRendererPlan('docx', '.docx').kind).toBe('docx');
        expect(selectPreviewRendererPlan('epub3', '.epub').kind).toBe('epub');
        expect(selectPreviewRendererPlan('unknown', '.bin').kind).toBe('unsupported');
    });

    it('selects the ODT add-on only when installed and enabled', () => {
        expect(selectPreviewRendererPlan('odt', '.odt', {
            enabled: true,
            status: 'installed',
            installPath: '/addons/webodf'
        }).kind).toBe('odt-addon');
        expect(selectPreviewRendererPlan('odt', '.odt', {
            enabled: false,
            status: 'installed',
            installPath: '/addons/webodf'
        }).kind).toBe('odt-pandoc-fallback');
    });
});
