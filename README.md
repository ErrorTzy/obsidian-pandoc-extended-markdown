# Pandoc Lists Plugin for Obsidian

This plugin enables Obsidian to render [Pandoc extended markdown lists](https://pandoc.org/MANUAL.html#lists), bringing powerful list formatting capabilities to your notes.

## Features

### Fancy Lists
- **Uppercase Letters**: `A.` `B.` `C.`
- **Lowercase Letters**: `a)` `b)` `c)`  
- **Roman Numerals**: `I.` `II.` `III.` or `i)` `ii)` `iii)`
- **Hash Auto-numbering**: `#.` automatically numbers items sequentially
- **Autocompletion**: Press Enter after a fancy list item to automatically continue with the next marker
- **Auto-renumbering**: When enabled, automatically renumbers all list items when inserting new items

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

#### Features
- **Autocompletion**: Press Enter after an example list item to create a new `(@)` marker with cursor positioned for label entry
- **Autocomplete for References**: When typing `(@` in your document, an autocomplete dropdown will appear showing all available example labels
- **Preview in Dropdown**: The dropdown displays the label name and a preview of the example text (truncated to 30 characters)

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
- **Autocompletion**: Press Enter after `:` or `~` markers to continue with the same marker type

#### Toggle Definition Bold Style
The plugin provides a command to toggle between explicit and implicit bold formatting for definition terms:
- **Implicit bold**: Terms appear bold through plugin styling (e.g., `Term`)
- **Explicit bold**: Terms have markdown bold syntax (e.g., `**Term**`)

This is useful for maintaining compatibility with other markdown readers that don't have this plugin installed.

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

- **Auto-renumber lists**: Toggle automatic renumbering of list items
  - When enabled, inserting a new list item automatically renumbers all subsequent items
  - Ensures proper sequential ordering of fancy lists (A, B, C... or i, ii, iii...)
  - Only affects alphabetic and roman numeral lists, not hash (#.) or example (@) lists

## Commands

The plugin adds the following commands to the command palette:

- **Check pandoc formatting**: Scans the current document and reports any formatting issues
- **Format document to pandoc standard**: Automatically formats lists to conform to Pandoc standards
- **Toggle definition list bold style**: Toggles all definition terms between explicit (`**Term**`) and implicit (styled) bold formatting
  - If any term has explicit bold, removes bold from all terms
  - If no terms have explicit bold, adds bold to all terms

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

Complete structure of files and folders in the repository:

```
pandoc-lists-plugin/
├── src/                                   # Source code directory
│   ├── main.ts                           # Plugin entry point, registers all features
│   ├── settings.ts                       # Settings interface and settings tab implementation
│   ├── pandocValidator.ts                # Validates and formats lists to Pandoc standards
│   ├── listAutocompletion.ts             # Handles Enter key for list continuation
│   ├── ExampleReferenceSuggestFixed.ts   # Autocomplete suggestion system for (@references)
│   ├── constants.ts                      # Centralized constants for magic values and CSS classes
│   ├── patterns.ts                       # Optimized regex patterns with caching
│   ├── decorations/                      # CodeMirror decorations for live preview
│   │   └── pandocListsExtension.ts      # CM6 ViewPlugin for rendering lists in live preview
│   ├── parsers/                          # List parsing logic
│   │   ├── fancyListParser.ts           # Parses fancy lists (A., B., i., ii., #.)
│   │   ├── exampleListParser.ts         # Parses example lists with (@label) syntax
│   │   ├── definitionListParser.ts      # Parses definition lists (: and ~ markers)
│   │   └── readingModeProcessor.ts      # Post-processor for reading mode rendering
│   ├── types/                            # TypeScript type definitions
│   │   └── obsidian-extended.ts         # Type definitions for Obsidian's internal APIs
│   ├── utils/                            # Utility functions
│   │   └── errorHandler.ts              # Error handling utilities with error boundaries
│   └── styles/                           # Component-specific styles
│       └── suggestions.css              # Styles for autocomplete dropdown (not used in build)
├── __mocks__/                            # Jest mock implementations
│   ├── obsidian.ts                      # Mocks Obsidian API for testing
│   └── codemirror.ts                    # Mocks CodeMirror modules for testing
├── tests/                                # Test files
│   ├── definitionListParser.spec.ts     # Tests for definition list parsing
│   ├── exampleListParser.spec.ts        # Tests for example list parsing
│   └── fancyListParser.spec.ts          # Tests for fancy list parsing
├── .github/                              # GitHub specific files
│   └── workflows/
│       └── release.yml                  # GitHub Actions workflow for automated releases
├── main.js                              # Compiled plugin code (build output)
├── manifest.json                         # Plugin metadata (id, name, version, minAppVersion)
├── versions.json                         # Version compatibility mapping for updates
├── styles.css                            # Main plugin styles for all list types
├── package.json                          # Node.js dependencies and scripts
├── tsconfig.json                         # TypeScript compiler configuration
├── jest.config.js                        # Jest testing framework configuration
├── esbuild.config.mjs                    # Build configuration for bundling the plugin
├── .gitignore                            # Specifies files to exclude from version control
├── LICENSE                               # MIT License file
└── README.md                             # This documentation file
```

#### File Descriptions

**Core Plugin Files:**
- `main.js` - The compiled JavaScript bundle that Obsidian loads. Generated from TypeScript source during build.
- `manifest.json` - Required metadata file containing plugin ID, name, version, and minimum Obsidian version.
- `styles.css` - CSS styles applied when plugin is loaded, includes all list type styling.
- `versions.json` - Maps plugin versions to minimum required Obsidian versions for update compatibility.

**Source Code (`src/`):**
- `main.ts` - Entry point that extends Obsidian's Plugin class, initializes all features.
- `settings.ts` - Defines plugin settings interface and implements the settings tab UI.
- `pandocValidator.ts` - Contains validation logic for strict Pandoc mode and formatting functions.
- `listAutocompletion.ts` - Implements Enter key handling for automatic list continuation with context-aware detection.
- `ExampleReferenceSuggestFixed.ts` - Extends EditorSuggest to provide autocomplete for example references.
- `constants.ts` - Centralized constants for list markers, CSS classes, and other magic values.
- `patterns.ts` - Performance-optimized regex patterns with caching and helper methods.

**Parser Modules (`src/parsers/`):**
- Each parser handles specific list type parsing and rendering logic.
- Parsers work with both raw text and DOM elements depending on the mode.
- Enhanced with fallback logic for private API compatibility.

**CodeMirror Extension (`src/decorations/`):**
- Implements live preview rendering using CodeMirror 6's decoration system.
- Creates widgets and line decorations for visual list formatting.
- Refactored with modular helper methods for better maintainability.
- Includes proper memory management for event listeners.

**Utility Modules (`src/utils/`):**
- `errorHandler.ts` - Comprehensive error handling with error boundaries and custom error classes.

**Testing Infrastructure:**
- `__mocks__/` - Contains mock implementations to simulate Obsidian and CodeMirror APIs during tests.
- `tests/` - Unit tests for each parser ensuring correct list parsing behavior.
- `jest.config.js` - Configures Jest to use TypeScript, jsdom environment, and module mocks.

**Build Configuration:**
- `esbuild.config.mjs` - Bundles TypeScript source into single `main.js` file, excludes Obsidian and CodeMirror modules.
- `tsconfig.json` - TypeScript compiler options for type checking and module resolution.
- `package.json` - Defines build scripts (`dev`, `build`, `test`) and development dependencies.

**GitHub Integration:**
- `.github/workflows/release.yml` - Automates release creation when tags are pushed.
- `.gitignore` - Excludes node_modules, coverage reports, OS files, and other build artifacts.

**Documentation:**
- `README.md` - User-facing documentation with features, installation, and usage instructions.
- `LICENSE` - MIT license granting permission to use, modify, and distribute the plugin.

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