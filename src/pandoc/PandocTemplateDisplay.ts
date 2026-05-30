import { renderExportTemplate } from './template';
import { buildTemplateVariableContext } from './templateVariables';
import type { ExportVariables } from './types';
import type { TemplateVariableContext } from './templateVariables';

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

const TEMPLATE_VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function renderTemplateValueDisplay(
    template: string,
    variables: ExportVariables & Record<string, unknown>,
    displayVariables: ExportVariables & Record<string, unknown>
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
    context: TemplateVariableContext | ExportVariables
): VariableSuggestion[] {
    const lowerQuery = query.toLowerCase();
    const normalized = normalizeSuggestionContext(context);
    return [
        ...normalized.builtInNames,
        ...normalized.runtimeEnvNames
    ]
        .filter(name => name.toLowerCase().startsWith(lowerQuery))
        .map(name => ({
            name,
            value: renderExportTemplate(`\${${name}}`, normalized.variables)
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

function normalizeSuggestionContext(
    context: TemplateVariableContext | ExportVariables
): TemplateVariableContext {
    if ('variables' in context && 'builtInNames' in context && 'runtimeEnvNames' in context) {
        return context;
    }

    return buildTemplateVariableContext(context);
}
