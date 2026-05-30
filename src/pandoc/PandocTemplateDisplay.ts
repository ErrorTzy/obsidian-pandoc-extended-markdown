import { renderExportTemplate } from './template';
import type { ExportVariables } from './types';

export interface ValueDisplayPart {
    text: string;
    muted: boolean;
}

export interface ValueDisplay {
    text: string;
    parts: ValueDisplayPart[];
}

export interface VariableSuggestion {
    name: string;
    value: string;
}

const TEMPLATE_VARIABLE_NAMES = [
    'currentPath',
    'currentDir',
    'currentFileName',
    'currentFileFullName',
    'outputPath',
    'outputDir',
    'outputFileName',
    'outputFileFullName',
    'outputExtension',
    'vaultDir',
    'attachmentFolderPath',
    'embedDirs',
    'pluginDir',
    'luaFilterDir',
    'fromFormat'
];

const TEMPLATE_VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function renderTemplateValueDisplay(
    template: string,
    variables: ExportVariables,
    displayVariables: ExportVariables
): ValueDisplay {
    const parts: ValueDisplayPart[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    TEMPLATE_VARIABLE.lastIndex = 0;
    while ((match = TEMPLATE_VARIABLE.exec(template)) !== null) {
        appendDisplayPart(parts, template.slice(lastIndex, match.index), false);
        for (const part of variableDisplayParts(match[0], variables, displayVariables)) {
            appendDisplayPart(parts, part.text, part.muted);
        }
        lastIndex = match.index + match[0].length;
    }
    appendDisplayPart(parts, template.slice(lastIndex), false);

    return {
        parts,
        text: parts.map(part => part.text).join('')
    };
}

export function getVariableSuggestions(
    query: string,
    variables: ExportVariables
): VariableSuggestion[] {
    const lowerQuery = query.toLowerCase();
    return TEMPLATE_VARIABLE_NAMES
        .filter(name => variables[name] !== undefined)
        .filter(name => name.toLowerCase().startsWith(lowerQuery))
        .slice(0, 8)
        .map(name => ({
            name,
            value: renderExportTemplate(`\${${name}}`, variables)
        }));
}

function variableDisplayParts(
    variableTemplate: string,
    variables: ExportVariables,
    displayVariables: ExportVariables
): ValueDisplayPart[] {
    const value = renderExportTemplate(variableTemplate, variables);
    const variableValue = renderExportTemplate(variableTemplate, displayVariables);
    if (value === variableTemplate) return [{ text: variableTemplate, muted: false }];
    if (!variableValue) return [{ text: value, muted: true }];
    if (!value.endsWith(variableValue) || value === variableValue) {
        return [{ text: value, muted: false }];
    }

    return [
        { text: value.slice(0, -variableValue.length), muted: true },
        { text: variableValue, muted: false }
    ].filter(part => part.text.length > 0);
}

function appendDisplayPart(
    parts: ValueDisplayPart[],
    text: string,
    muted: boolean
): void {
    if (!text) return;
    const previous = parts[parts.length - 1];
    if (previous?.muted === muted) {
        previous.text += text;
        return;
    }

    parts.push({ text, muted });
}
