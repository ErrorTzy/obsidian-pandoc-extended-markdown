import {
    PandocPreviewFormatRegistry
} from './registry';
import {
    createDocxPreviewFormatModule
} from './formats/docx';
import {
    createEpubPreviewFormatModule
} from './formats/epub';
import {
    createHtmlPreviewFormatModule
} from './formats/html';
import {
    createOdtPreviewFormatModule
} from './formats/odt';
import {
    createPdfPreviewFormatModule
} from './formats/pdf';
import {
    createPptxPreviewFormatModule
} from './formats/pptx';
import {
    createTextPreviewFormatModule
} from './formats/text';
import {
    createUnsupportedPreviewFormatModule
} from './formats/unsupported';

export function createDefaultPandocPreviewFormatRegistry(): PandocPreviewFormatRegistry {
    const registry = new PandocPreviewFormatRegistry();
    registry.register(createOdtPreviewFormatModule());
    registry.register(createHtmlPreviewFormatModule());
    registry.register(createTextPreviewFormatModule());
    registry.register(createPdfPreviewFormatModule());
    registry.register(createDocxPreviewFormatModule());
    registry.register(createEpubPreviewFormatModule());
    registry.register(createPptxPreviewFormatModule());
    registry.register(createUnsupportedPreviewFormatModule());

    return registry;
}
