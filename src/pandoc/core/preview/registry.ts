import type {
    OdtPreviewAddonSettings
} from '../export/types';
import type {
    PandocPreviewFormatModule,
    PandocPreviewMatchRequest,
    PandocPreviewPipeline,
    PandocPreviewRendererPlan
} from './types';

export class PandocPreviewFormatRegistry {
    private readonly modules: PandocPreviewFormatModule[] = [];

    register(module: PandocPreviewFormatModule): void {
        this.modules.push(module);
    }

    select(request: {
        to: string;
        extension: string;
        odtAddon?: OdtPreviewAddonSettings;
    }): PandocPreviewPipeline {
        const matchRequest = createMatchRequest(request);
        return this.selectModule(matchRequest).createPipeline(matchRequest);
    }

    selectRendererPlan(request: {
        to: string;
        extension: string;
        odtAddon?: OdtPreviewAddonSettings;
    }): PandocPreviewRendererPlan {
        const matchRequest = createMatchRequest(request);
        return this.selectModule(matchRequest).createRendererPlan(matchRequest);
    }

    private selectModule(request: PandocPreviewMatchRequest): PandocPreviewFormatModule {
        const module = this.modules.find(candidate => candidate.match(request));
        if (!module) {
            throw new Error('Pandoc preview registry has no matching fallback module.');
        }

        return module;
    }
}

export function createMatchRequest(request: {
    to: string;
    extension: string;
    odtAddon?: OdtPreviewAddonSettings;
}): PandocPreviewMatchRequest {
    return {
        ...request,
        normalizedFormat: stripFormatExtensions(request.to),
        normalizedExtension: normalizePreviewArtifactExtension(request.extension)
    };
}

function stripFormatExtensions(format: string): string {
    return format.toLowerCase().split(/[+-]/)[0];
}

function normalizePreviewArtifactExtension(extension: string): string {
    return extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}
