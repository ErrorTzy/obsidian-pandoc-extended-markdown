import { PreviewPager } from './previewControls';
import {
    DEFAULT_ODT_PAGE_SIZE,
    extractOdtPageSizes,
    pageSizeAt,
    type PreviewPageSize
} from './previewPageMetadata';
import type {
    ObsidianPandocPreviewRenderRequest
} from './types';
import {
    renderOdtInWebOdfFrame
} from './previewOdtFrameSource';

export async function renderOdtAddonPreview(
    request: ObsidianPandocPreviewRenderRequest
): Promise<void> {
    const installPath = request.artifact.addonInstallPath;
    if (!installPath) {
        throw new Error('ODT preview add-on path is missing.');
    }

    const script = await readWebOdfScript(installPath, request.artifact.addonVersion, request.readText);
    const data = await request.readBinary(request.artifact.filePath);
    const pageSize = pageSizeAt(extractOdtPageSizes(data), 0, DEFAULT_ODT_PAGE_SIZE);
    let pager: PreviewPager;
    let frame: HTMLIFrameElement;
    const showPage = (pageIndex: number) => {
        if (!frame) return;
        frame.contentWindow?.postMessage({
            token: frame.dataset.pemOdtToken,
            type: 'set-page',
            pageIndex
        }, '*');
    };
    pager = new PreviewPager(request.container, { onPageChange: showPage });
    frame = pager.stage.createEl('iframe', {
        cls: 'pem-pandoc-scrollable-page pem-pandoc-odt-preview',
        attr: {
            sandbox: 'allow-scripts allow-same-origin',
            title: 'Odt preview'
        }
    });
    applyPageSizeStyle(frame, pageSize);
    frame.style.width = `${pageSize.widthPx}px`;
    frame.style.height = `${pageSize.heightPx}px`;
    pager.refreshFit();

    const message = await renderOdtInWebOdfFrame(frame, script, data, pageSize);
    frame.dataset.pemOdtToken = message.token;
    pager.setPageCount(message.pageCount);
    showPage(pager.currentPageIndex);
}

function applyPageSizeStyle(element: HTMLElement, pageSize: PreviewPageSize): void {
    element.style.setProperty('--pem-pandoc-page-width', `${pageSize.widthPx}px`);
    element.style.setProperty('--pem-pandoc-page-height', `${pageSize.heightPx}px`);
    element.style.aspectRatio = `${pageSize.widthPx} / ${pageSize.heightPx}`;
}

function webOdfScriptCandidates(installPath: string, version?: string): string[] {
    const candidates = version ?
        [`${installPath}/webodf.js-${version}/webodf.js`] :
        [];
    return [...candidates, `${installPath}/webodf.js`];
}

async function readWebOdfScript(
    installPath: string,
    version: string | undefined,
    readText: (path: string) => Promise<string>
): Promise<{ source: string; path: string }> {
    const errors: string[] = [];
    for (const scriptPath of webOdfScriptCandidates(installPath, version)) {
        try {
            return {
                source: await readText(scriptPath),
                path: scriptPath
            };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }
    }
    throw new Error(`Failed to load WebODF add-on. ${errors.join(' ')}`);
}
