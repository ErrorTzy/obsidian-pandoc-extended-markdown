import { describe, expect, it } from '@jest/globals';

import {
    getPandocVersionLine,
    normalizePandocExecutable,
    parsePandocVersion
} from '../../../src/pandoc';

describe('pandoc path utilities', () => {
    it('uses pandoc from PATH when no executable is configured', () => {
        expect(normalizePandocExecutable()).toBe('pandoc');
        expect(normalizePandocExecutable('   ')).toBe('pandoc');
    });

    it('removes wrapping quotes from configured executable paths', () => {
        expect(normalizePandocExecutable('"/usr/local/bin/pandoc"')).toBe('/usr/local/bin/pandoc');
        expect(normalizePandocExecutable("'C:/Program Files/Pandoc/pandoc.exe'")).toBe('C:/Program Files/Pandoc/pandoc.exe');
    });

    it('extracts the first non-empty version line', () => {
        expect(getPandocVersionLine('\n\npandoc 3.1.12\nFeatures:')).toBe('pandoc 3.1.12');
    });

    it('parses pandoc versions from standard version output', () => {
        expect(parsePandocVersion('pandoc 3.1.12\nFeatures:')).toBe('3.1.12');
        expect(parsePandocVersion('pandoc.exe 3.1.9.1\n')).toBe('3.1.9.1');
        expect(parsePandocVersion('pandoc 3.1.5\n')).toBe('3.1.5');
    });

    it('returns undefined for unrelated output', () => {
        expect(parsePandocVersion('not pandoc')).toBeUndefined();
    });
});
