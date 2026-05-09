import {
    allowsFencedDivOpeningAfterLine,
    isFencedDivClosing,
    parseFencedDivOpening
} from '../../../../src/live-preview/pipeline/structural/fencedDiv/parser';

describe('fenced div parser', () => {
    describe('valid Pandoc openings', () => {
        it.each([
            ['::: {.note}', ['note']],
            [':::{.note}', ['note']],
            [':::Warning', ['Warning']],
            ['::::Warning', ['Warning']],
            ['::: {.note}::::::', ['note']],
            ['::: {.note}:', ['note']],
            ['::: {.note}::', ['note']],
            ['::: {.note} ::::::', ['note']],
            ['::: Warning ::::::', ['Warning']]
        ])('parses %s', (line, classes) => {
            expect(parseFencedDivOpening(line)?.classes).toEqual(classes);
        });

        it('parses empty braced attributes', () => {
            const opening = parseFencedDivOpening('::: {}');

            expect(opening).toMatchObject({
                id: undefined,
                classes: []
            });
            expect(opening?.keyValues.size).toBe(0);
        });

        it('parses id-only and key-value-only attribute sets', () => {
            expect(parseFencedDivOpening('::: {#id}')?.id).toBe('id');
            expect(parseFencedDivOpening('::: {key=value}')?.keyValues.get('key')).toBe('value');
        });

        it('uses the last id when Pandoc sees repeated ids', () => {
            const opening = parseFencedDivOpening('::: {.note #first #second}');

            expect(opening?.id).toBe('second');
            expect(opening?.classes).toEqual(['note']);
        });

        it('synthesizes titles for class-only Pandoc attributes', () => {
            expect(parseFencedDivOpening('::: {.note}')?.keyValues.get('title')).toBe('Note');
            expect(parseFencedDivOpening('::: {.logic-block #id}')?.keyValues.get('title')).toBe('Logic Block');
            expect(parseFencedDivOpening('::: {#id}')?.keyValues.has('title')).toBe(false);
        });

        it('parses quoted values with spaces and escaped quotes', () => {
            const opening = parseFencedDivOpening(
                '::: {.note title="hello world" data-x=\'yes\' escaped="hello \\"world\\""}'
            );

            expect(opening?.keyValues.get('title')).toBe('hello world');
            expect(opening?.keyValues.get('data-x')).toBe('yes');
            expect(opening?.keyValues.get('escaped')).toBe('hello "world"');
        });

        it('matches Pandoc escaping for literal ampersands in quoted attributes', () => {
            const singleBackslash = parseFencedDivOpening('::: {.case title="AT\\&T-&.&"}');
            const doubleBackslash = parseFencedDivOpening('::: {.case title="AT\\\\&T-&.&"}');

            expect(singleBackslash?.keyValues.get('title')).toBe('AT&T-&.&');
            expect(doubleBackslash?.keyValues.get('title')).toBe('AT\\&T-&.&');
        });

        it('maps Pandoc dash shorthand to the unnumbered class', () => {
            expect(parseFencedDivOpening('::: {-}')?.classes).toEqual(['unnumbered']);
            expect(parseFencedDivOpening('::: {- .note}')?.classes).toEqual(['unnumbered', 'note']);
            expect(parseFencedDivOpening('::: {-key=value}')?.classes).toEqual(['unnumbered']);
            expect(parseFencedDivOpening('::: {-key=value}')?.keyValues.get('key')).toBe('value');
        });
    });

    describe('readable shorthand openings', () => {
        it('parses a class, id, and key-value attribute', () => {
            const opening = parseFencedDivOpening('::: Theorem #thm data=1');

            expect(opening?.classes).toEqual(['Theorem']);
            expect(opening?.id).toBe('thm');
            expect(opening?.keyValues.get('data')).toBe('1');
        });

        it('parses multiple bare tokens as classes', () => {
            expect(parseFencedDivOpening('::: Theorem thm compact')?.classes).toEqual([
                'Theorem',
                'thm',
                'compact'
            ]);
            expect(parseFencedDivOpening('::: Theorem thm compact')?.keyValues.get('title')).toBe('Theorem');
        });

        it('parses quoted values and trailing visual colons', () => {
            const opening = parseFencedDivOpening('::: Theorem #thm title="hello world" data-x=\'yes\' ::::::');

            expect(opening?.classes).toEqual(['Theorem']);
            expect(opening?.id).toBe('thm');
            expect(opening?.keyValues.get('title')).toBe('hello world');
            expect(opening?.keyValues.get('data-x')).toBe('yes');
        });

        it('does not parse readable shorthand in strict mode', () => {
            expect(parseFencedDivOpening(
                '::: Theorem #thm data=1',
                { strictPandocMode: true }
            )).toBeNull();
        });
    });

    describe('invalid or fallback Pandoc openings', () => {
        it.each([
            ' ::: {.note}',
            '  ::: {.note}',
            '\t::: {.note}',
            '::: {.note, #id}'
        ])('does not parse %s', line => {
            expect(parseFencedDivOpening(line)).toBeNull();
        });

        it.each([
            ['::: {note}', ['{note}']],
            ['::: {.123}', ['{.123}']],
            ['::: {#x@}', ['{#x@}']]
        ])('parses Pandoc fallback class for %s', (line, classes) => {
            expect(parseFencedDivOpening(line)?.classes).toEqual(classes);
        });

        it('does not treat a bare colon fence as an opening', () => {
            expect(parseFencedDivOpening('::::')).toBeNull();
        });
    });

    describe('closing fences', () => {
        it('accepts only unindented bare colon runs', () => {
            expect(isFencedDivClosing(':::')).toBe(true);
            expect(isFencedDivClosing('::::   ')).toBe(true);
            expect(isFencedDivClosing(' :::')).toBe(false);
            expect(isFencedDivClosing('::: end')).toBe(false);
        });
    });

    describe('block boundary helpers', () => {
        it('allows openings after complete block lines that Pandoc accepts', () => {
            expect(allowsFencedDivOpeningAfterLine('')).toBe(true);
            expect(allowsFencedDivOpeningAfterLine('# Heading')).toBe(true);
            expect(allowsFencedDivOpeningAfterLine('---')).toBe(true);
            expect(allowsFencedDivOpeningAfterLine('<div>x</div>')).toBe(true);
        });

        it('does not allow openings after paragraph-like lines', () => {
            expect(allowsFencedDivOpeningAfterLine('paragraph')).toBe(false);
            expect(allowsFencedDivOpeningAfterLine('- list item')).toBe(false);
            expect(allowsFencedDivOpeningAfterLine('> quote')).toBe(false);
            expect(allowsFencedDivOpeningAfterLine('<span>x</span>')).toBe(false);
        });
    });
});
