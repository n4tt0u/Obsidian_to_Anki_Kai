# Obsidian_to_Anki_Kai

This repository is a fork of [Obsidian_to_Anki](https://github.com/Pseudonium/Obsidian_to_Anki).
It includes additional features and improvements suitable for specific workflows, such as multilingual support and other personal enhancements.

## Installation

Since this is a custom fork, it is not available in the official Obsidian directory. Please use one of the following methods to install.

### Method 1: BRAT (Recommended)

The easiest way to install and keep the plugin updated.

1. Install the **BRAT** plugin from the Obsidian Community Plugins.
2. Open BRAT settings and click **"Add Beta plugin"**.
3. Enter the repository URL: `https://github.com/n4tt0u/Obsidian_to_Anki_Kai`
4. Click **"Add Plugin"**.
5. Enable **Obsidian_to_Anki_Kai** in Settings -> Community Plugins.

### Method 2: Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [Releases Page](https://github.com/n4tt0u/Obsidian_to_Anki_Kai/releases/latest).
2. Open your vault's plugin folder: `<Vault>/.obsidian/plugins/`.
3. Create a new folder named `obsidian-to-anki-kai`.
4. Place the 3 downloaded files into this folder.
5. Reload Obsidian and enable the plugin.

## Features Added in This Fork

### Bug Fixes

- **Note Type Field Update**: Fixed an issue where new fields added to Anki Note Types were not reflected in the plugin settings unless the number of Note Types changed. The "Regenerate Note Type Table" button now correctly forces a full update of field definitions.

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

### Add Obsidian YAML Tags

Enable the "Add Obsidian YAML Tags" setting in the "General" tab to automatically send tags defined in the Obsidian YAML frontmatter (Properties) to Anki.
These tags are **added** to any existing inline or global tags.
Supported formats:

- List: `tags: \n  - tag1`
- Array: `tags: [tag1, tag2]`

### Scan Tags

You can filter which files to scan based on their tags (both inline `#tags` and Frontmatter tags).
In the "General" settings -> "Scan Tags", enter tags separated by commas (e.g., `anki, flashcards`).
If set, only files containing at least one of the specified tags will be processed. Leave empty to scan all files in the "Scan Directory".

> [!NOTE]
> This setting only applies to the **Vault Scan** or **Auto Scan**.
> If you right-click a file and select "Sync to Anki", it will be **forcefully synced** regardless of whether it matches the "Scan Tags".

### Add File Link Improvements

You can now control the formatting of the file link.

- **Add File Link - Insert Newline**: Toggle whether to insert a newline (`<br>`) before the link.

### Bulk Delete IDs (Experimental)

A feature to bulk delete Anki cards associated with a specific file.

- **Enable**: Go to Settings -> Advanced and toggle "Bulk Delete IDs" in the "Experimental Features" section.
- **Usage**: Right-click on a Markdown file in the file explorer and select "**Delete all IDs in file**".
- **Effect**: This will:
    1. Delete the corresponding cards/notes from Anki.
    2. Remove the ID lines (`ID: ...` or `<!--ID: ...-->`) from the Obsidian file.
    3. **Note**: The content of the notes in Obsidian will be preserved.
- **Warning**: This action is destructive to Anki data. A confirmation dialog will be shown before execution.

---
For basic usage and configurations, please refer to the [Original Wiki](https://github.com/Pseudonium/Obsidian_to_Anki/wiki).
