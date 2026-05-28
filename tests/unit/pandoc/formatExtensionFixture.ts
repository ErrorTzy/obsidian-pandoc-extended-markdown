import type { PandocOptionCatalog } from '../../../src/pandoc/gui-core';
import { FALLBACK_PANDOC_CATALOG } from '../../../src/pandoc/gui-core';

export const FORMAT_EXTENSION_FIXTURE_CATALOG: PandocOptionCatalog = {
    ...FALLBACK_PANDOC_CATALOG,
    markdownExtensions: [
        'fenced_divs',
        'footnotes',
        'wikilinks_title_after_pipe',
        'wikilinks_title_before_pipe'
    ],
    formatExtensions: {
        markdown: [
            { name: 'fenced_divs', defaultEnabled: true },
            { name: 'footnotes', defaultEnabled: true },
            { name: 'wikilinks_title_after_pipe', defaultEnabled: false },
            { name: 'wikilinks_title_before_pipe', defaultEnabled: false }
        ],
        commonmark_x: [
            { name: 'attributes', defaultEnabled: true },
            { name: 'fenced_divs', defaultEnabled: true },
            { name: 'wikilinks_title_after_pipe', defaultEnabled: false }
        ]
    }
};
