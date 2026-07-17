# List Panel

The list panel is a sidebar view for structured content in the active note. Open it with the ribbon icon or the `Open list panel` command.

The equal-width toolbar buttons switch between panel modules. The panel order
can be changed in plugin settings. The active panel has a visible heading and
item count.

## Layout And Expansion

Every module uses the same structured item layout:

- Below `32rem` of actual panel content width, identity metadata appears above
  a full-width body.
- At `32rem` and wider, a bounded identity column appears beside the flexible
  body column.
- Long titles, terms, numbers, labels, and footnote indices wrap completely.
  They are never shortened character-by-character.
- Each body renders its complete Markdown, math, and known references. A
  collapsed item limits only the visible area to three rendered lines and adds
  a theme-aware bottom fade; it does not modify the source or inject an
  ellipsis.
- `Show more⌄` appears only when the rendered body overflows. Expanded bodies
  have no inner maximum height or scrollbar.
- `Expand all` and `Collapse all` appear in the panel heading when at least one
  item overflows.

Expansion is kept while the same note rerenders or while you switch panel tabs.
It resets when you open another note or edit an item's identity. This state is
session-local and is not written to plugin settings.

Toolbar tabs, identity actions, and expansion actions are buttons and support
keyboard focus. Arrow keys, Home, and End move among panel tabs. Enter or Space
activates a focused content body for source navigation.

## Custom Label Lists

Available when `Custom label lists` is enabled.

- Shows all `{::LABEL}` custom label list items.
- Displays processed labels and content.
- Click a label to copy the raw label syntax.
- Click content to jump to the item in the editor.

## Example Lists

- Shows all `(@label)` and `(@)` examples.
- Displays generated example numbers, raw labels, and content.
- Click a label to copy syntax such as `(@intro)`.
- Click content to jump to the example.

## Definition Lists

- Shows detected definition list terms and definitions.
- Supports multiple definitions per term.
- Merges continuation lines into the displayed definition content.
- Keeps multiple definitions together in one expandable bulleted body.
- Renders supported Markdown in terms and definitions.
- Click a definition to jump to the related term.

## Fenced Divs

- Shows fenced div blocks from the active document.
- Includes readable shorthand when `Readable fenced div shorthand` is enabled.
- Displays title metadata, citation label, and content.
- Click a label to copy citation syntax such as `@thm`.
- Click content to jump to the fenced div in the editor.

## Footnotes

- Shows footnote definitions from the active document.
- Displays footnote labels and rendered content.
- Click a label to jump to the matching footnote reference when one is found.
- Click content to jump to the footnote definition.

## Notes

The panel uses the same extraction and rendering utilities as the main plugin
where possible. Content clicks navigate to source. Copy/reference buttons and
expansion buttons are separate actions and do not trigger source navigation.
The panel does not change Markdown source unless you use copy/paste or editor
commands yourself.
