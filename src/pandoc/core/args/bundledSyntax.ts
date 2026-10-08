import type { ExportVariables } from '../export/types';
import { renderExportTemplates } from '../templates/template';
import { joinPath } from '../utils/pathUtils';

export const BUNDLED_SYNTAX_FILTERS = [
    '${luaFilterDir}/FencedDivExtendedSyntax.lua',
    '${luaFilterDir}/CustomLabelList.lua'
];

export function resolveBundledSyntax(
    from: string,
    filters: string[],
    extraArgs: string[],
    variables: ExportVariables
): { reader: string; filters: string[]; extraArgs: string[] } {
    const markdown = /^markdown((?:[+-].*)?)$/.exec(from);
    if (!markdown) return { reader: from, filters, extraArgs };

    const extraFilters = readLuaFilterArgs(extraArgs);
    const configured = new Set([...filters, ...extraFilters]);
    const bundled = renderExportTemplates(BUNDLED_SYNTAX_FILTERS, variables);
    const resolved = [...filters];
    const resolvedExtraArgs = [...extraArgs];
    for (const [index, filter] of bundled.entries()) {
        if (configured.has(filter)) continue;
        // A missing later filter must also follow earlier bundled filters
        // supplied in extra args, where Pandoc executes them in argument order.
        if (bundled.slice(0, index).some(value => extraFilters.includes(value))) {
            resolvedExtraArgs.push('--lua-filter', filter);
            continue;
        }
        const next = resolved.findIndex(value => bundled.slice(index + 1).includes(value));
        resolved.splice(next < 0 ? resolved.length : next, 0, filter);
    }
    return {
        reader: joinPath(variables.luaFilterDir, 'CustomLabelReader.lua') + markdown[1],
        filters: resolved,
        extraArgs: resolvedExtraArgs
    };
}

function readLuaFilterArgs(args: string[]): string[] {
    const filters: string[] = [];
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--lua-filter' || arg === '-L') {
            const value = args[++index];
            if (value) filters.push(value);
        } else if (arg.startsWith('--lua-filter=')) {
            filters.push(arg.slice('--lua-filter='.length));
        } else if (arg.startsWith('-L') && arg.length > 2) {
            filters.push(arg.slice(2));
        }
    }
    return filters;
}
