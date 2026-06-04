import type {
    PandocDescriptionBlock
} from './types';

export function parseDescriptionBlocks(lines: string[]): PandocDescriptionBlock[] {
    const blocks: PandocDescriptionBlock[] = [];
    let current: PandocDescriptionBlock | undefined;

    for (const line of lines) {
        const trimmed = normalizeDescriptionLine(line);
        if (!trimmed) {
            current = undefined;
            continue;
        }

        const bullet = trimmed.match(/^•\s*(.*)$/);
        if (bullet) {
            current = { type: 'bullet', text: bullet[1] };
            blocks.push(current);
            continue;
        }

        if (!current) {
            current = { type: 'paragraph', text: trimmed };
            blocks.push(current);
        } else {
            current.text = normalizeDescriptionLine(`${current.text} ${trimmed}`);
        }
    }

    return blocks;
}

export function optionDescriptionText(blocks: PandocDescriptionBlock[]): string {
    return blocks.map(formatDescriptionBlock).join('\n\n');
}

export function formatDescriptionBlock(block: PandocDescriptionBlock): string {
    return block.type === 'bullet' ? `• ${block.text}` : block.text;
}

function normalizeDescriptionLine(line: string): string {
    return line
        .trim()
        .replace(/[\u00ad\u2010]\s+/g, '')
        .replace(/\s+/g, ' ');
}
