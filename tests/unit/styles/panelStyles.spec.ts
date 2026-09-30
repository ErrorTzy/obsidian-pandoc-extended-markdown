import { readFileSync } from 'fs';
import { join } from 'path';

describe('structured panel styles', () => {
    const styles = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');

    it('keeps long item identities above their definitions at every panel width', () => {
        const columnRules = Array.from(styles.matchAll(/\.pem-panel-item\s*\{([^}]*)\}/g), match =>
            match[1].match(/grid-template-columns:\s*([^;]+);/)?.[1]
        ).filter(Boolean);
        const identityRule = styles.match(/\.pem-panel-item-identity\s*\{([^}]*)\}/)?.[1];

        expect(columnRules).toEqual(['minmax(0, 1fr)']);
        expect(identityRule).toMatch(/overflow-wrap:\s*anywhere/);
    });

    it('fades collapsed previews without assuming a panel background color', () => {
        expect(styles).toMatch(
            /\.pem-panel-item-preview\.is-collapsed\.is-overflowing\s*\{[^}]*-webkit-mask-image:\s*linear-gradient/s
        );
        expect(styles).toMatch(
            /\.pem-panel-item-preview\.is-collapsed\.is-overflowing\s*\{[^}]*mask-image:\s*linear-gradient/s
        );
        expect(styles).not.toMatch(
            /\.pem-panel-item-preview\.is-collapsed\.is-overflowing::after\s*\{[^}]*background:/s
        );
    });
});
