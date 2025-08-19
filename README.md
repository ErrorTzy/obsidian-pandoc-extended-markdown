# Pandoc Lists Plugin for Obsidian

This plugin enables Obsidian to render [Pandoc extended markdown lists](https://pandoc.org/MANUAL.html#lists), bringing powerful list formatting capabilities to your notes.

## Features

### Fancy Lists
- **Uppercase Letters**: `A.` `B.` `C.`
- **Lowercase Letters**: `a)` `b)` `c)`  
- **Roman Numerals**: `I.` `II.` `III.` or `i)` `ii)` `iii)`
- **Hash Auto-numbering**: `#.` automatically numbers items sequentially

### Strict Pandoc Mode
- **Toggle Setting**: Enable strict Pandoc formatting requirements
- **Validation**: Only renders lists that conform to Pandoc standards
- **Check Command**: Scan document for formatting issues
- **Format Command**: Auto-format document to meet Pandoc standards

### Example Lists with Cross-References
Create numbered examples that can be referenced throughout your document:
```markdown
(@good) This is a good example.
(@bad) This is a bad example.

Later in the document, refer to (@good) and (@bad).
```
The references will automatically display the correct example numbers.

#### Autocomplete for Example References
When typing `(@` in your document, an autocomplete dropdown will appear showing all available example labels. Select a label to automatically complete the reference. The dropdown displays:
- The label name
- A preview of the example text (truncated to 30 characters)

This feature makes it easy to reference examples without remembering their exact labels.

### Definition Lists
Create structured term-definition pairs with enhanced support:
```markdown
Term 1
:   Definition of term 1
    
    Indented paragraphs are part of the definition
    and won't be styled as code blocks

Term 2

~   Alternative definition syntax
~   Can have multiple definitions

Direct Term
: Definition can directly follow term (no empty line needed)
```
- Terms are rendered in bold with underline
- Definitions appear as bullet points
- Indented paragraphs maintain proper text styling

## Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Settings → Community plugins
2. Search for "Pandoc Lists"
3. Click Install and Enable

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/ErrorTzy/obsidian-pandoc-lists/releases)
2. Create a folder named `pandoc-lists` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the `pandoc-lists` folder
4. Reload Obsidian
5. Enable the plugin in Settings → Community plugins

## Usage Examples

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

## Commands

The plugin adds two commands to the command palette:

- **Check pandoc formatting**: Scans the current document and reports any formatting issues
- **Format document to pandoc standard**: Automatically formats lists to conform to Pandoc standards

## Compatibility

- Requires Obsidian v1.4.0 or higher
- Works on desktop and mobile versions
- Compatible with other Obsidian plugins

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/ErrorTzy/obsidian-pandoc-lists

# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Development mode with hot reload
npm run dev
```

### Project Structure
```
pandoc-lists-plugin/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── decorations/            # CodeMirror extensions
│   └── parsers/                # List parsing logic
├── tests/                      # Unit tests
├── manifest.json              # Plugin metadata
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Support

If you encounter any issues or have feature requests, please file them on the [GitHub Issues](https://github.com/ErrorTzy/obsidian-pandoc-lists/issues) page.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- This plugin is completely built by Claude Code.

## Author

Created by [Scott Tang](https://github.com/ErrorTzy)