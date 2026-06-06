import { parseFencedDivOpening, isFencedDivClosing } from '../../../src/live-preview/pipeline/structural/fencedDiv/parser';

const pandocRejectedShortcutCombinationCases: Array<[string, string]> = [
    ['example 2 block', ':::example_2 {.attr}'],
    ['example 4 block', ':::example_4 {#id4}'],
    ['example 6 block', ':::{.attr} example_6'],
    ['example 7 block', '::: {example_7, .attr}'],
    ['example 1 text on opener', '::: example_1 {.attr} This is example 1'],
    ['example 2 text on opener', ':::example_2 {.attr} This is example 2'],
    ['example 3 text on opener', '::: example_3 {#id3} This is example 3'],
    ['example 4 text on opener', ':::example_4 {#id4} This is example 4'],
    ['example 6 text on opener', ':::{.attr} example_6 This is example 6'],
    ['example 7 text on opener', '::: {example_7, .attr} This is example 7'],
    ['example 1 one-line div', '::: example_1 {.attr} This is example 1 :::'],
    ['example 2 one-line div', ':::example_2 {.attr} This is example 2 :::'],
    ['example 3 one-line div', '::: example_3 {#id3} This is example 3 :::'],
    ['example 4 one-line div', ':::example_4 {#id4} This is example 4 :::'],
    ['example 6 one-line div', ':::{.attr} example_6 This is example 6 :::'],
    ['example 7 one-line div', '::: {example_7, .attr} This is example 7 :::']
];

describe('fenced div parser', () => {
    describe('Pandoc-valid openings', () => {
        it.each([
            ['spaced braced attributes', '::: {.note}', ['note']],
            ['unspaced braced attributes', ':::{.note}', ['note']],
            ['unbraced class', ':::Warning', ['Warning']],
            ['longer opening fence with unbraced class', '::::Warning', ['Warning']],
            ['visual trailing colons after braced attributes', '::: {.note}::::::', ['note']],
            ['spaced visual trailing colons after braced attributes', '::: {.note} ::::::', ['note']],
            ['visual trailing colons after unbraced class', '::: Warning ::::::', ['Warning']],
            ['empty braced attributes', '::: {}', []],
            ['id-only attributes', '::: {#thm:one}', []],
            ['key-value-only attributes', '::: {title="Only metadata"}', []],
            ['unnumbered shorthand', '::: {-}', ['unnumbered']],
            ['unnumbered shorthand with class', '::: {- .note}', ['unnumbered', 'note']],
            ['unnumbered shorthand before key-value', '::: {-key=value}', ['unnumbered']]
        ])('parses %s', (_name, line, expectedClasses) => {
            const parsed = parseFencedDivOpening(line);

            expect(parsed).not.toBeNull();
            expect(parsed?.classes).toEqual(expectedClasses);
        });

        it('uses the last repeated id like Pandoc', () => {
            const parsed = parseFencedDivOpening('::: {.theorem #first #second}');

            expect(parsed?.id).toBe('second');
            expect(parsed?.classes).toEqual(['theorem']);
        });

        it('parses quoted, single-quoted, escaped, and comma-containing key values', () => {
            const parsed = parseFencedDivOpening('::: {.note title="hello world" data-x=\'yes\' escaped="hello \\"world\\"" csv=x,y}');

            expect(parsed?.classes).toEqual(['note']);
            expect(parsed?.keyValues.get('title')).toBe('hello world');
            expect(parsed?.keyValues.get('data-x')).toBe('yes');
            expect(parsed?.keyValues.get('escaped')).toBe('hello "world"');
            expect(parsed?.keyValues.get('csv')).toBe('x,y');
        });

        it('requires a doubled Markdown backslash for escaped ampersands in quoted attributes', () => {
            const singleBackslash = parseFencedDivOpening('::: {.case title="AT\\&T-&.&"}');
            const doubleBackslash = parseFencedDivOpening('::: {.case title="AT\\\\&T-&.&"}');

            expect(singleBackslash?.keyValues.get('title')).toBe('AT&T-&.&');
            expect(doubleBackslash?.keyValues.get('title')).toBe('AT\\&T-&.&');
        });
    });

    describe('readable shorthand openings', () => {
        it('parses classes, id, and key-values when readable shorthand is enabled', () => {
            const parsed = parseFencedDivOpening('::: Theorem #thm data=1');

            expect(parsed?.classes).toEqual(['Theorem']);
            expect(parsed?.id).toBe('thm');
            expect(parsed?.keyValues.get('data')).toBe('1');
        });

        it('treats additional bare tokens as classes', () => {
            const parsed = parseFencedDivOpening('::: Theorem thm compact');

            expect(parsed?.classes).toEqual(['Theorem', 'thm', 'compact']);
            expect(parsed?.id).toBeUndefined();
            expect(parsed?.keyValues.get('title')).toBe('Theorem');
        });

        it('synthesizes title templates from readable numbering classes', () => {
            const nested = parseFencedDivOpening('::: Case &.& #case:nested');
            const front = parseFencedDivOpening('::: & Note #note:front');
            const classEmbedded = parseFencedDivOpening('::: Case_&.& #case:embedded');

            expect(nested?.classes).toEqual(['Case', '&.&']);
            expect(nested?.keyValues.get('title')).toBe('Case &.&');
            expect(front?.classes).toEqual(['&', 'Note']);
            expect(front?.keyValues.get('title')).toBe('& Note');
            expect(classEmbedded?.classes).toEqual(['Case_&.&']);
            expect(classEmbedded?.keyValues.get('title')).toBe('Case &.&');
        });

        it('parses quoted values and trailing visual colons', () => {
            const parsed = parseFencedDivOpening('::: Theorem #thm title="hello world" data-x=\'yes\' ::::::');

            expect(parsed?.classes).toEqual(['Theorem']);
            expect(parsed?.id).toBe('thm');
            expect(parsed?.keyValues.get('title')).toBe('hello world');
            expect(parsed?.keyValues.get('data-x')).toBe('yes');
        });

        it('uses the last repeated id', () => {
            const parsed = parseFencedDivOpening('::: Theorem #first #second');

            expect(parsed?.id).toBe('second');
            expect(parsed?.classes).toEqual(['Theorem']);
        });

        it('parses title text after braced attributes', () => {
            const parsed = parseFencedDivOpening('::: {.class #id} explicit title with space');

            expect(parsed?.classes).toEqual(['class']);
            expect(parsed?.id).toBe('id');
            expect(parsed?.keyValues.get('title')).toBe('explicit title with space');
        });

        it('parses title text before braced attributes', () => {
            const parsed = parseFencedDivOpening('::: explicit title before attributes {.class #id}');

            expect(parsed?.classes).toEqual(['class']);
            expect(parsed?.id).toBe('id');
            expect(parsed?.keyValues.get('title')).toBe('explicit title before attributes');
        });

        it('keeps braced title shorthand disabled when readable shorthand is disabled', () => {
            expect(parseFencedDivOpening(
                '::: {.class #id} explicit title with space',
                { enableReadableFencedDivSyntax: false }
            )).toBeNull();
            expect(parseFencedDivOpening(
                '::: explicit title before attributes {.class #id}',
                { enableReadableFencedDivSyntax: false }
            )).toBeNull();
        });

        it('does not parse readable shorthand when readable shorthand is disabled', () => {
            expect(parseFencedDivOpening(
                '::: Theorem #thm data=1',
                { enableReadableFencedDivSyntax: false }
            )).toBeNull();
        });
    });

    describe('Pandoc-rejected shortcut and inline-content combinations', () => {
        it.each(pandocRejectedShortcutCombinationCases)('does not parse %s', (_name, line) => {
            expect(parseFencedDivOpening(line)).toBeNull();
        });
    });

    describe('Pandoc fallback and invalid openings', () => {
        it.each([
            ['plain braced word', '::: {note}', ['{note}']],
            ['numeric class in braces', '::: {.123}', ['{.123}']],
            ['invalid id character in braces', '::: {#x@}', ['{#x@}']],
            ['comma in single invalid braced token', '::: {.x,}', ['{.x,}']]
        ])('treats %s as a literal unbraced class', (_name, line, expectedClasses) => {
            const parsed = parseFencedDivOpening(line);

            expect(parsed).not.toBeNull();
            expect(parsed?.classes).toEqual(expectedClasses);
            expect(parsed?.id).toBeUndefined();
            expect(parsed?.keyValues.size).toBe(0);
        });

        it.each([
            ['one-space indented opening', ' ::: {.note}'],
            ['two-space indented opening', '  ::: {.note}'],
            ['comma-separated braced attributes', '::: {.note, #id}'],
            ['invalid key with whitespace in braced attributes', '::: {.note @x=y}'],
            ['closing-only fence', '::::']
        ])('does not parse %s', (_name, line) => {
            expect(parseFencedDivOpening(line)).toBeNull();
        });
    });

    describe('closings', () => {
        it.each([':::', ':::::', ':::   '])('parses %s as a closing fence', line => {
            expect(isFencedDivClosing(line)).toBe(true);
        });

        it.each([' :::', '::: end', '::'])('rejects %s as a closing fence', line => {
            expect(isFencedDivClosing(line)).toBe(false);
        });
    });
});
