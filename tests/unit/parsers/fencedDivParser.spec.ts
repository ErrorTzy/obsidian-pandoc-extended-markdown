import { parseFencedDivOpening, isFencedDivClosing } from '../../../src/live-preview/pipeline/structural/fencedDiv/parser';

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
