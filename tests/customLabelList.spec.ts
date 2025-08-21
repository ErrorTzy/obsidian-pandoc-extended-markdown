import { parseCustomLabelMarker, isValidCustomLabel } from '../src/parsers/customLabelListParser';

describe('CustomLabelListParser', () => {
  describe('parseCustomLabelMarker', () => {
    it('should parse simple custom label marker', () => {
      const result = parseCustomLabelMarker('{::P} All humans are mortal.');
      expect(result).toEqual({
        indent: '',
        originalMarker: '{::P}',
        label: 'P'
      });
    });

    it('should parse custom label with multiple letters', () => {
      const result = parseCustomLabelMarker('  {::Alpha} This is an alpha example');
      expect(result).toEqual({
        indent: '  ',
        originalMarker: '{::Alpha}',
        label: 'Alpha'
      });
    });

    it('should parse custom label with numbers', () => {
      const result = parseCustomLabelMarker('{::P1} First premise');
      expect(result).toEqual({
        indent: '',
        originalMarker: '{::P1}',
        label: 'P1'
      });
    });

    it('should parse custom label with primes', () => {
      const result = parseCustomLabelMarker("{::P'} Modified premise");
      expect(result).toEqual({
        indent: '',
        originalMarker: "{::P'}",
        label: "P'"
      });
    });

    it('should parse custom label with underscores', () => {
      const result = parseCustomLabelMarker('{::X_0} Initial value');
      expect(result).toEqual({
        indent: '',
        originalMarker: '{::X_0}',
        label: 'X_0'
      });
    });

    it('should parse indented custom labels', () => {
      const result = parseCustomLabelMarker('    {::Q} Socrates is human.');
      expect(result).toEqual({
        indent: '    ',
        originalMarker: '{::Q}',
        label: 'Q'
      });
    });

    it('should return null for non-custom-label markers', () => {
      expect(parseCustomLabelMarker('1. Regular list')).toBeNull();
      expect(parseCustomLabelMarker('(@) Example list')).toBeNull();
      expect(parseCustomLabelMarker('A. Fancy list')).toBeNull();
      expect(parseCustomLabelMarker('#. Hash list')).toBeNull();
    });

    it('should return null for invalid labels', () => {
      expect(parseCustomLabelMarker('{::} Empty label')).toBeNull();
      expect(parseCustomLabelMarker('{::P Q} Space in label')).toBeNull();
      expect(parseCustomLabelMarker('{::<P>} Angle brackets')).toBeNull();
      expect(parseCustomLabelMarker('{::P|Q} Pipe character')).toBeNull();
    });

    it('should return null when no space after marker', () => {
      expect(parseCustomLabelMarker('{::P}No space')).toBeNull();
    });
  });

  describe('isValidCustomLabel', () => {
    it('should accept valid single letter labels', () => {
      expect(isValidCustomLabel('P')).toBe(true);
      expect(isValidCustomLabel('Q')).toBe(true);
      expect(isValidCustomLabel('A')).toBe(true);
      expect(isValidCustomLabel('z')).toBe(true);
    });

    it('should accept valid multi-letter labels', () => {
      expect(isValidCustomLabel('Alpha')).toBe(true);
      expect(isValidCustomLabel('Beta')).toBe(true);
      expect(isValidCustomLabel('Premise')).toBe(true);
    });

    it('should accept labels with numbers', () => {
      expect(isValidCustomLabel('P1')).toBe(true);
      expect(isValidCustomLabel('Q2')).toBe(true);
      expect(isValidCustomLabel('Step3')).toBe(true);
    });

    it('should accept labels with primes', () => {
      expect(isValidCustomLabel("P'")).toBe(true);
      expect(isValidCustomLabel("Q''")).toBe(true);
      expect(isValidCustomLabel("R'''")).toBe(true);
    });

    it('should accept labels with underscores', () => {
      expect(isValidCustomLabel('X_0')).toBe(true);
      expect(isValidCustomLabel('Y_n')).toBe(true);
      expect(isValidCustomLabel('var_name')).toBe(true);
    });

    it('should reject invalid labels', () => {
      expect(isValidCustomLabel('')).toBe(false);
      expect(isValidCustomLabel('P Q')).toBe(false);
      expect(isValidCustomLabel('<P>')).toBe(false);
      expect(isValidCustomLabel('P|Q')).toBe(false);
      expect(isValidCustomLabel('P\\Q')).toBe(false);
      expect(isValidCustomLabel('P/Q')).toBe(false);
    });
  });
});