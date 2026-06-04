export interface PreviewFitScaleOptions {
    availableWidth: number;
    availableHeight: number;
    contentWidth: number;
    contentHeight: number;
}

export function calculateViewportFitScale(options: PreviewFitScaleOptions): number {
    const availableWidth = finitePositive(options.availableWidth);
    const availableHeight = finitePositive(options.availableHeight);
    const contentWidth = finitePositive(options.contentWidth);
    const contentHeight = finitePositive(options.contentHeight);
    if (!availableWidth || !availableHeight || !contentWidth || !contentHeight) return 1;

    return Math.max(0.01, Math.min(availableWidth / contentWidth, availableHeight / contentHeight));
}

function finitePositive(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
}
