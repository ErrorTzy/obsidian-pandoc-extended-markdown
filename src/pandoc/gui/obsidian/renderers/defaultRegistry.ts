import {
    createDocxPreviewRenderer
} from './docxRenderer';
import {
    createEpubPreviewRenderer
} from './epubRenderer';
import {
    createHtmlPreviewRenderer
} from './htmlRenderer';
import {
    createOdtWebOdfPreviewRenderer
} from './odtWebOdfRenderer';
import {
    createPdfPreviewRenderer
} from './pdfRenderer';
import {
    createPptxPreviewRenderer
} from './pptxRenderer';
import {
    ObsidianPandocPreviewRendererRegistry
} from './registry';
import {
    createTextPreviewRenderer
} from './textRenderer';
import {
    createUnsupportedPreviewRenderer
} from './unsupportedRenderer';

export function createDefaultObsidianPandocPreviewRendererRegistry():
    ObsidianPandocPreviewRendererRegistry {
    const registry = new ObsidianPandocPreviewRendererRegistry();
    registry.register(createHtmlPreviewRenderer());
    registry.register(createTextPreviewRenderer());
    registry.register(createPdfPreviewRenderer());
    registry.register(createDocxPreviewRenderer());
    registry.register(createEpubPreviewRenderer());
    registry.register(createPptxPreviewRenderer());
    registry.register(createOdtWebOdfPreviewRenderer());
    registry.register(createOdtWebOdfPreviewRenderer('odt-addon'));
    registry.register(createUnsupportedPreviewRenderer());

    return registry;
}
