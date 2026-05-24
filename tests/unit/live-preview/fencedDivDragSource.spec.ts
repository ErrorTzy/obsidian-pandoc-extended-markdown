import { moveFencedDivBlockText } from '../../../src/live-preview/fencedDivDragSource';

describe('fenced div drag source normalization', () => {
    it('inserts blank separators when dropping between nonblank paragraphs', () => {
        const result = moveFencedDivBlockText([
            'Intro',
            '::: {.note}',
            'Alpha',
            ':::',
            'Middle',
            'Target'
        ].join('\n'), { startLine: 2, endLine: 4 }, 6);

        expect(result.changed).toBe(true);
        expect(result.docText).toBe([
            'Intro',
            'Middle',
            '',
            '::: {.note}',
            'Alpha',
            ':::',
            '',
            'Target'
        ].join('\n'));
    });

    it('does not require an outside blank at the file start', () => {
        const result = moveFencedDivBlockText([
            'Intro',
            '::: {.note}',
            'Alpha',
            ':::',
            'Tail'
        ].join('\n'), { startLine: 2, endLine: 4 }, 1);

        expect(result.docText).toBe([
            '::: {.note}',
            'Alpha',
            ':::',
            '',
            'Intro',
            'Tail'
        ].join('\n'));
    });

    it('does not require an outside blank at the file end', () => {
        const result = moveFencedDivBlockText([
            'Intro',
            '::: {.note}',
            'Alpha',
            ':::',
            'Tail'
        ].join('\n'), { startLine: 2, endLine: 4 }, 6);

        expect(result.docText).toBe([
            'Intro',
            'Tail',
            '',
            '::: {.note}',
            'Alpha',
            ':::'
        ].join('\n'));
    });

    it('preserves an immediate trailing separator blank at the old location', () => {
        const result = moveFencedDivBlockText([
            'Intro',
            '',
            '::: {.note}',
            'Alpha',
            ':::',
            '',
            'Middle',
            'Target'
        ].join('\n'), { startLine: 3, endLine: 5 }, 8);

        expect(result.docText).toBe([
            'Intro',
            '',
            'Middle',
            '',
            '::: {.note}',
            'Alpha',
            ':::',
            '',
            'Target'
        ].join('\n'));
    });

    it('preserves an old separator when the following fenced div needs a blank before it', () => {
        const result = moveFencedDivBlockText([
            'Intro paragraph.',
            '',
            '::: {.note}',
            'Alpha',
            ':::',
            '::: {.tip}',
            'Beta',
            ':::',
            '',
            'Target'
        ].join('\n'), { startLine: 3, endLine: 5 }, 10);

        expect(result.docText).toBe([
            'Intro paragraph.',
            '',
            '::: {.tip}',
            'Beta',
            ':::',
            '',
            '::: {.note}',
            'Alpha',
            ':::',
            '',
            'Target'
        ].join('\n'));
    });

    it('treats drops inside the dragged block as no-ops', () => {
        const docText = [
            'Intro',
            '::: {.note}',
            'Alpha',
            ':::',
            'Tail'
        ].join('\n');
        const result = moveFencedDivBlockText(docText, { startLine: 2, endLine: 4 }, 3);

        expect(result.changed).toBe(false);
        expect(result.docText).toBe(docText);
    });
});
