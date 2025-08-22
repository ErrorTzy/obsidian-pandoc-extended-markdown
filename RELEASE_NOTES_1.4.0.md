# Release Notes - Version 1.4.0

## 🎉 Major Feature: Custom Label Lists

This release introduces **Custom Label Lists**, a powerful new feature for creating structured documents with cross-referenceable labeled items. This is particularly useful for academic writing, technical documentation, and logical arguments.

### What are Custom Label Lists?

Custom label lists use the `{::LABEL}` syntax to create uniquely labeled list items that can be referenced throughout your document:

```markdown
{::P} All humans are mortal.
{::Q} Socrates is human.
{::R} Therefore, Socrates is mortal.

From {::P} and {::Q}, we conclude {::R}.
```

### Key Features

#### 1. 🏷️ Flexible Labeling System
- Use any combination of letters, numbers, underscores, and apostrophes
- Examples: `{::Theorem1}`, `{::Lemma_2'}`, `{::Step_A}`

#### 2. 🔢 Auto-numbering with Placeholders
- Use `(#placeholder)` syntax for automatic sequential numbering
- Placeholders with the same name get the same number
- Example:
  ```markdown
  {::P(#a)} First principle     → (P1) First principle
  {::P(#b)} Second principle    → (P2) Second principle
  {::Q(#a)} Related to first    → (Q1) Related to first
  ```

#### 3. 🎯 Intelligent Auto-completion
- **Enhanced Suggestions**: Type `{::` to see all available labels with preview text
- **Rendered Preview**: Placeholders shown with their assigned numbers in suggestions
- **Smart Matching**: Find labels by typing either raw form (`P(#a)`) or rendered form (`P1`)
- **Visual Hints**: Numbers have dotted underlines, placeholders shown in grey

#### 4. 📝 Three-level Display System
When working with placeholders, the plugin provides context-aware rendering:
- **Collapsed**: Shows processed form when cursor is elsewhere
- **Semi-expanded**: Shows both processed and raw forms when cursor is on the line
- **Fully expanded**: Shows editable raw form when cursor is inside the marker

#### 5. ⚡ Auto-completion Support
- Press Enter after a custom label to create a new `{::}` marker
- Cursor automatically positioned for label entry
- Smart indentation handling

## 🐛 Bug Fixes

### List Handling
- Fixed example list auto-completion no longer deleting labeled markers
- Fixed handling of `(@)` as a valid list marker
- Fixed list indentation issues in live preview
- Fixed custom label placeholder numbering when inserting items

### Code Quality
- Fixed missing ListPatterns imports that caused plugin crashes
- Removed hardcoded inline styles per coding guidelines

## 🔧 Technical Improvements

### Major Refactoring
- **Architecture**: Renamed plugin from "PandocLists" to "PandocExtendedMarkdown" throughout codebase
- **Code Organization**: Major reorganization following established coding guidelines
- **Pattern Centralization**: All regex patterns now centralized in ListPatterns class
- **Error Handling**: Added comprehensive error boundaries to all public methods
- **Type Safety**: Moved all interfaces to dedicated type files

### Performance Optimizations
- Optimized document scanning for label detection
- Improved caching for placeholder numbering
- Reduced redundant processing in suggestion system

## 📚 Documentation

- Updated ARCHITECTURE.md with new component descriptions
- Enhanced README.md with comprehensive feature documentation
- Added JSDoc comments throughout the codebase
- Improved inline documentation for complex logic

## 🎨 UI/UX Improvements

### Definition Lists
- Added toggle command for definition underline styles
- Improved definition list rendering in both preview and reading modes

### Visual Enhancements
- Custom label placeholders now display with dotted underlines
- Improved visual hierarchy in suggestion dropdowns
- Better contrast for placeholder text in grey

## 🧪 Testing

- Added comprehensive test suite for custom label functionality
- Increased test coverage for edge cases
- Added tests for placeholder numbering logic
- Validated cross-reference resolution

## 📦 Compatibility

- Minimum Obsidian version: 1.4.0
- Fully compatible with existing Pandoc workflows
- Lua filter included for Pandoc conversion: `/lua_filter/CustomLabelList.lua`

## ⚠️ Breaking Changes

None - All existing functionality remains backward compatible.

## 🔜 Coming Next

We're continuously working to improve the plugin. Future updates may include:
- Additional list formatting options
- Enhanced cross-reference capabilities
- More customization options for rendering

## 🙏 Acknowledgments

Special thanks to all contributors and users who provided feedback and bug reports. Your input helps make this plugin better for everyone!

---

**Full Changelog**: [v1.3.2...v1.4.0](https://github.com/ErrorTzy/obsidian-pandoc-extended-markdown/compare/1.3.2...1.4.0)

**Installation**: Available through Obsidian's Community Plugins browser or manually from the [releases page](https://github.com/ErrorTzy/obsidian-pandoc-extended-markdown/releases/tag/1.4.0).