import type { OptionSpec, OptionValueAlternative } from './types';

export function optionValueTypeText(
    spec?: Pick<OptionSpec, 'valueKind' | 'valueAlternatives' | 'valuePlaceholder'>
): string {
    if (!spec) return 'unknown';
    if (spec.valueAlternatives && spec.valueAlternatives.length > 0) {
        return pandocValueTypeText(spec.valueAlternatives);
    }
    if (spec.valueKind === 'none') return '';
    if (spec.valuePlaceholder) return spec.valuePlaceholder;
    return spec.valueKind;
}

function pandocValueTypeText(alternatives: OptionValueAlternative[]): string {
    return alternatives.map(alternative => alternative.label).join(' | ');
}
