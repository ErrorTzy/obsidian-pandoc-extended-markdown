import {
    ExportVariables,
    PandocExportProfile
} from './types';
import {
    renderExportTemplate,
    renderExportTemplates
} from './template';
import { inferOutputExtension } from './outputExtension';

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
    const args = [
        renderExportTemplate(profile.inputPath ?? '${currentPath}', effectiveVariables),
        '-f',
        renderExportTemplate(profile.from ?? variables.fromFormat, effectiveVariables),
        '-t',
        to
    ];

    appendOutputArgs(args, profile, effectiveVariables);

    if (profile.standalone) {
        args.push('--standalone');
    }

    appendRepeatedArgs(args, '--resource-path', profile.resourcePaths, effectiveVariables);
    appendRepeatedArgs(args, '--lua-filter', profile.luaFilters, effectiveVariables);
    appendMetadataArgs(args, profile.metadata, effectiveVariables);

    return [
        ...args,
        ...renderExportTemplates(profile.extraArgs, effectiveVariables),
        ...(request.extraArgs ?? [])
    ];
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
