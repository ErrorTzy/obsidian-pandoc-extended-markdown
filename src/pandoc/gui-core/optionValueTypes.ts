import type { OptionSpec, OptionValueAlternative } from './types';

export function optionValueTypeText(
    spec?: Pick<OptionSpec, 'valueKind' | 'valueAlternatives' | 'valuePlaceholder'>
): string {
    if (!spec) return 'type: unknown';
    if (spec.valueAlternatives && spec.valueAlternatives.length > 0) {
        return `type: ${pandocValueTypeText(spec.valueAlternatives)}`;
    }
    if (spec.valueKind === 'none') return 'type: flag';
    if (spec.valuePlaceholder) return `type: ${spec.valuePlaceholder}`;
    return `type: ${spec.valueKind}`;
}

function pandocValueTypeText(alternatives: OptionValueAlternative[]): string {
    return alternatives.map(alternative => alternative.label).join(' | ');
}
