import {
    joinPath
} from '../../utils/pathUtils';
import type {
    PandocPreviewFormatModule
} from '../types';
import {
    createArtifact
} from './helpers';

export function createChunkedHtmlPreviewFormatModule(): PandocPreviewFormatModule {
    return {
        id: 'chunkedhtml',
        match: request => request.normalizedFormat === 'chunkedhtml',
        createPipeline: () => ({
            formatId: 'chunkedhtml',
            stages: [{
                id: 'chunkedhtml:index',
                createArtifact: async ({ outputPath }) => createArtifact({
                    formatId: 'chunkedhtml',
                    kind: 'html',
                    label: 'Chunked HTML preview',
                    rendererId: 'html',
                    metadata: {
                        previewNotice: 'Showing the generated index.html entry page.'
                    }
                }, joinPath(outputPath, 'index.html'), outputPath)
            }]
        }),
        createRendererPlan: () => ({
            formatId: 'chunkedhtml',
            kind: 'html',
            label: 'Chunked HTML preview',
            rendererId: 'html',
            metadata: {
                previewNotice: 'Showing the generated index.html entry page.'
            }
        })
    };
}
