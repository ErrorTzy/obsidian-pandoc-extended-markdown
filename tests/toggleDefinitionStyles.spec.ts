import { PandocExtendedMarkdownPlugin } from '../src/main';

describe('Toggle Definition Styles', () => {
    let plugin: PandocExtendedMarkdownPlugin;

    beforeEach(() => {
        // Create a minimal plugin instance for testing
        plugin = new PandocExtendedMarkdownPlugin();
    });

    describe('toggleDefinitionUnderlineStyle', () => {
        it('should add underline spans to definition terms without underline', () => {
            const input = `Term 1
:   Definition of term 1

Term 2
~   Definition of term 2`;

            const expected = `<span class="underline">Term 1</span>
:   Definition of term 1

<span class="underline">Term 2</span>
~   Definition of term 2`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should remove underline spans from definition terms with underline', () => {
            const input = `<span class="underline">Term 1</span>
:   Definition of term 1

<span class="underline">Term 2</span>
~   Definition of term 2`;

            const expected = `Term 1
:   Definition of term 1

Term 2
~   Definition of term 2`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should handle mixed underline states - removes all if any have underline', () => {
            const input = `<span class="underline">Term 1</span>
:   Definition of term 1

Term 2
~   Definition of term 2

<span class="underline">Term 3</span>
:   Definition of term 3`;

            const expected = `Term 1
:   Definition of term 1

Term 2
~   Definition of term 2

Term 3
:   Definition of term 3`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should preserve indentation', () => {
            const input = `    Term 1
    :   Definition of term 1

        Term 2
        ~   Definition of term 2`;

            const expected = `    <span class="underline">Term 1</span>
    :   Definition of term 1

        <span class="underline">Term 2</span>
        ~   Definition of term 2`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should handle terms with existing bold formatting', () => {
            const input = `**Term 1**
:   Definition of term 1

**Term 2**
~   Definition of term 2`;

            const expected = `<span class="underline">**Term 1**</span>
:   Definition of term 1

<span class="underline">**Term 2**</span>
~   Definition of term 2`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should handle terms with both bold and underline', () => {
            const input = `<span class="underline">**Term 1**</span>
:   Definition of term 1

<span class="underline">**Term 2**</span>
~   Definition of term 2`;

            const expected = `**Term 1**
:   Definition of term 1

**Term 2**
~   Definition of term 2`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should not affect non-definition list content', () => {
            const input = `# Header

Regular paragraph

- Bullet list
- Another item

Term 1
:   Definition of term 1`;

            const expected = `# Header

Regular paragraph

- Bullet list
- Another item

<span class="underline">Term 1</span>
:   Definition of term 1`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should handle empty input', () => {
            const input = '';
            const expected = '';
            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });

        it('should handle input without definition lists', () => {
            const input = `# Header

Regular paragraph

- Bullet list
- Another item`;

            const expected = `# Header

Regular paragraph

- Bullet list
- Another item`;

            const result = plugin.toggleDefinitionUnderlineStyle(input);
            expect(result).toBe(expected);
        });
    });
});