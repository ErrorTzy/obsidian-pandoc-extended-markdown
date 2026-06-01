import type {
    OptionValueAlternative,
    OptionValueKind,
    OptionSpec
} from './types';

export type PandocValueWidgetType =
    | 'noneWidget'
    | 'selectWidget'
    | 'formatWidget'
    | 'numberWidget'
    | 'keyWidget'
    | 'keyValueWidget'
    | 'pathWidget'
    | 'textWidget';

export interface PandocValueWidgetRoute {
    widgetType: PandocValueWidgetType;
    pandocValueType: string;
    placeholder: string;
    separator?: string;
    inputType?: 'number' | 'text';
}

export type PandocValueWidgetSource = Pick<
    OptionSpec | OptionValueAlternative,
    'valueKind' | 'values'
> & {
    id?: string;
    valuePlaceholder?: string;
    placeholder?: string;
};

const PANDOC_VALUE_WIDGET_TYPES: Record<string, PandocValueWidgetType> = {
    NONE: 'noneWidget',
    BOOLEAN: 'selectWidget',
    ENUM: 'selectWidget',
    STYLE: 'selectWidget',
    NUMBER: 'numberWidget',
    NUMBERS: 'numberWidget',
    FORMAT: 'formatWidget',
    FILE: 'pathWidget',
    SCRIPT: 'pathWidget',
    SCRIPTPATH: 'pathWidget',
    THEMEPATH: 'pathWidget',
    DIRECTORY: 'pathWidget',
    DIRNAME: 'pathWidget',
    DIR: 'pathWidget',
    SEARCHPATH: 'pathWidget',
    PATH: 'pathWidget',
    URL: 'textWidget',
    KEY: 'keyWidget',
    'KEY=VAL': 'keyValueWidget',
    'KEY:VAL': 'keyValueWidget',
    VALUE: 'keyWidget',
    VAL: 'keyWidget',
    JSON: 'keyWidget'
};

const KIND_WIDGET_TYPES: Record<OptionValueKind, PandocValueWidgetType> = {
    none: 'noneWidget',
    string: 'textWidget',
    integer: 'numberWidget',
    number: 'numberWidget',
    enum: 'selectWidget',
    format: 'formatWidget',
    file: 'pathWidget',
    directory: 'pathWidget',
    path: 'pathWidget',
    pathList: 'pathWidget',
    keyValue: 'keyWidget'
};

export function resolvePandocValueWidget(
    source: PandocValueWidgetSource | undefined
): PandocValueWidgetRoute {
    if (!source) return textWidgetRoute('Value', 'string');

    const pandocValueType = pandocValueTypeText(source);
    const explicit = routeForPandocValueType(pandocValueType);
    if (explicit) return explicit;

    const widgetType = source.values?.length ? 'selectWidget' : KIND_WIDGET_TYPES[source.valueKind];
    return {
        widgetType,
        pandocValueType,
        placeholder: placeholderForWidget(widgetType, pandocValueType),
        inputType: widgetType === 'numberWidget' ? 'number' : 'text'
    };
}

export function pandocValueWidgetTypeMap(): Record<string, PandocValueWidgetType> {
    return { ...PANDOC_VALUE_WIDGET_TYPES };
}

function routeForPandocValueType(pandocValueType: string): PandocValueWidgetRoute | undefined {
    const separator = keyValueSeparator(pandocValueType);
    if (separator) {
        return {
            widgetType: 'keyValueWidget',
            pandocValueType,
            placeholder: pandocValueType,
            separator
        };
    }

    const widgetType = PANDOC_VALUE_WIDGET_TYPES[pandocValueType];
    if (!widgetType) return undefined;
    return {
        widgetType,
        pandocValueType,
        placeholder: placeholderForWidget(widgetType, pandocValueType),
        inputType: widgetType === 'numberWidget' ? 'number' : 'text'
    };
}

function textWidgetRoute(placeholder: string, pandocValueType: string): PandocValueWidgetRoute {
    return {
        widgetType: 'textWidget',
        pandocValueType,
        placeholder,
        inputType: 'text'
    };
}

function pandocValueTypeText(source: PandocValueWidgetSource): string {
    return source.valuePlaceholder ?? source.placeholder ?? source.id ?? source.valueKind;
}

function keyValueSeparator(pandocValueType: string): string | undefined {
    const match = pandocValueType.match(/^[A-Z][A-Za-z0-9_.,-]*([:=])[A-Z][A-Za-z0-9_.,:=-]*$/);
    return match?.[1];
}

function placeholderForWidget(widgetType: PandocValueWidgetType, pandocValueType: string): string {
    if (widgetType === 'numberWidget') return 'Value';
    if (widgetType === 'textWidget') return 'Value';
    return pandocValueType;
}
