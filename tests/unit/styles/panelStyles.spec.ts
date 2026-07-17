import { readFileSync } from 'fs';
import { join } from 'path';

describe('structured panel styles', () => {
    const styles = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');

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
