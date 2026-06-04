import {
    strFromU8,
    unzipSync
} from 'fflate';

export interface PreviewPageSize {
    widthPx: number;
    heightPx: number;
    marginsPx?: PreviewPageMargins;
    headerHeightPx?: number;
    footerHeightPx?: number;
}

export interface PreviewPageMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

const CSS_PX_PER_INCH = 96;
const EMU_PER_INCH = 914400;
const TWIPS_PER_INCH = 1440;

export const DEFAULT_DOCX_PAGE_SIZE: PreviewPageSize = {
    widthPx: 8.5 * CSS_PX_PER_INCH,
    heightPx: 11 * CSS_PX_PER_INCH,
    marginsPx: {
        top: CSS_PX_PER_INCH,
        right: CSS_PX_PER_INCH,
        bottom: CSS_PX_PER_INCH,
        left: CSS_PX_PER_INCH
    }
};

export const DEFAULT_ODT_PAGE_SIZE: PreviewPageSize = {
    widthPx: 210 * CSS_PX_PER_INCH / 25.4,
    heightPx: 297 * CSS_PX_PER_INCH / 25.4
};

export const DEFAULT_PPTX_PAGE_SIZE: PreviewPageSize = {
    widthPx: 10 * CSS_PX_PER_INCH,
    heightPx: 7.5 * CSS_PX_PER_INCH
};

export function extractDocxPageSizes(data: Uint8Array): PreviewPageSize[] {
    const documentXml = unzipText(data, 'word/document.xml');
    if (!documentXml) return [];

    const document = parseXml(documentXml);
    return elementsByLocalName(document, 'sectPr')
        .map(section => pageSizeFromDocxSection(section))
        .filter((pageSize): pageSize is PreviewPageSize => pageSize !== undefined);
}

export function extractOdtPageSizes(data: Uint8Array): PreviewPageSize[] {
    const documents = [
        unzipText(data, 'content.xml'),
        unzipText(data, 'styles.xml')
    ].filter((text): text is string => text !== undefined);

    const pageSizes = new Map<string, PreviewPageSize>();
    const masterPageLayoutNames: string[] = [];

    for (const xml of documents) {
        const document = parseXml(xml);
        for (const layout of elementsByLocalName(document, 'page-layout')) {
            const name = attrByLocalName(layout, 'name');
            const pageSize = pageSizeFromOdtLayout(layout);
            if (name && pageSize) pageSizes.set(name, pageSize);
        }
        for (const masterPage of elementsByLocalName(document, 'master-page')) {
            const layoutName = attrByLocalName(masterPage, 'page-layout-name');
            if (layoutName) masterPageLayoutNames.push(layoutName);
        }
    }

    const ordered = masterPageLayoutNames
        .map(name => pageSizes.get(name))
        .filter((pageSize): pageSize is PreviewPageSize => pageSize !== undefined);
    return ordered.length > 0 ? ordered : Array.from(pageSizes.values());
}

export function extractPptxPageSize(data: Uint8Array): PreviewPageSize | undefined {
    const presentationXml = unzipText(data, 'ppt/presentation.xml');
    if (!presentationXml) return undefined;

    const document = parseXml(presentationXml);
    const slideSize = elementsByLocalName(document, 'sldSz')[0];
    if (!slideSize) return undefined;

    const width = parsePositiveNumber(attrByLocalName(slideSize, 'cx'));
    const height = parsePositiveNumber(attrByLocalName(slideSize, 'cy'));
    if (!width || !height) return undefined;

    return {
        widthPx: width / EMU_PER_INCH * CSS_PX_PER_INCH,
        heightPx: height / EMU_PER_INCH * CSS_PX_PER_INCH
    };
}

export function pageSizeAt(
    pageSizes: PreviewPageSize[],
    index: number,
    fallback: PreviewPageSize
): PreviewPageSize {
    return pageSizes[index] ?? pageSizes[pageSizes.length - 1] ?? fallback;
}

function pageSizeFromDocxSection(section: Element): PreviewPageSize | undefined {
    const pageSize = firstChildByLocalName(section, 'pgSz');
    if (!pageSize) return undefined;

    const pageMargins = firstChildByLocalName(section, 'pgMar');
    return pageSizeFromDocx(pageSize, pageMargins);
}

function pageSizeFromDocx(
    element: Element,
    marginsElement?: Element
): PreviewPageSize | undefined {
    const width = parsePositiveNumber(attrByLocalName(element, 'w'));
    const height = parsePositiveNumber(attrByLocalName(element, 'h'));
    if (!width || !height) return undefined;

    return orientPageSize({
        widthPx: width / TWIPS_PER_INCH * CSS_PX_PER_INCH,
        heightPx: height / TWIPS_PER_INCH * CSS_PX_PER_INCH,
        marginsPx: marginsElement ? docxMargins(marginsElement) : DEFAULT_DOCX_PAGE_SIZE.marginsPx
    }, attrByLocalName(element, 'orient'));
}

function docxMargins(element: Element): PreviewPageMargins {
    return {
        top: docxMarginPx(attrByLocalName(element, 'top'), DEFAULT_DOCX_PAGE_SIZE.marginsPx?.top ?? 0),
        right: docxMarginPx(attrByLocalName(element, 'right'), DEFAULT_DOCX_PAGE_SIZE.marginsPx?.right ?? 0),
        bottom: docxMarginPx(attrByLocalName(element, 'bottom'), DEFAULT_DOCX_PAGE_SIZE.marginsPx?.bottom ?? 0),
        left: docxMarginPx(attrByLocalName(element, 'left'), DEFAULT_DOCX_PAGE_SIZE.marginsPx?.left ?? 0)
    };
}

function docxMarginPx(value: string | undefined, fallback: number): number {
    const twips = parseNonNegativeNumber(value);
    return twips !== undefined ? twips / TWIPS_PER_INCH * CSS_PX_PER_INCH : fallback;
}

function pageSizeFromOdtLayout(layout: Element): PreviewPageSize | undefined {
    const properties = firstChildByLocalName(layout, 'page-layout-properties');
    if (!properties) return undefined;

    const width = parseCssLengthPx(attrByLocalName(properties, 'page-width'));
    const height = parseCssLengthPx(attrByLocalName(properties, 'page-height'));
    if (!width || !height) return undefined;

    return orientPageSize({
        widthPx: width,
        heightPx: height,
        marginsPx: odtMargins(properties),
        headerHeightPx: odtHeaderFooterExtent(layout, 'header-style'),
        footerHeightPx: odtHeaderFooterExtent(layout, 'footer-style')
    }, attrByLocalName(properties, 'print-orientation'));
}

function odtMargins(element: Element): PreviewPageMargins {
    const shorthand = parseCssLengthPx(attrByLocalName(element, 'margin'), { allowZero: true }) ?? 0;
    return {
        top: odtMarginPx(element, 'top', shorthand),
        right: odtMarginPx(element, 'right', shorthand),
        bottom: odtMarginPx(element, 'bottom', shorthand),
        left: odtMarginPx(element, 'left', shorthand)
    };
}

function odtMarginPx(element: Element, side: string, fallback: number): number {
    return parseCssLengthPx(attrByLocalName(element, `margin-${side}`), { allowZero: true }) ?? fallback;
}

function odtHeaderFooterExtent(layout: Element, styleName: string): number {
    const style = firstChildByLocalName(layout, styleName);
    const properties = style ? firstChildByLocalName(style, 'header-footer-properties') : undefined;
    if (!properties) return 0;

    const minHeight = parseCssLengthPx(attrByLocalName(properties, 'min-height'), { allowZero: true }) ?? 0;
    const height = parseCssLengthPx(attrByLocalName(properties, 'height'), { allowZero: true }) ?? 0;
    const spacing = styleName === 'header-style' ?
        parseCssLengthPx(attrByLocalName(properties, 'margin-bottom'), { allowZero: true }) ?? 0 :
        parseCssLengthPx(attrByLocalName(properties, 'margin-top'), { allowZero: true }) ?? 0;
    return Math.max(minHeight, height) + spacing;
}

function orientPageSize(pageSize: PreviewPageSize, orientation?: string): PreviewPageSize {
    if (orientation === 'landscape' && pageSize.widthPx < pageSize.heightPx) {
        return { widthPx: pageSize.heightPx, heightPx: pageSize.widthPx };
    }
    if (orientation === 'portrait' && pageSize.widthPx > pageSize.heightPx) {
        return { widthPx: pageSize.heightPx, heightPx: pageSize.widthPx };
    }

    return pageSize;
}

function parseCssLengthPx(
    value?: string,
    options: { allowZero?: boolean } = {}
): number | undefined {
    const match = value?.trim().match(/^(-?\d+(?:\.\d+)?)([a-z%]*)$/i);
    if (!match) return undefined;

    const amount = Number.parseFloat(match[1]);
    if (!Number.isFinite(amount) || amount < 0 || (!options.allowZero && amount === 0)) return undefined;

    switch (match[2].toLowerCase()) {
        case '':
        case 'px':
            return amount;
        case 'in':
            return amount * CSS_PX_PER_INCH;
        case 'cm':
            return amount * CSS_PX_PER_INCH / 2.54;
        case 'mm':
            return amount * CSS_PX_PER_INCH / 25.4;
        case 'pt':
            return amount * CSS_PX_PER_INCH / 72;
        case 'pc':
            return amount * 16;
        default:
            return undefined;
    }
}

function parsePositiveNumber(value?: string): number | undefined {
    const number = Number.parseFloat(value ?? '');
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

function parseNonNegativeNumber(value?: string): number | undefined {
    const number = Number.parseFloat(value ?? '');
    return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function unzipText(data: Uint8Array, path: string): string | undefined {
    try {
        const entries = unzipSync(data);
        const content = entries[path];
        return content ? strFromU8(content) : undefined;
    } catch {
        return undefined;
    }
}

function parseXml(xml: string): Document {
    return new DOMParser().parseFromString(xml, 'application/xml');
}

function elementsByLocalName(root: Document | Element, localName: string): Element[] {
    return Array.from(root.getElementsByTagName('*'))
        .filter((element): element is Element => hasLocalName(element, localName));
}

function firstChildByLocalName(parent: Element, localName: string): Element | undefined {
    return Array.from(parent.children)
        .find(child => hasLocalName(child, localName));
}

function attrByLocalName(element: Element, localName: string): string | undefined {
    return Array.from(element.attributes)
        .find(attribute => hasLocalName(attribute, localName))
        ?.value;
}

function hasLocalName(node: Element | Attr, localName: string): boolean {
    return node.localName === localName ||
        node.nodeName === localName ||
        node.nodeName.endsWith(`:${localName}`);
}
