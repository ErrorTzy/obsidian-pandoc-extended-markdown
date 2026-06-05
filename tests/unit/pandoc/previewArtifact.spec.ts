import { describe, expect, it } from '@jest/globals';

import {
    createDefaultPandocPreviewFormatRegistry,
    PandocPreviewFormatRegistry,
    selectPreviewRendererPlan
} from '../../../src/pandoc/core';
import type {
    PandocPreviewFormatModule
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

describe('PandocPreviewFormatRegistry', () => {
    it('selects default preview pipelines for supported formats', () => {
        const registry = createDefaultPandocPreviewFormatRegistry();

        expect(registry.select({ to: 'html', extension: '.html' }).formatId).toBe('html');
        expect(registry.select({ to: 'revealjs', extension: '.html' }).formatId).toBe('html');
        expect(registry.select({ to: 'latex', extension: '.tex' }).formatId).toBe('text');
        expect(registry.select({ to: 'pdf', extension: '.pdf' }).formatId).toBe('pdf');
        expect(registry.select({ to: 'docx', extension: '.docx' }).formatId).toBe('docx');
        expect(registry.select({ to: 'epub3', extension: '.epub' }).formatId).toBe('epub');
        expect(registry.select({ to: 'pptx', extension: '.pptx' }).formatId).toBe('pptx');
        expect(registry.select({ to: 'odt', extension: '.odt' }).formatId).toBe('odt');
        expect(registry.select({ to: 'unknown', extension: '.bin' }).formatId).toBe('unsupported');
    });

    it('preserves module ordering and uses the final fallback module', () => {
        const registry = new PandocPreviewFormatRegistry();
        registry.register(formatModule('first', () => true));
        registry.register(formatModule('second', () => true));

        expect(registry.select({ to: 'any', extension: '.any' }).formatId).toBe('first');

        const fallbackRegistry = new PandocPreviewFormatRegistry();
        fallbackRegistry.register(formatModule('specific', request => request.normalizedFormat === 'specific'));
        fallbackRegistry.register(formatModule('fallback', () => true));

        expect(fallbackRegistry.select({ to: 'unknown', extension: '.bin' }).formatId).toBe('fallback');
    });
});

function formatModule(
    id: string,
    match: PandocPreviewFormatModule['match']
): PandocPreviewFormatModule {
    return {
        id,
        match,
        createPipeline: () => ({
            formatId: id,
            stages: []
        }),
        createRendererPlan: () => ({
            kind: 'unsupported',
            label: id
        })
    };
}
