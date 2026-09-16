type CurrentRunCheck = () => boolean;

interface PendingFencedDivRun {
    generation: number;
    promise: Promise<void>;
}

const pendingRuns = new WeakMap<HTMLElement, PendingFencedDivRun>();
const generations = new WeakMap<HTMLElement, number>();

export function scheduleCoordinatedFencedDivRun(
    element: HTMLElement,
    run: (isCurrent: CurrentRunCheck) => Promise<void>
): void {
    const root = getCoordinationRoot(element);
    const generation = (generations.get(root) ?? 0) + 1;
    generations.set(root, generation);
    const isCurrent = (): boolean => generations.get(root) === generation;
    const promise = run(isCurrent);
    const state = { generation, promise };
    pendingRuns.set(root, state);

    void promise.finally(() => {
        if (pendingRuns.get(root) === state) {
            pendingRuns.delete(root);
        }
    }).catch(() => undefined);
}

export async function waitForFencedDivRun(element: HTMLElement): Promise<void> {
    const root = getCoordinationRoot(element);
    while (true) {
        const pending = pendingRuns.get(root);
        if (!pending) {
            return;
        }
        try {
            await pending.promise;
        } catch {
            return;
        }
        if (pendingRuns.get(root) === pending || !pendingRuns.has(root)) {
            return;
        }
    }
}

function getCoordinationRoot(element: HTMLElement): HTMLElement {
    return element.closest<HTMLElement>('.markdown-preview-view') ??
        element.closest<HTMLElement>('.markdown-preview-section') ??
        element;
}
