interface NativeDefinitionOwnershipPlan {
    item: HTMLLIElement;
    kind: 'canonical' | 'raw';
    ownedPrefix: Node[];
}

export interface NativeDefinitionReconciliationOptions {
    root: HTMLElement;
    replacement: HTMLElement;
    sourceLine: number;
    usedCandidates: Set<HTMLElement>;
    getTextWithLineBreaks: (nodes: Node[]) => string;
    matchesCanonicalList: (list: HTMLElement) => boolean;
    matchesRawDefinition: (text: string) => boolean;
}

/**
 * Replace only the source-owned definition prefix of a native list item.
 * Later block children belong to the containing list item and must retain identity.
 */
export function reconcileNativeListDefinition(
    options: NativeDefinitionReconciliationOptions
): boolean {
    const plans = getOwnershipPlans(options);
    const sourceMatched = plans.filter(plan =>
        Number(plan.item.dataset.line) === options.sourceLine
    );
    const plan = sourceMatched.length === 1
        ? sourceMatched[0]
        : plans.length === 1 ? plans[0] : null;
    if (!plan) {
        return false;
    }

    if (plan.kind === 'canonical') {
        options.usedCandidates.add(plan.item);
        return true;
    }
    if (!canApplyRawOwnershipPlan(plan, options.replacement)) {
        return false;
    }

    plan.item.insertBefore(options.replacement, plan.ownedPrefix[0]);
    plan.ownedPrefix.forEach(node => plan.item.removeChild(node));
    options.usedCandidates.add(plan.item);
    return true;
}

function getOwnershipPlans(
    options: NativeDefinitionReconciliationOptions
): NativeDefinitionOwnershipPlan[] {
    return getNativeListItems(options.root)
        .filter(item => !options.usedCandidates.has(item))
        .map(item => getOwnershipPlan(item, options))
        .filter((plan): plan is NativeDefinitionOwnershipPlan => plan !== null);
}

function getNativeListItems(root: HTMLElement): HTMLLIElement[] {
    const items = Array.from(root.querySelectorAll<HTMLLIElement>('li'));
    if (root.matches('li')) {
        items.unshift(root as HTMLLIElement);
    }
    return items.filter(item => item.parentElement?.matches('ul, ol'));
}

function getOwnershipPlan(
    item: HTMLLIElement,
    options: NativeDefinitionReconciliationOptions
): NativeDefinitionOwnershipPlan | null {
    const canonicalList = Array.from(item.children).find(child =>
        child.tagName === 'DL' && options.matchesCanonicalList(child as HTMLElement)
    );
    if (canonicalList) {
        return { item, kind: 'canonical', ownedPrefix: [] };
    }

    const nodes = Array.from(item.childNodes);
    for (let end = 1; end <= nodes.length; end++) {
        const ownedPrefix = nodes.slice(0, end);
        if (options.matchesRawDefinition(
            options.getTextWithLineBreaks(ownedPrefix)
        )) {
            return { item, kind: 'raw', ownedPrefix };
        }
    }
    return null;
}

function canApplyRawOwnershipPlan(
    plan: NativeDefinitionOwnershipPlan,
    replacement: HTMLElement
): boolean {
    return plan.ownedPrefix.length > 0 &&
        plan.ownedPrefix.every(node => node.parentNode === plan.item) &&
        !replacement.parentNode;
}
