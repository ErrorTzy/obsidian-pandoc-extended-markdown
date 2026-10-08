import {
    ExportVariables,
    PandocExportProfile
} from '../export/types';
import {
    renderExportTemplate,
    renderExportTemplates
} from '../templates/template';
import { inferOutputExtension } from '../export/outputExtension';
import { resolveBundledSyntax } from './bundledSyntax';

export interface BuildProfileArgsRequest {
    profile: PandocExportProfile;
    variables: ExportVariables;
    extraArgs?: string[];
}

export function buildPandocProfileArgs(request: BuildProfileArgsRequest): string[] {
    const { profile, variables } = request;
    const to = renderExportTemplate(profile.to, variables);
    const effectiveVariables = {
        ...variables,
        outputExtension: inferOutputExtension(to, variables.outputExtension)
    };
    const from = renderExportTemplate(profile.from ?? variables.fromFormat, effectiveVariables);
    const extraArgs = [
        ...renderExportTemplates(profile.extraArgs, effectiveVariables),
        ...(request.extraArgs ?? [])
    ];
    const { reader, filters, extraArgs: resolvedExtraArgs } = resolveBundledSyntax(
        from, renderExportTemplates(profile.luaFilters, effectiveVariables), extraArgs, effectiveVariables
    );
    const args = [
        renderExportTemplate(profile.inputPath ?? '${currentPath}', effectiveVariables),
        '-f',
        reader,
        '-t',
        to
    ];

    if (reader !== from) args.push('--preserve-tabs');

    appendOutputArgs(args, profile, effectiveVariables);

    if (profile.standalone) {
        args.push('--standalone');
    }

    appendRepeatedArgs(args, '--resource-path', profile.resourcePaths, effectiveVariables);
    for (const filter of filters) {
        if (filter.length > 0) args.push('--lua-filter', filter);
    }
    appendMetadataArgs(args, profile.metadata, effectiveVariables);

    return [...args, ...resolvedExtraArgs];
}

function appendOutputArgs(
    args: string[],
    profile: PandocExportProfile,
    variables: ExportVariables
): void {
    if (profile.outputPath) {
        args.push('-o', renderExportTemplate(profile.outputPath, variables));
        return;
    }

    const profileHasOutput = (profile.extraArgs ?? [])
        .some(arg => arg === '-o' || arg === '--output' || arg.startsWith('--output='));

    if (!profileHasOutput) {
        args.push('-o', variables.outputPath);
    }
}

function appendRepeatedArgs(
    args: string[],
    option: string,
    values: string[] | undefined,
    variables: ExportVariables
): void {
    for (const value of renderExportTemplates(values, variables)) {
        if (value.length > 0) {
            args.push(option, value);
        }
    }
}

function appendMetadataArgs(
    args: string[],
    metadata: Record<string, string> | undefined,
    variables: ExportVariables
): void {
    for (const [key, value] of Object.entries(metadata ?? {})) {
        args.push('--metadata', `${key}=${renderExportTemplate(value, variables)}`);
    }
}
