# List Panel

The list panel is a sidebar view for structured content in the active note. Open it with the ribbon icon or the `Open list panel` command.

The toolbar switches between panel modules. The panel order can be changed in plugin settings.

## Custom Label Lists

Available when `Custom label lists` is enabled and Strict Pandoc mode is off.

- Shows all `{::LABEL}` custom label list items.
- Displays processed labels and content.
- Click a label to copy the raw label syntax.
- Click content to jump to the item in the editor.
- Truncated content gets a hover preview with rendered math where possible.

## Example Lists

- Shows all `(@label)` and `(@)` examples.
- Displays generated example numbers, raw labels, and content.
- Click a label to copy syntax such as `(@intro)`.
- Click content to jump to the example.
- Long content is truncated with hover preview support.

## Definition Lists

- Shows detected definition list terms and definitions.
- Supports multiple definitions per term.
- Merges continuation lines into the displayed definition content.
- Renders supported Markdown in terms and definitions.
- Click a definition to jump to the related term.

## Fenced Divs

- Shows fenced div blocks from the active document.
- Includes readable shorthand when strict Pandoc mode is off.
- Displays title metadata, citation label, and content.
- Click a label to copy citation syntax such as `@thm`.
- Click content to jump to the fenced div in the editor.

## Footnotes

- Shows footnote definitions from the active document.
- Displays footnote labels and rendered content.
- Click a label to jump to the matching footnote reference when one is found.
- Click content to jump to the footnote definition.

## Notes

The panel uses the same extraction and rendering utilities as the main plugin where possible. It is intended for navigation and reuse while writing; it does not change your Markdown source unless you use copy/paste or editor commands yourself.
