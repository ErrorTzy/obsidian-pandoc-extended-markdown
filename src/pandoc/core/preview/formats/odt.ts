import type {
    OdtPreviewAddonSettings
} from '../../export/types';
import type {
    PandocPreviewFormatModule,
    PandocPreviewRendererPlan
} from '../types';
import {
    createArtifact
} from './helpers';

export const ODT_FALLBACK_PREVIEW_NOTICE =
    'This preview is a fallback. Download odt support in plugin settings for the recommended renderer.';

export function createOdtPreviewFormatModule(): PandocPreviewFormatModule {
    return {
        id: 'odt',
        match: request => request.normalizedExtension === '.odt' ||
            request.normalizedFormat === 'odt',
        createPipeline: request => ({
            formatId: 'odt',
            stages: [
                {
                    id: 'odt:webodf',
                    continueOnRenderError: true,
                    createArtifact: async ({ outputPath }) => {
                        if (!isWebOdfAvailable(request.odtAddon)) return undefined;
                        return createArtifact(webOdfPlan(request.odtAddon), outputPath);
                    }
                },
                {
                    id: 'odt:pandoc-html-fallback',
                    createArtifact: async ({ run, outputPath, exportManager, session }) => {
                        const fallbackPath = await session.createTempFile(run, '.html');
                        const result = await exportManager.convertPreviewFile(
                            outputPath,
                            fallbackPath,
                            'html',
                            undefined,
                            ['--standalone', '--embed-resources']
                        );
                        if (!result.ok) {
                            throw new Error(result.error ?? 'ODT fallback preview failed.');
                        }
                        if (!session.isCurrentRun(run)) return undefined;

                        return createArtifact(fallbackPlan(), fallbackPath, outputPath);
                    }
                }
            ]
        }),
        createRendererPlan: request => isWebOdfAvailable(request.odtAddon) ?
            webOdfPlan(request.odtAddon) :
            fallbackPlan()
    };
}

function webOdfPlan(odtAddon: OdtPreviewAddonSettings | undefined): PandocPreviewRendererPlan {
    return {
        kind: 'odt-addon',
        formatId: 'odt',
        rendererId: 'odt-webodf',
        label: 'ODT add-on preview',
        addonInstallPath: odtAddon?.installPath,
        addonVersion: odtAddon?.version
    };
}

function fallbackPlan(): PandocPreviewRendererPlan {
    return {
        kind: 'odt-pandoc-fallback',
        formatId: 'odt',
        rendererId: 'html',
        label: 'ODT fallback preview',
        metadata: {
            previewNotice: ODT_FALLBACK_PREVIEW_NOTICE,
            fallbackFor: 'odt'
        }
    };
}

function isWebOdfAvailable(odtAddon: OdtPreviewAddonSettings | undefined): boolean {
    return Boolean(
        odtAddon?.enabled &&
        odtAddon.status === 'installed' &&
        odtAddon.installPath
    );
}
