# Obsidian_to_Anki (Fork)

This repository is a fork of [Obsidian_to_Anki](https://github.com/Pseudonium/Obsidian_to_Anki).
It includes additional features and improvements suitable for specific workflows, such as multilingual support and other personal enhancements.

## Features Added in This Fork

### Complete Plugin Redesign (Based on PR #673)

Merged [PR #673](https://github.com/ObsidianToAnki/Obsidian_to_Anki/pull/673) which includes a complete redesign of the plugin with improved UX and new sync features.

**Major improvements:**

- **Redesigned Settings UI**: Modern tab-based navigation for easier configuration.
- **Searchable Tables**: Note Types and Folders are now managed in searchable tables.
- **Settings Import/Export**: Easily backup and restore your plugin settings.
- **Folder Picker**: Simplified path selection for scan directories.
- **Multiple Tags Support**: Enhanced the tag functionality to support scanning for multiple tags.

**New Sync Commands & UX:**

- **Sync Current File/Folder**: Context menu commands to sync specific files or folders.
- **Progress Modal**: Real-time status updates during sync.
- **Status Bar**: Visual indicator of sync state.

### Configurable CurlyCloze Keyword

The keyword used to identify Cloze Note Types for CurlyCloze syntax (`{...}` -> `{{c1::...}}`) is now configurable.
Previously hardcoded to "Cloze", you can now set any keyword (e.g., "穴埋め") in the "CurlyCloze - Keyword" setting to support localized note type names.

### Smart Scan Toggle

The plugin automatically skips files that haven't changed since the last scan (using MD5 hashes) to improve performance.
You can now disable this feature in the "General" settings (toggle "Smart Scan" off) to force a full re-scan of all files.

### Extended Tag Support (Add Obsidian Tags)

The "Add Obsidian Tags" feature now supports a wider range of characters.
It correctly identifies and processes tags containing:

- **Japanese/Unicode characters** (e.g., `#重要`)
- **Nested tags** (e.g., `#parent/child`)
- **Hyphens** (e.g., `#my-tag`)

### YAML Tags

Enable the "YAML Tags" setting in the "General" tab to automatically send tags defined in the Obsidian YAML frontmatter (Properties) to Anki.
These tags are **added** to any existing inline or global tags.
Supported formats:

- List: `tags: \n  - tag1`
- Array: `tags: [tag1, tag2]`

### Add File Link Improvements

You can now control the formatting of the file link.

- **Add File Link - Insert Newline**: Toggle whether to insert a newline (`<br>`) before the link.

---
For basic usage and configurations, please refer to the [Original Wiki](https://github.com/Pseudonium/Obsidian_to_Anki/wiki).
