# Pandoc Extended Markdown Plugin for Obsidian

This plugin enables Obsidian to render [Pandoc extended markdown syntax](https://pandoc.org/MANUAL.html#pandocs-markdown), bringing powerful formatting capabilities including advanced lists, superscripts, subscripts, and more to your notes.

## Current Features

Pandoc extended Markdown is a large superset of Obsidian Markdown, so this plugin focuses on the syntax that is most useful in daily notes: lists, fenced divs, superscripts, and subscripts. I do not plan to implement Pandoc's extended table syntax because Markdown tables are difficult to edit comfortably in plain text.

Live Preview is the primary editing surface. Reading mode is supported for the implemented syntax, but its implementation is more constrained by Obsidian's rendered HTML.

### Superscripts and Subscripts
Render Pandoc-style superscripts and subscripts:
- **Superscript**: `^text^` renders as superscript (e.g., `2^10^` → 2¹⁰)
- **Subscript**: `~text~` renders as subscript (e.g., `H~2~O` → H₂O)
- **Escaped Spaces**: Use `\` to include spaces (e.g., `P~a\ cat~` → P_a cat_)
- Works in all contexts: paragraphs, lists, definition lists, etc.

### Fancy Lists
- **Uppercase Letters**: `A.` `B.` `C.` (In strict mode, there must be two spaces after `A.`)
- **Lowercase Letters**: `a)` `b)` `c)`  
- **Roman Numerals**: `I.` `II.` `III.` or `i)` `ii)` `iii)`
- **Hash Auto-numbering**: `#.` automatically numbers items sequentially
- **Autocompletion**: Press Enter after a fancy list item to automatically continue with the next marker
- **Auto-renumbering**: When enabled, automatically renumbers all list items when inserting new items
- **Depth-based ordered marker cycling**: Indenting with Tab cycles ordered markers by nesting depth. Supported non-auto markers are decimal, lowercase letters, uppercase letters, lowercase roman numerals, and uppercase roman numerals with either `.` or `)`.

### Unordered Lists
- **Depth-based marker cycling**: Indenting with Tab cycles unordered markers by nesting depth using the configured marker order. The default order is `-`, `+`, `*`, then repeats. Outdenting restores the marker for the shallower level.
- **Source-aware marker rendering**: `-` keeps Obsidian's default filled circle, `+` renders as a square, and `*` renders as a hollow circle in Live Preview and Reading mode.
- Both unordered list behaviors have independent settings toggles.

### Example Lists with Cross-References
Create numbered examples that can be referenced throughout your document:
```markdown
(@good) This is a good example.
(@bad) This is a bad example.

Later in the document, refer to (@good) and (@bad).
```
The references will automatically render the correct example numbers:

```markdown
(1) This is a good example.
(2) This is a bad example.

Later in the document, refer to (1) and (2).
```

### Definition Lists
Create structured term-definition pairs with enhanced support:
```markdown
Term 1
:   Definition of term 1
    
    Indented paragraphs are part of the definition

Term 2

~   Alternative definition syntax
~   Can have multiple definitions

Direct Term
: Definition can directly follow term (no empty line needed)

Term 3

  ~ You can also have spaces before the marker

```

- Definitions appear as bullet points
- **Autocompletion**: Press Enter after `:` or `~` markers to continue with the same marker type
- **Enhanced Formatting**: Supports superscripts, subscripts, bold (`**text**`), and italic (`*text*`) within definition content

### Fenced Divs

*Warning: Most of the features described here are plugin-specific. To use pandoc for similar output, apply lua filter in lua_filter/FencedDivExtendedSyntax.lua for pandoc export. If you only want native pandoc fenced_divs, turn on strict pandoc mode*

Live Preview and Reading mode render Pandoc fenced div blocks and generic `@id` cross-references:
```markdown
::: {.theorem #thm title="Theorem &"}
Every compact metric space is complete.
:::

See @thm.
```

Labeled fenced divs render a theorem-style title line, and known `@id` citations render the same text. Numbering is opt-in: put `&` in the title template where the generated counter should appear. Titles without `&` render exactly as written. If there is no title, the first class is used as an unnumbered label; id-only blocks reference as `Div` without inventing a number.

```markdown
::: {.proposition #prop:a title="Proposition &"}
A proposition.
:::

::: {.logic-block #prem:a title="Premise &"}
A premise.
:::

See @prop:a and @prem:a.
```

The block titles and references render as `Proposition 1` and `Premise 1`; unknown citations remain unchanged.

You can place the counter at the front or use multiple placeholders for manual depth:

```markdown
::: {.case #c1 title="Case &"}
Top-level case.
:::

::: {.case #c1a title="Case &.&"}
Nested case.
:::

::: {.note #n1 title="& Note"}
Front-numbered note.
:::
```

These render as `Case 1`, `Case 1.1`, and `1 Note`. Deeper counters reset when a shallower placeholder pattern advances in the same title family.

Escape literal ampersands inside numbered titles with `\&`, as in `title="AT\&T-&.&"` for `AT&T-1.1`. Pandoc export of native braced attributes may require the backslash itself to be escaped in Markdown (`title="AT\\&T-&.&"`).

Use `.no-num` when a title contains a literal ampersand or when placeholder text should be shown literally:

```markdown
::: {.warning #warn .no-num title="AT&T Warning"}
Literal ampersand, no numbering.
:::

#### Readable shorthand

In readable shorthand, bare class tokens can synthesize the same title template. Prefer separated placeholder tokens so CSS can still target the semantic class:

```markdown
::: Case & #c1
Top-level case.
:::

::: Case &.& #c1a key=value
Nested case.
:::

::: & Note #n1
Front-numbered note.
:::
```

These are treated like title templates `Case &`, `Case &.&`, and `& Note`, while preserving classes such as `Case` and `Note`. `::: Case_&.&` also renders as `Case 1.1`, but its class is `Case_&.&`, so `Case &.&` is recommended.

The shorthand above is inconvenient when there are space in the title. Therefore, an alternative shorthand is

```markdown
::: title with space {.case #a1}
title with space
:::

::: {.case #b1} title with space until linebreak
title with space
:::
```

### List Panel View

A modular sidebar panel displays various list-related content from the active document. The panel features an icon toolbar for switching between different list types.

#### Available Panels

**Custom Label Lists Panel** `{::}`
- Displays all custom label lists from the current document
- Two-column layout: processed labels and their content
- Click labels to copy raw syntax to clipboard
- Click content to navigate to the label in the editor
- Hover previews for truncated content with rendered math

**Example Lists Panel** `(@)`
- Displays all example lists from the current document
- Three-column layout: rendered numbers, raw labels, and content
- Rendered numbers show sequential numbering (truncated at 3rd digit)
- Click labels to copy raw syntax (e.g., `(@a)`) to clipboard
- Click content to navigate to the example in the editor
- Hover previews for truncated items with full content
- Math rendering support in content column

**Definition Lists Panel** `DL:`
- Displays all definition lists from the current document
- Two-column layout: terms and their definitions
- Terms support full markdown rendering (bold, italic, math, references)
- Multiple definitions per term shown as bullet list
- Continuation lines automatically merged with definitions
- Click definitions to navigate to the term in the editor
- Smart truncation: terms (100 chars), definitions (300 chars)
- Hover previews for truncated content with full rendering

**Fenced Divs Panel** `:::`
- Displays all fenced div blocks from the current document, including readable shorthand when strict Pandoc mode is off
- Three-column layout: title metadata, citation label, and content
- `title="..."` or readable shorthand class tokens provide metadata for cross-reference labels and the generated theorem-style block title; include `&` to opt into generated numbering
- Click labels to copy citation syntax (e.g., `@thm`) to clipboard
- Click content to navigate to the fenced div content in the editor

**Footnotes Panel** `[^]`
- Lists every footnote definition detected in the document
- Two-column layout: footnote label and fully rendered content (markdown, math, references)
- Clicking a label focuses the editor and positions the cursor immediately after the corresponding `[^label]` reference
- Clicking content jumps to the footnote definition block and highlights the line
- Uses the shared rendering pipeline for consistent formatting across panels

### Auto-Renumbering Lists

The plugin can automatically renumber list items when you insert new items in the middle of a list:

**Without auto-renumbering:**
```markdown
A. First item
[Press Enter here]
B. Second item
```
Result:
```markdown
A. First item
B. [new item]
B. Second item  # Duplicate marker
```

**With auto-renumbering enabled:**
```markdown
A. First item
[Press Enter here]
B. Second item
```
Result:
```markdown
A. First item
B. [new item]
C. Second item  # Automatically renumbered
```

This feature:
- Works with alphabetic lists (A, B, C or a, b, c)
- Works with roman numerals (i, ii, iii or I, II, III)
- Maintains proper sequence even with incorrectly ordered lists
- Respects indentation levels (only renumbers items at the same level)
- Preserves nested list numbering independently

### Strict Pandoc Mode

- **Format Command**: Auto-format document to meet Pandoc standards
- **Toggle Setting**: Enable strict Pandoc formatting requirements
- **Validation**: Only renders lists that conform to Pandoc standards
- **Check Command**: Scan document for formatting issues

### Beyond Pandoc Extended Syntax!!!

#### Custom Label Lists

*Warning: This is a plugin-specific Markdown flavor. In Obsidian, it works out of the box with this plugin. For Pandoc conversion, pass `lua_filter/CustomLabelList.lua` to Pandoc as a Lua filter.*

When "More extended syntax" is enabled in settings, you can use custom label lists with the `{::LABEL}` syntax:

```markdown
{::P} All humans are mortal.
{::Q} Socrates is human.
{::R} Therefore, Socrates is mortal.
```

This renders as:

```
(P) All humans are mortal.
(Q) Socrates is human.
(R) Therefore, Socrates is mortal.
```

##### Auto-numbering with Placeholders

Custom labels support auto-numbering through placeholder syntax `(#name)`. Each unique placeholder gets a sequential number:

```markdown
{::P(#first)} First premise
{::P(#second)} Second premise  
{::P(#first)'} Variation of first premise

From {::P(#first)} and {::P(#second)}, we derive...
```

This renders as:
- (P1) First premise
- (P2) Second premise
- (P1') Variation of first premise
- From (P1) and (P2), we derive...

You can also use pure placeholder expressions:

```markdown
{::(#premise)} A premise
{::(#conclusion)} A conclusion
{::(#premise)+(#conclusion)} Combined expression
```

Which renders as:
- (1) A premise  
- (2) A conclusion
- (1+2) Combined expression

## Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Settings → Community plugins
2. Search for "Pandoc Extended Markdown"
3. Click Install and Enable

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/ErrorTzy/obsidian-pandoc-extended-markdown/releases)
2. Create a folder named `pandoc-extended-markdown` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the `pandoc-extended-markdown` folder
4. Reload Obsidian
5. Enable the plugin in Settings → Community plugins

## Usage Examples

### Superscripts and Subscripts
```markdown
Water formula: H~2~O is essential for life.
Einstein's equation: E = mc^2^ revolutionized physics.
Chemical notation: Ca^2+^ + SO~4~^2-^ → CaSO~4~
With spaces: P~a\ cat~ subscript example
```

### Fancy Lists
```markdown
A. First major point
B. Second major point
C. Third major point

i. First sub-item
ii. Second sub-item
iii. Third sub-item

#. Auto-numbered item one
#. Auto-numbered item two
#. Auto-numbered item three
```

### Example Lists
```markdown
(@intro) This introduces the concept.
(@) This example doesn't need a label.
(@conclusion) This concludes our examples.

As shown in example (@intro), the concept is straightforward.
Example (@conclusion) wraps everything up.
```

### Definition Lists
```markdown
Markdown
:   A lightweight markup language

Obsidian
:   A powerful knowledge base application
:   Uses local Markdown files

Plugin
~   Extends Obsidian functionality
~   Can be installed from Community Plugins
```

## How It Works

- **Live Preview Mode**: Lists are rendered with proper formatting. When the cursor is within a list marker, it shows the raw markdown for editing
- **Reading Mode**: Lists are fully rendered with enhanced styling
- **Source Mode**: Original markdown syntax is always preserved without any rendering
- **Strict Mode**: When enabled, only lists conforming to Pandoc standards are rendered

## Settings

The plugin provides a settings tab where you can configure:

- **Strict Pandoc Mode**: Toggle to enforce Pandoc formatting standards
  - When enabled, lists must have proper empty lines before/after blocks
  - Capital letters with periods require double spacing
  - Invalid lists are displayed as plain text

- **Syntax features**: Toggle individual Pandoc syntaxes on or off
  - Hash auto-number lists (`#.`)
  - Fancy lists (`A.`, `i.`, etc.)
  - Example lists and example references (`(@label)`)
  - Definition lists
  - Fenced divs (`::: {.theorem #thm title="Theorem &"}`) and fenced-div cross-references (`@thm`)
  - Distinct unordered list marker rendering for `-`, `+`, and `*`
  - Superscript and subscript
  - Custom label lists (`{::LABEL}`) and custom label references
  - Custom label lists should be used together with `lua_filter/CustomLabelList.lua` for Pandoc output
  - When strict mode is enabled, custom label blocks still require blank lines before/after

- **List auto-completion**: Configure automatic list editing behavior
  - Auto-renumber lists when inserting new list items
  - Depth-based unordered list marker cycling
  - Depth-based ordered list marker cycling for `1.`, `1)`, `a.`, `a)`, `A.`, `A)`, `i.`, `i)`, `I.`, and `I)`
  - Unordered list marker order for cycling between `-`, `+`, and `*`
  - Ordered list marker order for cycling between non-auto ordered markers

- **Panel features**: Configure the list panel view in the sidebar
  - Toggle whether the list panel view and its ribbon icon are available
  - Edit the order of enabled panel tabs

Hash auto-number lists (`#.`) are not included in ordered marker cycling because they are already auto-numbered.

## Commands

The plugin adds the following commands to the command palette:

- **Check pandoc formatting**: Scans the current document and reports any formatting issues
- **Format document to pandoc standard**: Automatically formats lists to conform to Pandoc standards
- **Toggle definition list bold style**: Toggles all definition terms between explicit (`**Term**`) and implicit (styled) bold formatting
  - If any term has explicit bold, removes bold from all terms
  - If no terms have explicit bold, adds bold to all terms
- **Toggle definition list underline style**: Toggles all definition terms between explicit (`<span class="underline">Term</span>`) and implicit (styled) underline formatting
  - If any term has explicit underline, removes underline from all terms
  - If no terms have explicit underline, adds underline to all terms

## Compatibility

- Requires Obsidian v1.4.0 or higher
- Works on desktop and mobile versions
- Compatible with other Obsidian plugins

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/ErrorTzy/obsidian-pandoc-extended-markdown

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Development mode with hot reload
npm run dev
```

### Architecture Overview

For detailed information about the plugin's architecture, implementation details, and development workflow, please see [ARCHITECTURE.md](ARCHITECTURE.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Support

If you encounter any issues or have feature requests, please file them on the [GitHub Issues](https://github.com/ErrorTzy/obsidian-pandoc-extended-markdown/issues) page.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- This plugin is built with Claude Code.

## Author

Created by [Scott Tang](https://github.com/ErrorTzy)
