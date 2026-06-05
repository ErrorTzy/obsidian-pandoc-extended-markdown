import type {
    ObsidianPandocPreviewRendererModule
} from './types';

export class ObsidianPandocPreviewRendererRegistry {
    private readonly renderers = new Map<string, ObsidianPandocPreviewRendererModule>();

    register(renderer: ObsidianPandocPreviewRendererModule): void {
        this.renderers.set(renderer.id, renderer);
    }

    get(rendererId: string): ObsidianPandocPreviewRendererModule | undefined {
        return this.renderers.get(rendererId);
    }
}
