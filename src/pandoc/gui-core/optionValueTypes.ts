import type { OptionSpec } from './types';

export function optionValueTypeText(spec?: Pick<OptionSpec, 'valueKind'>): string {
    if (!spec) return 'type: unknown';
    if (spec.valueKind === 'none') return 'type: flag';
    if (spec.valueKind === 'format') return 'type: format string';
    if (spec.valueKind === 'directory') return 'type: folder path';
    if (spec.valueKind === 'pathList') return 'type: folder path';
    if (spec.valueKind === 'file') return 'type: file path';
    return `type: ${spec.valueKind}`;
}
