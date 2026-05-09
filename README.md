# Pandoc Extended Markdown

Pandoc Extended Markdown is an Obsidian plugin that makes common Pandoc Markdown extensions readable in Live Preview and Reading mode while preserving the original Markdown source.

It focuses on syntax that is useful while writing notes: fancy lists, definition lists, example lists, fenced divs, custom label lists, superscripts, subscripts, list editing helpers, and an optional sidebar panel for navigating structured list-like content.

## Highlights

| Feature | Example | What it does |
| --- | --- | --- |
| Superscript and subscript | `2^10^`, `H~2~O` | Renders Pandoc-style inline super/subscripts. |
| Fancy lists | `A.`, `a)`, `iv.`, `#.` | Renders alphabetic, Roman numeral, and hash auto-numbered lists. |
| Definition lists | `Term` followed by `: definition` | Renders Pandoc definition lists in Live Preview and Reading mode. |
| Example lists | `(@label) Example` and `(@label)` | Numbers examples and resolves local example references. |
| Fenced divs | `::: {.theorem #thm title="Theorem &"}` | Renders Pandoc fenced divs with optional titles, numbering, and local `@id` references. |
| Custom label lists | `{::P} Premise` | Adds custom labels, references, and placeholder numbering. |
| List editing helpers | Enter, Tab, Shift+Tab | Continues lists, cycles marker styles by depth, and can renumber affected list items. |
| List panel | Command: `Open list panel` | Shows custom labels, examples, definition lists, fenced divs, and footnotes from the active note. |

Custom label lists are a core plugin extension. They are enabled by default and need the bundled Lua filter for matching Pandoc export.

## Quick Start

Paste this into a note and switch to Live Preview.

```markdown
Water is H~2~O, and 2^10^ is 1024.

A.  First point
B.  Second point

#. Auto-numbering list

Term
:   A definition list item.

(@intro) This is a numbered example.

{::P} A custom-labeled premise.
{::Q(#step)} A custom label with placeholder numbering.

See example (@intro), premise {::P}, and step {::Q(#step)}.

::: {.theorem #compact title="Theorem &"}
Every compact metric space is complete.
:::

See @compact.
```

Preview:

![Rendering preview](docs/assets/rendering-preview.png)

## Documentation

Start here if you want more than the quick start:

- [Documentation index](docs/README.md)
- [Syntax reference](docs/syntax-reference.md)
- [Customizing CSS](docs/customizing-css.md)
- [Fenced divs](docs/fenced-divs.md)
- [List panel](docs/list-panel.md)
- [Pandoc export](docs/pandoc-export.md)
- [Development](docs/development.md)
- [Architecture](ARCHITECTURE.md)

## Modes And Settings

- Live Preview is the main editing surface.
- Reading mode renders the implemented syntax after Obsidian has produced its HTML.
- Source mode preserves plain Markdown.
- Strict Pandoc mode disables custom label lists completely, disables extended fenced div syntax, and applies stricter Pandoc list spacing rules.

The plugin settings let you enable or disable individual syntax families, list marker cycling, auto-renumbering, distinct unordered-list marker rendering, and the sidebar list panel.

## Pandoc Export

For exporting from inside Obsidian, consider using [Obsidian Enhancing Export](https://github.com/mokeyish/obsidian-enhancing-export), a Pandoc-based export plugin for formats such as Markdown, HTML, docx, and LaTeX.

Obsidian rendering does not automatically change Pandoc CLI output. For plugin-specific export behavior, use the bundled Lua filters:

```bash
pandoc input.md --lua-filter=lua_filter/FencedDivExtendedSyntax.lua -o output.docx
pandoc input.md --lua-filter=lua_filter/CustomLabelList.lua -o output.docx
```

See [Pandoc export](docs/pandoc-export.md) for details.

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

See [Development](docs/development.md) and [tests/README.md](tests/README.md) for repository layout and test guidance.

## Requirements

- Obsidian 1.4.0 or newer.
- Desktop and mobile are supported.

## Support

Report bugs and feature requests in [GitHub Issues](https://github.com/ErrorTzy/obsidian-pandoc-extended-markdown/issues).

## License

MIT. See [LICENSE](LICENSE).

## Author

Created by [Scott Tang](https://github.com/ErrorTzy).
