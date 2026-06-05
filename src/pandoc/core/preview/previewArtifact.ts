import type {
    OdtPreviewAddonSettings
} from '../export/types';
import type {
    PandocPreviewArtifact
} from '../ports';
import {
    createDefaultPandocPreviewFormatRegistry
} from './defaultRegistry';
import {
    createArtifact as createRegistryArtifact
} from './formats/helpers';
import type {
    PandocPreviewRendererKind,
    PandocPreviewRendererPlan
} from './types';

export type {
    PandocPreviewRendererKind,
    PandocPreviewRendererPlan
} from './types';

export function selectPreviewRendererPlan(
    toFormat: string,
    extension: string,
    odtAddon?: OdtPreviewAddonSettings
): PandocPreviewRendererPlan {
    return createDefaultPandocPreviewFormatRegistry().selectRendererPlan({
        to: toFormat,
        extension,
        odtAddon
    });
}

export function createPreviewArtifact(
    renderer: PandocPreviewRendererPlan,
    filePath: string,
    sourcePath?: string
): PandocPreviewArtifact {
    return createRegistryArtifact(renderer, filePath, sourcePath);
}

export function isPandocPreviewRendererKind(
    value: string
): value is PandocPreviewRendererKind {
    return [
        'html',
        'text',
        'pdf',
        'docx',
        'epub',
        'pptx',
        'odt-addon',
        'odt-pandoc-fallback',
        'unsupported'
    ].includes(value);
}
