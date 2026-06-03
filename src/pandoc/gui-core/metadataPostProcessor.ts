import type { OptionSpec } from './types';

const OUTPUT_FILE_PLACEHOLDER = 'OFILE';

export function postProcessOptionMetadata(options: OptionSpec[]): OptionSpec[] {
    return options.map(option => option.mapsTo === 'output' ? outputFileOption(option) : option);
}

function outputFileOption(option: OptionSpec): OptionSpec {
    return {
        ...option,
        valueKind: 'file',
        valuePlaceholder: OUTPUT_FILE_PLACEHOLDER,
        valueAlternatives: option.valueAlternatives?.map(alternative => ({
            ...alternative,
            id: alternative.id === 'FILE' ? OUTPUT_FILE_PLACEHOLDER : alternative.id,
            label: alternative.label === 'FILE' ? OUTPUT_FILE_PLACEHOLDER : alternative.label,
            valuePlaceholder: alternative.id === 'FILE' ? OUTPUT_FILE_PLACEHOLDER : alternative.valuePlaceholder,
            placeholder: alternative.placeholder === 'FILE' ? OUTPUT_FILE_PLACEHOLDER : alternative.placeholder
        }))
    };
}
