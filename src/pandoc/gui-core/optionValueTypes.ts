import type { OptionSpec, OptionValueAlternative, OptionValueKind } from './types';

export function optionValueTypeText(
    spec?: Pick<OptionSpec, 'valueKind' | 'valueAlternatives'>
): string {
    if (!spec) return 'type: unknown';
    if (spec.valueAlternatives && spec.valueAlternatives.length > 1) {
        return `type: ${hybridValueTypeText(spec.valueAlternatives)}`;
    }
    if (spec.valueKind === 'none') return 'type: flag';
    if (spec.valueKind === 'format') return 'type: format string';
    if (spec.valueKind === 'directory') return 'type: folder path';
    if (spec.valueKind === 'pathList') return 'type: folder path';
    if (spec.valueKind === 'file') return 'type: file path';
    return `type: ${spec.valueKind}`;
}

function hybridValueTypeText(alternatives: OptionValueAlternative[]): string {
    return alternatives.map(alternativeTypeText).join(' or ');
}

function alternativeTypeText(alternative: OptionValueAlternative): string {
    if (alternative.id === 'preset') return 'preset';
    if (alternative.id === 'url') return 'URL';
    return valueKindText(alternative.valueKind, alternative.label);
}

function valueKindText(valueKind: OptionValueKind, fallback: string): string {
    if (valueKind === 'file') return 'file';
    if (valueKind === 'directory' || valueKind === 'pathList') return 'folder';
    if (valueKind === 'format') return 'format';
    if (valueKind === 'string') return fallback;
    return valueKind;
}
