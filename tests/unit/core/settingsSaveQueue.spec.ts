import { PandocExtendedMarkdownPlugin } from '../../../src/core/main';
import { DEFAULT_SETTINGS } from '../../../src/core/settings';

describe('settings save queue', () => {
    it('saves the latest settings again after a save request arrives while saving', async () => {
        const plugin = new PandocExtendedMarkdownPlugin(undefined as never, undefined as never);
        const pendingSaves: Array<{
            snapshot: typeof DEFAULT_SETTINGS;
            resolve: () => void;
        }> = [];
        plugin.settings = {
            ...DEFAULT_SETTINGS,
            enableFencedDivs: false
        };
        plugin.saveData = jest.fn((data: unknown) => new Promise<void>(resolve => {
            pendingSaves.push({
                snapshot: JSON.parse(JSON.stringify(data)),
                resolve
            });
        }));

        const firstSave = plugin.saveSettings();
        plugin.settings.enableFencedDivs = true;
        const secondSave = plugin.saveSettings();

        expect(pendingSaves).toHaveLength(1);
        expect(pendingSaves[0].snapshot.enableFencedDivs).toBe(false);

        pendingSaves[0].resolve();
        await Promise.resolve();

        expect(pendingSaves).toHaveLength(2);
        expect(pendingSaves[1].snapshot.enableFencedDivs).toBe(true);

        pendingSaves[1].resolve();
        await Promise.all([firstSave, secondSave]);
        expect(plugin.saveData).toHaveBeenCalledTimes(2);
    });
});
