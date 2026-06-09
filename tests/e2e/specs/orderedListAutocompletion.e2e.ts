import { browser, expect } from '@wdio/globals';

type OrderedListMarkerStyle =
    | 'decimal-period'
    | 'decimal-one-paren'
    | 'lower-alpha-period'
    | 'lower-alpha-one-paren'
    | 'lower-roman-period'
    | 'lower-roman-one-paren'
    | 'upper-alpha-period'
    | 'upper-alpha-one-paren'
    | 'upper-roman-period'
    | 'upper-roman-one-paren';

type UnorderedListMarker = '-' | '+' | '*';

interface OrderedStyleCase {
    style: OrderedListMarkerStyle;
    label: string;
}

interface UnorderedStyleCase {
    marker: UnorderedListMarker;
    label: string;
}

interface HybridRootCase {
    fileId: string;
    rootIsOrdered: boolean;
    rootMarker: (ordinal: number) => string;
    unorderedChildMarker: UnorderedListMarker;
    orderedDescendantStyle: OrderedListMarkerStyle;
}

interface LivePreviewLineState {
    text: string;
    className: string;
    markerText: string;
    markerCount: number;
    markerInlineStart: number | null;
    contentInlineStart: number | null;
    paddingInlineStart: string;
    textIndent: string;
}

const INDENT = '    ';
const DEFAULT_ORDERED_LIST_MARKER_ORDER: OrderedListMarkerStyle[] = [
    'decimal-period',
    'lower-alpha-period',
    'lower-roman-period',
    'upper-alpha-period',
    'upper-roman-period',
    'decimal-one-paren',
    'lower-alpha-one-paren',
    'lower-roman-one-paren',
    'upper-alpha-one-paren',
    'upper-roman-one-paren'
];

const ORDERED_STYLE_CASES: OrderedStyleCase[] = [
    { style: 'decimal-period', label: 'decimal period' },
    { style: 'lower-alpha-period', label: 'lower alpha period' },
    { style: 'lower-roman-period', label: 'lower roman period' },
    { style: 'upper-alpha-period', label: 'upper alpha period' },
    { style: 'upper-roman-period', label: 'upper roman period' },
    { style: 'decimal-one-paren', label: 'decimal parenthesis' },
    { style: 'lower-alpha-one-paren', label: 'lower alpha parenthesis' },
    { style: 'lower-roman-one-paren', label: 'lower roman parenthesis' },
    { style: 'upper-alpha-one-paren', label: 'upper alpha parenthesis' },
    { style: 'upper-roman-one-paren', label: 'upper roman parenthesis' }
];

const UNORDERED_STYLE_CASES: UnorderedStyleCase[] = [
    { marker: '-', label: 'dash unordered' },
    { marker: '+', label: 'plus unordered' },
    { marker: '*', label: 'asterisk unordered' }
];

describe('Ordered list autocompletion behavior', () => {
    before(async () => {
        await browser.reloadObsidian({
            vault: './tests/e2e/vaults/test-vault'
        });

        await configureOrderedListSettings();
    });

    for (const styleCase of ORDERED_STYLE_CASES) {
        describe(`${styleCase.label} root lists`, () => {
            beforeEach(async () => {
                await configureOrderedListSettings();
            });

            it('continues the root level, creates a fresh child level, continues the child level, and returns to root with Enter', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'enter-workflow');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`
                ].join('\n'));
                await placeCursorAtDocumentEnd();

                await pressKey('Enter');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${marker(root, 3)} `
                ].join('\n'));

                await pressKey('Tab');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} `
                ].join('\n'));

                await pressText('child');
                await pressKey('Enter');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${INDENT}${marker(child, 2)} `
                ].join('\n'));

                await pressKey('Enter');
                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${marker(root, 3)} `
                ].join('\n'));
            });

            it('outdents an empty child item to the root level and continues the root ordinal with Shift+Tab', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'shift-tab-empty-child');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(4);

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${marker(root, 3)} `
                ].join('\n'));
            });

            it('outdents a non-empty child item to the root level while preserving content with Shift+Tab', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'shift-tab-non-empty-child');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} child`
                ].join('\n'));
                await placeCursorAtDocumentEnd();

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${marker(root, 3)} child`
                ].join('\n'));
            });

            it('continues an existing target-level child sequence under the same parent when Tab creates a sibling', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'tab-existing-target-sibling');

                await openEditableDocument(path, [
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${marker(root, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(3);

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} child`,
                    `${INDENT}${marker(child, 2)} `
                ].join('\n'));
            });

            it('starts a new child sequence under the current parent instead of continuing an earlier parent subtree', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const path = filePathFor(styleCase, 'tab-current-parent-scope');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} xxx`,
                    `${marker(root, 3)} xxx`,
                    `${marker(root, 4)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(6);

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} xxx`,
                    `${INDENT}${marker(child, 1)} xxx`,
                    `${INDENT}${marker(child, 2)} xxx`,
                    `${marker(root, 3)} xxx`,
                    `${INDENT}${marker(child, 1)} `
                ].join('\n'));
            });

            it('renumbers descendants in a moved subtree when auto-renumber lists is enabled', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const grandchild = nextStyle(child);
                const path = filePathFor(styleCase, 'tab-moved-subtree-renumber-enabled');

                await openEditableDocument(path, [
                    `${marker(root, 1)} parent`,
                    `${marker(root, 2)} mover`,
                    `${INDENT}${marker(child, 5)} child`,
                    `${INDENT}${marker(child, 7)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Tab', 600);

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} mover`,
                    `${INDENT}${INDENT}${marker(grandchild, 1)} child`,
                    `${INDENT}${INDENT}${marker(grandchild, 2)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
            });

            it('keeps descendant ordinals in a moved subtree when auto-renumber lists is disabled', async () => {
                const root = styleCase.style;
                const child = nextStyle(root);
                const grandchild = nextStyle(child);
                const path = filePathFor(styleCase, 'tab-moved-subtree-renumber-disabled');

                await configureOrderedListSettings({ autoRenumberLists: false });
                await openEditableDocument(path, [
                    `${marker(root, 1)} parent`,
                    `${marker(root, 2)} mover`,
                    `${INDENT}${marker(child, 5)} child`,
                    `${INDENT}${marker(child, 7)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Tab', 600);

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} parent`,
                    `${INDENT}${marker(child, 1)} mover`,
                    `${INDENT}${INDENT}${marker(grandchild, 5)} child`,
                    `${INDENT}${INDENT}${marker(grandchild, 7)} child`,
                    `${marker(root, 3)} later`
                ].join('\n'));
            });

            it('preserves the current ordered marker style when ordered marker cycling is disabled', async () => {
                const root = styleCase.style;
                const path = filePathFor(styleCase, 'tab-cycling-disabled');

                await configureOrderedListSettings({ enableOrderedListMarkerCycling: false });
                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    `${marker(root, 1)} xxx`,
                    `${INDENT}${marker(root, 1)} `
                ].join('\n'));
            });

            it('removes an empty top-level ordered marker with Enter', async () => {
                const root = styleCase.style;
                const path = filePathFor(styleCase, 'enter-empty-top-level');

                await openEditableDocument(path, [
                    `${marker(root, 1)} xxx`,
                    `${marker(root, 2)} `
                ].join('\n'));
                await placeCursorAtLineAfterMarker(2);

                await pressKey('Enter');

                expect(await getEditorText()).toBe(`${marker(root, 1)} xxx\n`);
            });

            runHybridNestedListTests({
                fileId: styleCase.style,
                rootIsOrdered: true,
                rootMarker: ordinal => marker(styleCase.style, ordinal),
                unorderedChildMarker: '-',
                orderedDescendantStyle: nextStyle(styleCase.style)
            });

            runLocalCycleOverrideTests(styleCase);
        });
    }

    for (const styleCase of UNORDERED_STYLE_CASES) {
        describe(`${styleCase.label} root lists`, () => {
            beforeEach(async () => {
                await configureOrderedListSettings();
            });

            runHybridNestedListTests({
                fileId: unorderedFileId(styleCase.marker),
                rootIsOrdered: false,
                rootMarker: () => styleCase.marker,
                unorderedChildMarker: styleCase.marker,
                orderedDescendantStyle: DEFAULT_ORDERED_LIST_MARKER_ORDER[0]
            });
        });
    }

    describe('mixed whitespace hybrid lists', () => {
        beforeEach(async () => {
            await configureOrderedListSettings();
        });

        it('keeps decimal child markers aligned after returning from an alpha grandchild', async () => {
            const path = 'ordered-list-autocompletion-decimal-child-after-alpha-grandchild.md';

            await openEditableDocument(path, [
                '- xxx',
                `${INDENT}1. xxx`,
                `${INDENT}2. xxx`,
                `${INDENT}${INDENT}a. xxx`,
                `${INDENT}${INDENT}b. xxx`,
                `${INDENT}3. xxx`,
                `${INDENT}4. xxx`,
                '- xxx'
            ].join('\n'));

            const lines = await waitForLivePreviewLineStates(8);

            expectListMarkersToAlign(lines, [2, 3, 6, 7]);
            expectListContentToAlign(lines, [2, 3, 6, 7]);
            expectMarkerToBeIndentedAfter(lines[4], lines[2]);
            expectMarkerToBeIndentedAfter(lines[5], lines[3]);
        });

        it('returns from an empty ordered grandchild to a tab-indented unordered parent with Enter', async () => {
            const path = 'ordered-list-autocompletion-mixed-whitespace-enter.md';

            await openEditableDocument(path, [
                'a. xxx',
                'b. xxx',
                `${INDENT}- xxx`,
                '\t- xxx',
                `${INDENT}${INDENT}i. xxx`,
                `${INDENT}${INDENT}ii. xxx`,
                `${INDENT}${INDENT}iii. `
            ].join('\n'));
            await placeCursorAtLineAfterMarker(7);

            await pressKey('Enter');

            expect(await getEditorText()).toBe([
                'a. xxx',
                'b. xxx',
                `${INDENT}- xxx`,
                '\t- xxx',
                `${INDENT}${INDENT}i. xxx`,
                `${INDENT}${INDENT}ii. xxx`,
                `${INDENT}- `
            ].join('\n'));
        });

        it('returns from an empty ordered grandchild to a tab-indented unordered parent with Shift+Tab', async () => {
            const path = 'ordered-list-autocompletion-mixed-whitespace-shift-tab.md';

            await openEditableDocument(path, [
                'a. xxx',
                'b. xxx',
                `${INDENT}- xxx`,
                '\t- xxx',
                `${INDENT}${INDENT}i. xxx`,
                `${INDENT}${INDENT}ii. xxx`,
                `${INDENT}${INDENT}iii. `
            ].join('\n'));
            await placeCursorAtLineAfterMarker(7);

            await pressShiftTab();

            expect(await getEditorText()).toBe([
                'a. xxx',
                'b. xxx',
                `${INDENT}- xxx`,
                '\t- xxx',
                `${INDENT}${INDENT}i. xxx`,
                `${INDENT}${INDENT}ii. xxx`,
                `${INDENT}- `
            ].join('\n'));
        });
    });

    describe('depth-map owner model regression guards', () => {
        beforeEach(async () => {
            await configureOrderedListSettings();
        });

        describe('Enter before explicit child or continuation blocks', () => {
            it('inserts a new unordered child before an existing child list', async () => {
                await openDocumentWithCursor('ordered-list-owner-enter-explicit-unordered-child.md', [
                    '1. xxx|',
                    `${INDENT}- xxx`
                ].join('\n'));

                await pressKey('Enter');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- `,
                    `${INDENT}- xxx`
                ].join('\n'));
            });

            it('inserts and renumbers an ordered child before existing ordered children when auto-renumbering is enabled', async () => {
                await openDocumentWithCursor('ordered-list-owner-enter-explicit-ordered-child-renumber-enabled.md', [
                    '1. parent|',
                    `${INDENT}a. child`,
                    `${INDENT}b. child`
                ].join('\n'));

                await pressKey('Enter', 600);

                expect(await getEditorText()).toBe([
                    '1. parent',
                    `${INDENT}a. `,
                    `${INDENT}b. child`,
                    `${INDENT}c. child`
                ].join('\n'));
            });

            it('inserts an ordered child without renumbering existing ordered siblings when auto-renumbering is disabled', async () => {
                await configureOrderedListSettings({ autoRenumberLists: false });
                await openDocumentWithCursor('ordered-list-owner-enter-explicit-ordered-child-renumber-disabled.md', [
                    '1. parent|',
                    `${INDENT}a. child`,
                    `${INDENT}b. child`
                ].join('\n'));

                await pressKey('Enter', 600);

                expect(await getEditorText()).toBe([
                    '1. parent',
                    `${INDENT}a. `,
                    `${INDENT}a. child`,
                    `${INDENT}b. child`
                ].join('\n'));
            });

            it('inserts a blank continuation line before existing continuation text using the exact child indentation', async () => {
                await openDocumentWithCursor('ordered-list-owner-enter-before-continuation.md', [
                    '1. xxx|',
                    '  continuation'
                ].join('\n'));

                await pressKey('Enter');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    '  ',
                    '  continuation'
                ].join('\n'));
            });

            it('splits parent text into continuation text before the existing child block', async () => {
                await openDocumentWithCursor('ordered-list-owner-enter-middle-parent-before-child.md', [
                    '1. ab|cd',
                    `${INDENT}- child`
                ].join('\n'));

                await pressKey('Enter');

                expect(await getEditorText()).toBe([
                    '1. ab',
                    `${INDENT}cd`,
                    `${INDENT}- child`
                ].join('\n'));
            });

            it('splits a direct continuation line without creating a list item', async () => {
                await openDocumentWithCursor('ordered-list-owner-enter-split-continuation.md', [
                    '1. parent',
                    `${INDENT}cont|inuation`,
                    `${INDENT}- child`
                ].join('\n'));

                await pressKey('Enter');

                expect(await getEditorText()).toBe([
                    '1. parent',
                    `${INDENT}cont`,
                    `${INDENT}inuation`,
                    `${INDENT}- child`
                ].join('\n'));
            });

            it('does not split into a child block across a blank line', async () => {
                await openDocumentWithCursor('ordered-list-owner-enter-blank-line-boundary.md', [
                    '1. xxx|',
                    '',
                    `${INDENT}- child`
                ].join('\n'));

                await pressKey('Enter');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    '2. ',
                    '',
                    `${INDENT}- child`
                ].join('\n'));
            });
        });

        describe('Tab owner movement and explicit child context', () => {
            it('moves only the current owner into an explicit child list instead of moving the subtree', async () => {
                await openDocumentWithCursor('ordered-list-owner-tab-explicit-child-no-subtree.md', [
                    '1. xxx',
                    '2. xxx|',
                    `${INDENT}- xxx`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- xxx`,
                    `${INDENT}- xxx`
                ].join('\n'));
            });

            it('moves direct continuations with the owner while leaving nested child items in place', async () => {
                await openDocumentWithCursor('ordered-list-owner-tab-continuation-stays-with-owner.md', [
                    '1. parent',
                    '2. current|',
                    `${INDENT}continuation`,
                    `${INDENT}- child`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. parent',
                    `${INDENT}- current`,
                    `${INDENT}${INDENT}continuation`,
                    `${INDENT}- child`
                ].join('\n'));
            });

            it('moves the owning list item when Tab is pressed from direct continuation text', async () => {
                await openDocumentWithCursor('ordered-list-owner-tab-from-continuation.md', [
                    '1. parent',
                    '2. current',
                    `${INDENT}continu|ation`,
                    `${INDENT}- child`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. parent',
                    `${INDENT}- current`,
                    `${INDENT}${INDENT}continuation`,
                    `${INDENT}- child`
                ].join('\n'));
            });

            it('handles Tab from inside owner text, not only immediately after the marker', async () => {
                await openDocumentWithCursor('ordered-list-owner-tab-from-middle-of-text.md', [
                    '1. parent',
                    '2. cur|rent',
                    `${INDENT}- child`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. parent',
                    `${INDENT}- current`,
                    `${INDENT}- child`
                ].join('\n'));
            });

            it('preserves the moved ordered ordinal while changing marker style when auto-renumbering is disabled', async () => {
                await configureOrderedListSettings({ autoRenumberLists: false });
                await openDocumentWithCursor('ordered-list-owner-tab-preserve-ordinal-renumber-disabled.md', [
                    '1. root',
                    '2. current|',
                    `${INDENT}a. child`
                ].join('\n'));

                await pressKey('Tab', 600);

                expect(await getEditorText()).toBe([
                    '1. root',
                    `${INDENT}b. current`,
                    `${INDENT}a. child`
                ].join('\n'));
            });

            it('uses exact explicit child indentation instead of normalizing to four spaces', async () => {
                await openDocumentWithCursor('ordered-list-owner-tab-two-space-explicit-child-indent.md', [
                    '1. parent',
                    '2. current|',
                    '  - child'
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. parent',
                    '  - current',
                    '  - child'
                ].join('\n'));
            });
        });

        describe('Tab chunk depth-map marker inference', () => {
            it('uses the nearest previous target-depth marker type in the same chunk', async () => {
                await openDocumentWithCursor('ordered-list-depth-map-previous-depth-wins.md', [
                    '1. xxx',
                    `${INDENT}- xxx`,
                    '2. xxx',
                    `${INDENT}a. xxx`,
                    '3. xxx',
                    '4. |'
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- xxx`,
                    '2. xxx',
                    `${INDENT}a. xxx`,
                    '3. xxx',
                    `${INDENT}a. `
                ].join('\n'));
            });

            it('uses the closest following target-depth marker type when no previous target-depth marker exists', async () => {
                await openDocumentWithCursor('ordered-list-depth-map-following-depth-fallback.md', [
                    '1. xxx',
                    '2. |',
                    '3. xxx',
                    `${INDENT}- xxx`,
                    '4. xxx',
                    `${INDENT}* xxx`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- `,
                    '3. xxx',
                    `${INDENT}- xxx`,
                    '4. xxx',
                    `${INDENT}* xxx`
                ].join('\n'));
            });

            it('isolates depth-map marker inference across blank-line chunk boundaries', async () => {
                await openDocumentWithCursor('ordered-list-depth-map-blank-line-chunk-boundary.md', [
                    '1. xxx',
                    `${INDENT}- xxx`,
                    '',
                    '1. xxx',
                    '2. |'
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- xxx`,
                    '',
                    '1. xxx',
                    `${INDENT}a. `
                ].join('\n'));
            });

            it('keeps depth overrides specific to their parsed depth', async () => {
                await openDocumentWithCursor('ordered-list-depth-map-depth-specificity.md', [
                    '1. xxx',
                    `${INDENT}- xxx`,
                    `${INDENT}${INDENT}1. xxx`,
                    `${INDENT}${INDENT}${INDENT}a. xxx`,
                    '2. xxx',
                    '3. |'
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- xxx`,
                    `${INDENT}${INDENT}1. xxx`,
                    `${INDENT}${INDENT}${INDENT}a. xxx`,
                    '2. xxx',
                    `${INDENT}- `
                ].join('\n'));
            });

            it('uses depth rather than parent marker type as the override key', async () => {
                await openDocumentWithCursor('ordered-list-depth-map-parent-type-ignored.md', [
                    '1. ordered',
                    `${INDENT}- child`,
                    '- unordered',
                    `${INDENT}a. child`,
                    '2. |'
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. ordered',
                    `${INDENT}- child`,
                    '- unordered',
                    `${INDENT}a. child`,
                    `${INDENT}a. `
                ].join('\n'));
            });

            it('resumes the configured ordered cycle from the deepest explicit depth override', async () => {
                await openDocumentWithCursor('ordered-list-depth-map-resume-from-deepest-override.md', [
                    '1. root',
                    `${INDENT}- child`,
                    `${INDENT}${INDENT}1. grandchild`,
                    `${INDENT}${INDENT}${INDENT}1. mover|`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. root',
                    `${INDENT}- child`,
                    `${INDENT}${INDENT}1. grandchild`,
                    `${INDENT}${INDENT}${INDENT}${INDENT}a. mover`
                ].join('\n'));
            });

            it('uses ordered marker style evidence without inheriting unrelated ordinal values', async () => {
                await openDocumentWithCursor('ordered-list-depth-map-style-not-ordinal-evidence.md', [
                    '1. first',
                    `${INDENT}7. child`,
                    '2. second',
                    '3. |'
                ].join('\n'));

                await pressKey('Tab', 600);

                expect(await getEditorText()).toBe([
                    '1. first',
                    `${INDENT}7. child`,
                    '2. second',
                    `${INDENT}1. `
                ].join('\n'));
            });
        });

        describe('Shift+Tab owner movement and target depth inference', () => {
            it('uses the chunk depth map for the shallower target depth', async () => {
                await openDocumentWithCursor('ordered-list-owner-shift-tab-depth-map-target.md', [
                    '1. ordered',
                    '- unordered',
                    `${INDENT}a. child|`
                ].join('\n'));

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    '1. ordered',
                    '- unordered',
                    '- child'
                ].join('\n'));
            });

            it('moves the owner and direct continuation when Shift+Tab is pressed from continuation text', async () => {
                await openDocumentWithCursor('ordered-list-owner-shift-tab-from-continuation.md', [
                    '1. root',
                    `${INDENT}a. current`,
                    `${INDENT}${INDENT}continu|ation`,
                    `${INDENT}${INDENT}- child`
                ].join('\n'));

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    '1. root',
                    '2. current',
                    `${INDENT}continuation`,
                    `${INDENT}${INDENT}- child`
                ].join('\n'));
            });

            it('operates on a nested child item itself instead of the outer owner', async () => {
                await openDocumentWithCursor('ordered-list-owner-shift-tab-nested-child-is-owner.md', [
                    '1. root',
                    `${INDENT}a. current`,
                    `${INDENT}${INDENT}continuation`,
                    `${INDENT}${INDENT}- child|`
                ].join('\n'));

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    '1. root',
                    `${INDENT}a. current`,
                    `${INDENT}${INDENT}continuation`,
                    `${INDENT}b. child`
                ].join('\n'));
            });
        });

        describe('selection-based owner movement', () => {
            it('moves every unique owner touched by a selection exactly once', async () => {
                await openDocumentWithSelection('ordered-list-owner-selection-parent-continuation-and-child.md', [
                    '1. xxx',
                    '2. xxx',
                    `${INDENT}x[xx`,
                    `${INDENT}- x]xx`,
                    `${INDENT}- xxx`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- xxx`,
                    `${INDENT}${INDENT}xxx`,
                    `${INDENT}${INDENT}+ xxx`,
                    `${INDENT}- xxx`
                ].join('\n'));
            });

            it('moves an owner selected through continuation text while leaving unselected child owners in place', async () => {
                await openDocumentWithSelection('ordered-list-owner-selection-continuation-only.md', [
                    '1. xxx',
                    '2. xxx',
                    `${INDENT}x[xx]`,
                    `${INDENT}- xxx`
                ].join('\n'));

                await pressKey('Tab');

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- xxx`,
                    `${INDENT}${INDENT}xxx`,
                    `${INDENT}- xxx`
                ].join('\n'));
            });

            it('moves selected parent and child owners together while preserving their relationship', async () => {
                await openDocumentWithSelection('ordered-list-owner-selection-parent-and-child-relationship.md', [
                    '1. xxx',
                    '2. x[xx',
                    `${INDENT}- y]yy`,
                    `${INDENT}${INDENT}a. zzz`
                ].join('\n'));

                await pressKey('Tab', 600);

                expect(await getEditorText()).toBe([
                    '1. xxx',
                    `${INDENT}- xxx`,
                    `${INDENT}${INDENT}a. yyy`,
                    `${INDENT}${INDENT}a. zzz`
                ].join('\n'));
            });

            it('outdents every unique selected owner exactly once with Shift+Tab', async () => {
                await openDocumentWithSelection('ordered-list-owner-selection-shift-tab-parent-continuation-and-child.md', [
                    '- root',
                    `${INDENT}- parent`,
                    `${INDENT}${INDENT}x[xx`,
                    `${INDENT}${INDENT}+ x]xx`,
                    `${INDENT}${INDENT}+ zzz`
                ].join('\n'));

                await pressShiftTab();

                expect(await getEditorText()).toBe([
                    '- root',
                    '- parent',
                    `${INDENT}xxx`,
                    `${INDENT}- xxx`,
                    `${INDENT}${INDENT}+ zzz`
                ].join('\n'));
            });
        });
    });
});

function runHybridNestedListTests(rootCase: HybridRootCase): void {
    it('continues an unordered child level nested under the root with Enter', async () => {
        const path = hybridFilePathFor(rootCase, 'enter-unordered-child');

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`
        ].join('\n'));
        await placeCursorAtDocumentEnd();

        await pressKey('Enter');

        expect(await getEditorText()).toBe([
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} `
        ].join('\n'));

        const lines = await waitForLivePreviewLineStates(4);
        expectRenderedUnorderedListLine(lines[3], rootCase.unorderedChildMarker, 2);
        expectRenderedUnorderedListLine(lines[4], rootCase.unorderedChildMarker, 2);
    });

    it('returns from an empty unordered child to the root level with Enter', async () => {
        const path = hybridFilePathFor(rootCase, 'enter-empty-unordered-child');

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(4);

        await pressKey('Enter');

        expect(await getEditorText()).toBe([
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${rootCase.rootMarker(3)} `
        ].join('\n'));
    });

    it('returns from an empty unordered child to the root level with Shift+Tab', async () => {
        const path = hybridFilePathFor(rootCase, 'shift-tab-empty-unordered-child');

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(4);

        await pressShiftTab();

        expect(await getEditorText()).toBe([
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${rootCase.rootMarker(3)} `
        ].join('\n'));
    });

    it('renders an unordered grandchild nested under an unordered child as a list item', async () => {
        const path = hybridFilePathFor(rootCase, 'render-unordered-grandchild');
        const unorderedGrandchildMarker = nextUnorderedMarker(rootCase.unorderedChildMarker);

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${unorderedGrandchildMarker} xxx`
        ].join('\n'));

        const lines = await waitForLivePreviewLineStates(4);
        expectRenderedUnorderedListLine(lines[3], rootCase.unorderedChildMarker, 2);
        expectRenderedUnorderedListLine(lines[4], unorderedGrandchildMarker, 3);
        expectMarkerToBeIndentedAfter(lines[4], lines[3]);
    });

    it('continues an ordered grandchild nested under an unordered child with Enter', async () => {
        const path = hybridFilePathFor(rootCase, 'enter-non-empty-ordered-grandchild');
        const orderedGrandchild = rootCase.orderedDescendantStyle;

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`
        ].join('\n'));
        await placeCursorAtDocumentEnd();

        await pressKey('Enter');

        expect(await getEditorText()).toBe([
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 2)} `
        ].join('\n'));
    });

    it('returns from an empty ordered grandchild to the unordered child level with Enter', async () => {
        const path = hybridFilePathFor(rootCase, 'enter-empty-ordered-grandchild');
        const orderedGrandchild = rootCase.orderedDescendantStyle;

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 2)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 3)} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(7);

        await pressKey('Enter');

        expect(await getEditorText()).toBe([
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} `
        ].join('\n'));

        const lines = await waitForLivePreviewLineStates(7);
        expectRenderedUnorderedListLine(lines[3], rootCase.unorderedChildMarker, 2);
        expectRenderedUnorderedListLine(lines[4], rootCase.unorderedChildMarker, 2);
        expectRenderedUnorderedListLine(lines[7], rootCase.unorderedChildMarker, 2);
        expectListMarkersToAlign(lines, [3, 4, 7]);
        if (rootCase.rootIsOrdered) {
            expectMarkerToBeIndentedAfter(lines[5], lines[3]);
            expectMarkerToBeIndentedAfter(lines[6], lines[7]);
        }
    });

    it('returns from an empty ordered grandchild to its only unordered parent with Enter', async () => {
        const path = hybridFilePathFor(rootCase, 'enter-empty-ordered-grandchild-single-parent');
        const orderedGrandchild = rootCase.orderedDescendantStyle;

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 2)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 3)} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(6);

        await pressKey('Enter');

        expect(await getEditorText()).toBe([
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} `
        ].join('\n'));

        const lines = await waitForLivePreviewLineStates(6);
        expectRenderedUnorderedListLine(lines[3], rootCase.unorderedChildMarker, 2);
        expectRenderedUnorderedListLine(lines[6], rootCase.unorderedChildMarker, 2);
        expectListMarkersToAlign(lines, [3, 6]);
    });

    it('returns from an empty ordered grandchild to its only unordered parent with Shift+Tab', async () => {
        const path = hybridFilePathFor(rootCase, 'shift-tab-empty-ordered-grandchild-single-parent');
        const orderedGrandchild = rootCase.orderedDescendantStyle;

        await openEditableDocument(path, [
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 2)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 3)} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(6);

        await pressShiftTab();

        expect(await getEditorText()).toBe([
            `${rootCase.rootMarker(1)} xxx`,
            `${rootCase.rootMarker(2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 1)} xxx`,
            `${INDENT}${INDENT}${marker(orderedGrandchild, 2)} xxx`,
            `${INDENT}${rootCase.unorderedChildMarker} `
        ].join('\n'));

        const lines = await waitForLivePreviewLineStates(6);
        expectRenderedUnorderedListLine(lines[3], rootCase.unorderedChildMarker, 2);
        expectRenderedUnorderedListLine(lines[6], rootCase.unorderedChildMarker, 2);
        expectListMarkersToAlign(lines, [3, 6]);
    });
}

function runLocalCycleOverrideTests(styleCase: OrderedStyleCase): void {
    it('uses the same-chunk ordered-to-unordered child marker override on Tab', async () => {
        const root = styleCase.style;
        const path = filePathFor(styleCase, 'tab-local-unordered-override');

        await openEditableDocument(path, [
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}- xxx`,
            `${INDENT}- xxx`,
            `${marker(root, 3)} xxx`,
            `${marker(root, 4)} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(6);

        await pressKey('Tab');

        expect(await getEditorText()).toBe([
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}- xxx`,
            `${INDENT}- xxx`,
            `${marker(root, 3)} xxx`,
            `${INDENT}- `
        ].join('\n'));
    });

    it('resets the local ordered-to-unordered child marker override after a blank line', async () => {
        const root = styleCase.style;
        const child = nextStyle(root);
        const path = filePathFor(styleCase, 'tab-local-override-chunk-reset');

        await openEditableDocument(path, [
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}- xxx`,
            `${INDENT}- xxx`,
            `${marker(root, 3)} xxx`,
            '',
            'Another list',
            '',
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(10);

        await pressKey('Tab');

        expect(await getEditorText()).toBe([
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}- xxx`,
            `${INDENT}- xxx`,
            `${marker(root, 3)} xxx`,
            '',
            'Another list',
            '',
            `${marker(root, 1)} xxx`,
            `${INDENT}${marker(child, 1)} `
        ].join('\n'));
    });

    it('reuses an ordered child marker override while starting a fresh ordinal under the current parent', async () => {
        const root = styleCase.style;
        const child = nextStyle(root);
        const path = filePathFor(styleCase, 'tab-local-ordered-override-fresh-ordinal');

        await openEditableDocument(path, [
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}${marker(child, 1)} xxx`,
            `${INDENT}${marker(child, 2)} xxx`,
            `${marker(root, 3)} xxx`,
            `${marker(root, 4)} `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(6);

        await pressKey('Tab');

        expect(await getEditorText()).toBe([
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}${marker(child, 1)} xxx`,
            `${INDENT}${marker(child, 2)} xxx`,
            `${marker(root, 3)} xxx`,
            `${INDENT}${marker(child, 1)} `
        ].join('\n'));
    });

    it('keeps local marker overrides specific to the adjacent parent and child depths', async () => {
        const root = styleCase.style;
        const unorderedGrandchild = nextUnorderedMarker('-');
        const path = filePathFor(styleCase, 'tab-local-override-depth-specificity');

        await openEditableDocument(path, [
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}- xxx`,
            `${marker(root, 3)} xxx`,
            `${INDENT}- xxx`,
            `${INDENT}- `
        ].join('\n'));
        await placeCursorAtLineAfterMarker(6);

        await pressKey('Tab');

        expect(await getEditorText()).toBe([
            `${marker(root, 1)} xxx`,
            `${marker(root, 2)} xxx`,
            `${INDENT}- xxx`,
            `${marker(root, 3)} xxx`,
            `${INDENT}- xxx`,
            `${INDENT}${INDENT}${unorderedGrandchild} `
        ].join('\n'));
    });
}

async function openDocumentWithCursor(filePath: string, contentWithCursor: string): Promise<void> {
    const cursorOffset = contentWithCursor.indexOf('|');
    if (cursorOffset < 0) {
        throw new Error(`Missing cursor marker in ${filePath}`);
    }

    const content = contentWithCursor.replace('|', '');
    await openEditableDocument(filePath, content);
    await setEditorSelection(cursorOffset, cursorOffset);
}

async function openDocumentWithSelection(filePath: string, contentWithSelection: string): Promise<void> {
    const selectionStart = contentWithSelection.indexOf('[');
    const selectionEnd = contentWithSelection.indexOf(']');
    if (selectionStart < 0 || selectionEnd < 0 || selectionEnd <= selectionStart) {
        throw new Error(`Missing selection markers in ${filePath}`);
    }

    const content = contentWithSelection
        .slice(0, selectionStart)
        + contentWithSelection.slice(selectionStart + 1, selectionEnd)
        + contentWithSelection.slice(selectionEnd + 1);
    await openEditableDocument(filePath, content);
    await setEditorSelection(selectionStart, selectionEnd - 1);
}

async function setEditorSelection(anchor: number, head: number): Promise<void> {
    await browser.execute((selectionAnchor, selectionHead) => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        cm.dispatch({
            selection: { anchor: selectionAnchor, head: selectionHead }
        });
        cm.focus();
    }, anchor, head);
}

async function configureOrderedListSettings(
    overrides: Partial<Record<string, boolean | OrderedListMarkerStyle[]>> = {}
): Promise<void> {
    await browser.execute(async (settingsOverrides, orderedListMarkerOrder) => {
        // @ts-ignore
        const plugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (!plugin) {
            // @ts-ignore
            await app.plugins.enablePlugin('pandoc-extended-markdown');
        }

        // @ts-ignore
        const enabledPlugin = app.plugins.plugins['pandoc-extended-markdown'];
        if (enabledPlugin?.settings) {
            Object.assign(enabledPlugin.settings, {
                enableFancyLists: true,
                enableOrderedListMarkerCycling: true,
                autoRenumberLists: true,
                enforcePandocListSpacing: false,
                orderedListMarkerOrder
            }, settingsOverrides);
            await enabledPlugin.saveSettings();
            // @ts-ignore
            app.workspace.updateOptions();
        }
    }, overrides, DEFAULT_ORDERED_LIST_MARKER_ORDER);
}

async function openEditableDocument(filePath: string, content: string): Promise<void> {
    await browser.execute(async (path, data) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
            // @ts-ignore
            await app.vault.modify(file, data);
        } else {
            // @ts-ignore
            await app.vault.create(path, data);
        }
    }, filePath, content);

    await browser.execute(async (path) => {
        // @ts-ignore
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) {
            return;
        }

        // @ts-ignore
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file);
        const state = leaf.getViewState();
        state.state = {
            ...(state.state ?? {}),
            mode: 'source',
            source: false
        };
        await leaf.setViewState(state);
    }, filePath);

    const contentEl = await browser.$('.markdown-source-view.mod-cm6 .cm-content');
    await contentEl.waitForExist({ timeout: 5000 });
    await contentEl.click();
    await browser.pause(300);
}

async function placeCursorAtDocumentEnd(): Promise<void> {
    await browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        cm.dispatch({
            selection: { anchor: cm.state.doc.length }
        });
        cm.focus();
    });
}

async function placeCursorAtLineAfterMarker(lineNumber: number): Promise<void> {
    await browser.execute((targetLineNumber) => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        if (!cm) {
            return;
        }

        const line = cm.state.doc.line(targetLineNumber);
        const markerMatch = line.text.match(/^(\s*)((?:\d+|[A-Za-z]+)[.)]|[-+*])(\s+)/);
        if (!markerMatch) {
            return;
        }

        cm.dispatch({
            selection: {
                anchor: line.from + markerMatch[0].length
            }
        });
        cm.focus();
    }, lineNumber);
}

async function getEditorText(): Promise<string> {
    return browser.execute(() => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        const view = leaves[0]?.view;
        const cm = view?.editor?.cm;
        return cm?.state.doc.toString() ?? '';
    });
}

async function getLivePreviewLineStates(): Promise<Record<number, LivePreviewLineState>> {
    return browser.execute((): Record<number, LivePreviewLineState> => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        // @ts-ignore
        const activeLeaf = app.workspace.activeLeaf ?? leaves[0];
        const cm = activeLeaf?.view?.editor?.cm ?? leaves[0]?.view?.editor?.cm;
        const source = cm?.contentDOM ?? cm?.dom ??
            document.querySelector('.workspace-leaf.mod-active .markdown-source-view') ??
            document.querySelector('.markdown-source-view.mod-active') ??
            document.querySelector('.markdown-source-view');
        const lineStates: Record<number, LivePreviewLineState> = {};

        const lines = Array.from(source?.querySelectorAll('.cm-line') ?? []);

        for (const [index, element] of lines.entries()) {
            const line = element as HTMLElement;
            const dataLineValue = line.getAttribute('data-line');
            const dataLineNumber = dataLineValue === null ? Number.NaN : Number(dataLineValue);
            const lineNumber = Number.isFinite(dataLineNumber) ? dataLineNumber + 1 : index + 1;

            const markers = Array.from(line.querySelectorAll(
                '.cm-formatting-list-ul, .cm-formatting-list-ol, .list-bullet'
            )) as HTMLElement[];
            const markerElement = line.querySelector(
                '.cm-formatting-list-ul .list-bullet, .cm-formatting-list-ol, .cm-formatting-list-ul, .list-bullet'
            ) as HTMLElement | null;
            const lineStyle = window.getComputedStyle(line);
            const markerRect = markerElement?.getBoundingClientRect();
            const contentRect = getTextRect(line, 'xxx');

            lineStates[lineNumber] = {
                text: line.textContent ?? '',
                className: line.className,
                markerText: markers.map(marker => marker.textContent?.trim() ?? '').join(''),
                markerCount: markers.length,
                markerInlineStart: markerRect ? markerRect.left : null,
                contentInlineStart: contentRect ? contentRect.left : null,
                paddingInlineStart: lineStyle.paddingInlineStart,
                textIndent: lineStyle.textIndent
            };
        }

        return lineStates;

        function getTextRect(root: HTMLElement, needle: string): DOMRect | null {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode() as Text | null;

            while (node) {
                const index = node.textContent?.indexOf(needle) ?? -1;
                if (index >= 0) {
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + needle.length);
                    const rect = range.getBoundingClientRect();
                    range.detach();
                    return rect.width > 0 ? rect : null;
                }

                node = walker.nextNode() as Text | null;
            }

            return null;
        }
    });
}

async function waitForLivePreviewLineStates(
    expectedLineCount: number
): Promise<Record<number, LivePreviewLineState>> {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const lines = await getLivePreviewLineStates();
        if (Object.keys(lines).length >= expectedLineCount) {
            return lines;
        }
        await browser.pause(100);
    }

    throw new Error(`Expected at least ${expectedLineCount} rendered Live Preview lines: ${
        JSON.stringify(await getLivePreviewDiagnostic())
    }`);
}

async function getLivePreviewDiagnostic(): Promise<Record<string, unknown>> {
    return browser.execute((): Record<string, unknown> => {
        // @ts-ignore
        const leaves = app.workspace.getLeavesOfType('markdown');
        // @ts-ignore
        const activeLeaf = app.workspace.activeLeaf ?? leaves[0];
        const cm = activeLeaf?.view?.editor?.cm ?? leaves[0]?.view?.editor?.cm;
        const source = cm?.contentDOM ?? cm?.dom ??
            document.querySelector('.workspace-leaf.mod-active .markdown-source-view') ??
            document.querySelector('.markdown-source-view.mod-active') ??
            document.querySelector('.markdown-source-view');
        const lines = Array.from(source?.querySelectorAll('.cm-line') ?? []) as HTMLElement[];

        return {
            hasCm: Boolean(cm),
            hasContentDom: Boolean(cm?.contentDOM),
            sourceClass: source instanceof HTMLElement ? source.className : '',
            sourceChildCount: source?.childNodes.length ?? -1,
            lineCount: lines.length,
            sourceText: source?.textContent?.slice(0, 200) ?? '',
            sample: lines.slice(0, 8).map(line => ({
                className: line.className,
                text: line.textContent
            }))
        };
    });
}

function expectRenderedUnorderedListLine(
    line: LivePreviewLineState | undefined,
    marker: UnorderedListMarker,
    expectedLevel: number
): void {
    expect(line).toBeDefined();
    expect(line!.text).toContain(`${marker} `);
    expect(line!.className).toContain('HyperMD-list-line');
    expect(line!.className).toContain(`HyperMD-list-line-${expectedLevel}`);
    expect(line!.className).toContain('pem-unordered-list-marker');
    expect(line!.className).not.toContain('HyperMD-list-line-nobullet');
    expect(line!.className).not.toContain('pem-pandoc-invalid-native-list');
    expect(line!.markerText).toContain(marker);
    expect(line!.markerCount).toBeGreaterThan(0);
    expect(line!.markerInlineStart).not.toBeNull();
    expect(parseFloat(line!.paddingInlineStart)).toBeGreaterThanOrEqual(30);
    expect(parseFloat(line!.textIndent)).toBeLessThanOrEqual(-30);
}

function expectListMarkersToAlign(
    lines: Record<number, LivePreviewLineState>,
    lineNumbers: number[]
): void {
    const markerStarts = lineNumbers.map(lineNumber => {
        const markerStart = lines[lineNumber]?.markerInlineStart;
        expect(markerStart).not.toBeNull();
        return markerStart!;
    });
    const leftmost = Math.min(...markerStarts);
    const rightmost = Math.max(...markerStarts);

    expect(rightmost - leftmost).toBeLessThanOrEqual(3);
}

function expectListContentToAlign(
    lines: Record<number, LivePreviewLineState>,
    lineNumbers: number[]
): void {
    const contentStarts = lineNumbers.map(lineNumber => {
        const contentStart = lines[lineNumber]?.contentInlineStart;
        expect(contentStart).not.toBeNull();
        return contentStart!;
    });
    const leftmost = Math.min(...contentStarts);
    const rightmost = Math.max(...contentStarts);

    expect(rightmost - leftmost).toBeLessThanOrEqual(3);
}

function expectMarkerToBeIndentedAfter(
    descendant: LivePreviewLineState | undefined,
    ancestor: LivePreviewLineState | undefined
): void {
    expect(descendant?.markerInlineStart).not.toBeNull();
    expect(ancestor?.markerInlineStart).not.toBeNull();
    expect(descendant!.markerInlineStart! - ancestor!.markerInlineStart!).toBeGreaterThanOrEqual(20);
}

async function pressKey(key: string, pauseMs = 300): Promise<void> {
    await browser.keys(key);
    await browser.pause(pauseMs);
}

async function pressText(text: string, pauseMs = 300): Promise<void> {
    await browser.keys(text);
    await browser.pause(pauseMs);
}

async function pressShiftTab(pauseMs = 300): Promise<void> {
    await browser.keys(['Shift', 'Tab', 'NULL']);
    await browser.pause(pauseMs);
}

function filePathFor(styleCase: OrderedStyleCase, scenario: string): string {
    return `ordered-list-autocompletion-${styleCase.style}-${scenario}.md`;
}

function hybridFilePathFor(rootCase: HybridRootCase, scenario: string): string {
    return `ordered-list-autocompletion-${rootCase.fileId}-${scenario}.md`;
}

function unorderedFileId(markerText: UnorderedListMarker): string {
    switch (markerText) {
        case '-':
            return 'unordered-dash';
        case '+':
            return 'unordered-plus';
        case '*':
            return 'unordered-asterisk';
    }
}

function nextUnorderedMarker(markerText: UnorderedListMarker): UnorderedListMarker {
    switch (markerText) {
        case '-':
            return '*';
        case '+':
            return '-';
        case '*':
            return '+';
    }
}

function nextStyle(style: OrderedListMarkerStyle): OrderedListMarkerStyle {
    const index = DEFAULT_ORDERED_LIST_MARKER_ORDER.indexOf(style);
    return DEFAULT_ORDERED_LIST_MARKER_ORDER[(index + 1) % DEFAULT_ORDERED_LIST_MARKER_ORDER.length];
}

function marker(style: OrderedListMarkerStyle, ordinal: number): string {
    const delimiter = style.endsWith('one-paren') ? ')' : '.';

    if (style.startsWith('decimal')) {
        return `${ordinal}${delimiter}`;
    }

    if (style.includes('roman')) {
        return `${toRoman(ordinal, style.startsWith('upper'))}${delimiter}`;
    }

    return `${toAlpha(ordinal, style.startsWith('upper'))}${delimiter}`;
}

function toAlpha(ordinal: number, isUpperCase: boolean): string {
    let value = ordinal;
    let result = '';

    while (value > 0) {
        value -= 1;
        result = String.fromCharCode('a'.charCodeAt(0) + (value % 26)) + result;
        value = Math.floor(value / 26);
    }

    return isUpperCase ? result.toUpperCase() : result;
}

function toRoman(ordinal: number, isUpperCase: boolean): string {
    const pairs: Array<[number, string]> = [
        [1000, 'm'],
        [900, 'cm'],
        [500, 'd'],
        [400, 'cd'],
        [100, 'c'],
        [90, 'xc'],
        [50, 'l'],
        [40, 'xl'],
        [10, 'x'],
        [9, 'ix'],
        [5, 'v'],
        [4, 'iv'],
        [1, 'i']
    ];
    let value = ordinal;
    let result = '';

    for (const [amount, symbol] of pairs) {
        while (value >= amount) {
            result += symbol;
            value -= amount;
        }
    }

    return isUpperCase ? result.toUpperCase() : result;
}
