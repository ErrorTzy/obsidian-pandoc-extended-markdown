import { createProcessorConfig } from '../../../src/shared/types/processorConfig';
import {
    normalizeSettings,
    isSyntaxFeatureEnabled
} from '../../../src/shared/types/settingsTypes';

describe('Syntax feature settings', () => {
    it('migrates legacy moreExtendedSyntax into custom label feature settings', () => {
        const settings = normalizeSettings({
            moreExtendedSyntax: true
        });

        expect(settings.enableCustomLabelLists).toBe(true);
        expect(settings.moreExtendedSyntax).toBe(true);
        expect(isSyntaxFeatureEnabled(settings, 'enableCustomLabelLists')).toBe(true);
    });

    it('keeps custom labels disabled when only the granular toggle is false', () => {
        const settings = normalizeSettings({
            enableCustomLabelLists: false
        });

        expect(settings.enableCustomLabelLists).toBe(false);
        expect(settings.moreExtendedSyntax).toBe(false);
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
});
