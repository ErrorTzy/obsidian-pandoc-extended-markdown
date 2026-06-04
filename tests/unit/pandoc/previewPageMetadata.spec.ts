import { describe, expect, it } from '@jest/globals';
import { zipSync } from 'fflate';

import {
    extractDocxPageSizes,
    extractOdtPageSizes,
    extractPptxPageSize
} from '../../../src/pandoc/gui/obsidian/renderers/previewPageMetadata';

describe('preview page metadata', () => {
    it('extracts DOCX page sizes from section properties', () => {
        const sizes = extractDocxPageSizes(zip({
            'word/document.xml': [
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
                '<w:body><w:p/><w:sectPr>',
                '<w:pgSz w:w="12240" w:h="15840"/>',
                '<w:pgMar w:top="1440" w:right="1800" w:bottom="720" w:left="1080"/>',
                '</w:sectPr></w:body>',
                '</w:document>'
            ].join('')
        }));

        expect(sizes).toHaveLength(1);
        expect(sizes[0].widthPx).toBeCloseTo(816);
        expect(sizes[0].heightPx).toBeCloseTo(1056);
        expect(sizes[0].marginsPx?.top).toBeCloseTo(96);
        expect(sizes[0].marginsPx?.right).toBeCloseTo(120);
        expect(sizes[0].marginsPx?.bottom).toBeCloseTo(48);
        expect(sizes[0].marginsPx?.left).toBeCloseTo(72);
    });

    it('preserves zero DOCX page margins', () => {
        const sizes = extractDocxPageSizes(zip({
            'word/document.xml': [
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
                '<w:body><w:sectPr>',
                '<w:pgSz w:w="12240" w:h="15840"/>',
                '<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0"/>',
                '</w:sectPr></w:body>',
                '</w:document>'
            ].join('')
        }));

        expect(sizes[0].marginsPx).toEqual({
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        });
    });

    it('extracts ODT page sizes from page layout styles', () => {
        const sizes = extractOdtPageSizes(zip({
            'content.xml': [
                '<office:document-content',
                ' xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
                ' xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
                ' xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">',
                '<office:automatic-styles>',
                '<style:page-layout style:name="pm1">',
                '<style:page-layout-properties fo:page-width="11in" fo:page-height="8.5in"',
                ' style:print-orientation="landscape" fo:margin-top="0.7in"',
                ' fo:margin-right="0.8in" fo:margin-bottom="0.9in" fo:margin-left="1in"/>',
                '<style:header-style>',
                '<style:header-footer-properties fo:min-height="0.3in" fo:margin-bottom="0.2in"/>',
                '</style:header-style>',
                '<style:footer-style>',
                '<style:header-footer-properties fo:min-height="0.4in" fo:margin-top="0.1in"/>',
                '</style:footer-style>',
                '</style:page-layout>',
                '</office:automatic-styles>',
                '<office:master-styles><style:master-page style:page-layout-name="pm1"/></office:master-styles>',
                '</office:document-content>'
            ].join('')
        }));

        expect(sizes).toHaveLength(1);
        expect(sizes[0].widthPx).toBeCloseTo(1056);
        expect(sizes[0].heightPx).toBeCloseTo(816);
        expect(sizes[0].marginsPx?.top).toBeCloseTo(67.2);
        expect(sizes[0].marginsPx?.right).toBeCloseTo(76.8);
        expect(sizes[0].marginsPx?.bottom).toBeCloseTo(86.4);
        expect(sizes[0].marginsPx?.left).toBeCloseTo(96);
        expect(sizes[0].headerHeightPx).toBeCloseTo(48);
        expect(sizes[0].footerHeightPx).toBeCloseTo(48);
    });

    it('extracts PPTX slide size from presentation metadata', () => {
        const size = extractPptxPageSize(zip({
            'ppt/presentation.xml': [
                '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
                '<p:sldSz cx="12192000" cy="6858000"/>',
                '</p:presentation>'
            ].join('')
        }));

        expect(size?.widthPx).toBeCloseTo(1280);
        expect(size?.heightPx).toBeCloseTo(720);
    });
});

function zip(entries: Record<string, string>): Uint8Array {
    return zipSync(Object.fromEntries(
        Object.entries(entries).map(([path, content]) => [path, asciiBytes(content)])
    ));
}

function asciiBytes(text: string): Uint8Array {
    return new Uint8Array(Array.from(text).map(char => char.charCodeAt(0)));
}
