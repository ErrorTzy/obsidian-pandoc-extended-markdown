import { browser } from '@wdio/globals';

export async function ensureActiveFileReadingMode(timeout = 5000): Promise<void> {
    await browser.execute(async () => {
        // @ts-ignore
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const leaf = leaves.find((candidate: { view?: { file?: { path?: string } } }) =>
            candidate.view?.file?.path === activeFile.path
        ) ?? leaves[0];

        if (!leaf) {
            return;
        }

        // @ts-ignore
        app.workspace.setActiveLeaf(leaf, { focus: true });
        await leaf.setViewState({
            type: 'markdown',
            state: {
                file: activeFile.path,
                mode: 'preview',
                source: false
            }
        });
        leaf.view?.previewMode?.rerender?.(true);
        // @ts-ignore
        app.workspace.updateOptions();
    });

    await browser.waitUntil(async () =>
        browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement } }) =>
                candidate.view?.file?.path === activeFile?.path
            );

            return Boolean(leaf?.view?.containerEl?.querySelector('.markdown-preview-view'));
        }),
    {
        timeout,
        timeoutMsg: 'Expected reading mode preview to be visible'
    });

    let lastHtml = '';
    let stableCount = 0;
    await browser.waitUntil(async () =>
        browser.execute(() => {
            // @ts-ignore
            const activeFile = app.workspace.getActiveFile();
            // @ts-ignore
            const leaves = app.workspace.getLeavesOfType('markdown');
            const leaf = leaves.find((candidate: { view?: { file?: { path?: string }, containerEl?: HTMLElement, getViewData?: () => string } }) =>
                candidate.view?.file?.path === activeFile?.path
            );
            const preview = leaf?.view?.containerEl?.querySelector('.markdown-preview-view') as HTMLElement | null;
            const bodyContent = preview?.querySelector(
                '.markdown-preview-sizer > :not(.markdown-preview-pusher):not(.mod-header):not(.mod-footer)'
            );

            return {
                html: preview?.innerHTML ?? '',
                hasContent: !(leaf?.view?.getViewData?.() ?? '').trim() ||
                    Boolean(bodyContent)
            };
        }).then(state => {
            if (!state.hasContent) {
                stableCount = 0;
                lastHtml = state.html;
                return false;
            }

            if (state.html !== lastHtml) {
                stableCount = 0;
                lastHtml = state.html;
                return false;
            }

            stableCount += 1;
            return stableCount >= 2;
        }),
    {
        timeout,
        timeoutMsg: 'Expected reading mode preview content to settle'
    });
}
