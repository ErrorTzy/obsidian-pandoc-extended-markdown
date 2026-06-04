import type { PandocOptionCatalog } from '../../../src/pandoc/core';
import { FALLBACK_PANDOC_CATALOG } from '../../../src/pandoc/core';

export const FORMAT_EXTENSION_FIXTURE_CATALOG: PandocOptionCatalog = {
    ...FALLBACK_PANDOC_CATALOG,
    markdownExtensions: [
        'fenced_divs',
        'footnotes',
        'wikilinks_title_after_pipe',
        'wikilinks_title_before_pipe'
    ],
    extensionDescriptions: {
        ...FALLBACK_PANDOC_CATALOG.extensionDescriptions,
        wikilinks_title_after_pipe: 'Supports URL-first wikilinks.',
        wikilinks_title_before_pipe: 'Supports title-first wikilinks.'
    },
    formatExtensions: {
        markdown: [
            { name: 'fenced_divs', defaultEnabled: true, description: 'Allows fenced Div blocks.' },
            { name: 'footnotes', defaultEnabled: true, description: 'Allows footnotes.' },
            { name: 'wikilinks_title_after_pipe', defaultEnabled: false, description: 'Supports URL-first wikilinks.' },
            { name: 'wikilinks_title_before_pipe', defaultEnabled: false, description: 'Supports title-first wikilinks.' }
        ],
        commonmark_x: [
            { name: 'attributes', defaultEnabled: true },
            { name: 'fenced_divs', defaultEnabled: true },
            { name: 'wikilinks_title_after_pipe', defaultEnabled: false }
        ]
    }
};
