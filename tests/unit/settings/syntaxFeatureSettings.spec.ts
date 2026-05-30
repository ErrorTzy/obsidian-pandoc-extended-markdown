import { createProcessorConfig } from '../../../src/shared/types/processorConfig';
import { normalizeSettings } from '../../../src/shared/types/settingsTypes';

describe('Syntax feature settings', () => {
    it('enables custom labels and list renumbering by default', () => {
        const settings = normalizeSettings({});

        expect(settings.strictPandocMode).toBe(false);
        expect(settings.enableCustomLabelLists).toBe(true);
        expect(settings.enableFencedDivExtras).toBe(true);
        expect(settings.autoRenumberLists).toBe(true);
    });

    it('keeps custom labels disabled when only the granular toggle is false', () => {
        const settings = normalizeSettings({
            enableCustomLabelLists: false
        });

        expect(settings.enableCustomLabelLists).toBe(false);
    });

    it('ignores unknown saved settings', () => {
        const settings = normalizeSettings({
            enableCustomLabelLists: false,
            unusedSavedFlag: true
        } as Partial<ReturnType<typeof normalizeSettings>>);

        expect(settings.enableCustomLabelLists).toBe(false);
        expect(settings).not.toHaveProperty('unusedSavedFlag');
    });

    it('fills pandoc export defaults without affecting rendering defaults', () => {
        const settings = normalizeSettings({
            enableCustomLabelLists: false,
            pandocExport: {
                enabled: true,
                profiles: []
            }
        } as Partial<ReturnType<typeof normalizeSettings>>);

        expect(settings.enableCustomLabelLists).toBe(false);
        expect(settings.enableFencedDivs).toBe(true);
        expect(settings.pandocExport?.enabled).toBe(true);
        expect(settings.pandocExport?.pandocPath).toBe('');
        expect(settings.pandocExport?.suggestRuntimeEnvVariables).toBe(false);
        expect(settings.pandocExport?.profiles.some(profile => profile.id === 'html')).toBe(true);
    });

    it('preserves the opt-in runtime env suggestion setting', () => {
        const settings = normalizeSettings({
            pandocExport: {
                suggestRuntimeEnvVariables: true
            }
        } as Partial<ReturnType<typeof normalizeSettings>>);

        expect(settings.pandocExport?.suggestRuntimeEnvVariables).toBe(true);
    });

    it('keeps custom labels enabled in processor config when strict mode is enabled', () => {
        const config = createProcessorConfig(
            { strictLineBreaks: false },
            {
                strictPandocMode: true,
                enableCustomLabelLists: true
            }
        );

        expect(config.enableCustomLabelLists).toBe(true);
    });

    it('defaults fenced div extras on and disables them when either fenced div toggle is off', () => {
        const enabled = createProcessorConfig({ strictLineBreaks: false }, {});
        const extrasDisabled = createProcessorConfig(
            { strictLineBreaks: false },
            { enableFencedDivExtras: false }
        );
        const fencedDivsDisabled = createProcessorConfig(
            { strictLineBreaks: false },
            { enableFencedDivs: false, enableFencedDivExtras: true }
        );

        expect(enabled.enableFencedDivExtras).toBe(true);
        expect(extrasDisabled.enableFencedDivExtras).toBe(false);
        expect(fencedDivsDisabled.enableFencedDivExtras).toBe(false);
    });

    it('preserves split superscript and subscript flags in processor config', () => {
        const config = createProcessorConfig(
            { strictLineBreaks: false },
            {
                enableSuperscript: false,
                enableSubscript: true
            }
        );

        expect(config.enableSuperSubscripts).toBe(true);
        expect(config.enableSuperscript).toBe(false);
        expect(config.enableSubscript).toBe(true);
    });

    it('enables unordered list enhancements by default', () => {
        const settings = normalizeSettings({});
        const config = createProcessorConfig({ strictLineBreaks: false }, settings);

        expect(settings.enableUnorderedListMarkerCycling).toBe(true);
        expect(settings.enableUnorderedListMarkerStyles).toBe(true);
        expect(settings.unorderedListMarkerOrder).toEqual(['-', '+', '*']);
        expect(config.enableUnorderedListMarkerStyles).toBe(true);
    });

    it('preserves disabled unordered list enhancement settings', () => {
        const settings = normalizeSettings({
            enableUnorderedListMarkerCycling: false,
            enableUnorderedListMarkerStyles: false
        });
        const config = createProcessorConfig({ strictLineBreaks: false }, settings);

        expect(settings.enableUnorderedListMarkerCycling).toBe(false);
        expect(settings.enableUnorderedListMarkerStyles).toBe(false);
        expect(config.enableUnorderedListMarkerStyles).toBe(false);
    });

    it('enables ordered list marker cycling by default', () => {
        const settings = normalizeSettings({});

        expect(settings.enableOrderedListMarkerCycling).toBe(true);
        expect(settings.unorderedListMarkerOrder).toEqual(['-', '+', '*']);
        expect(settings.orderedListMarkerOrder).toEqual([
            'decimal-period',
            'lower-alpha-period',
            'lower-roman-period',
            'upper-alpha-period',
            'upper-roman-period',
            'decimal-one-paren',
            'lower-alpha-one-paren',
            'lower-roman-one-paren',
            'upper-alpha-one-paren',
            'upper-roman-one-paren'
        ]);
    });
});
