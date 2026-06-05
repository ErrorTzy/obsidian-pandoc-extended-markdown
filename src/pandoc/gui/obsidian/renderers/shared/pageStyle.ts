import type {
    PreviewPageSize
} from '../previewPageMetadata';

export function applyPageSizeStyle(element: HTMLElement, pageSize: PreviewPageSize): void {
    element.style.setProperty('--pem-pandoc-page-width', `${pageSize.widthPx}px`);
    element.style.setProperty('--pem-pandoc-page-height', `${pageSize.heightPx}px`);
    element.style.aspectRatio = `${pageSize.widthPx} / ${pageSize.heightPx}`;
}
