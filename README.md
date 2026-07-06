# Obsidian_to_Anki_Kai

This repository is a fork of [Obsidian_to_Anki](https://github.com/Pseudonium/Obsidian_to_Anki). I added features that I personally wanted.

Bug reports and feature requests are welcome! Please submit them via GitHub Issues for consideration.

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
- **Extra Newline in Regex Notes**: Fixed an issue where using Custom Regex to generate cards would insert an unnecessary empty line after the ID comment. Now, the ID is inserted cleanly without disrupting the file format.
- **Improved Newline Handling**: Standardized the logic for inserting newlines when adding file links, aliases, and context. It now correctly detects if a field already has content and inserts a `<br>` tag only when necessary, preventing formatting issues where text would be concatenated without separation.
- **Field Selection Stability**: Fixed an issue where the "Regenerate Note Type Table" action would clear selected fields if the field names were no longer found. The plugin now automatically validates selected fields after regeneration and reverts invalid selections to the default (first) field of the Note Type.
- **Broken Images in Anki (Issue #8)**: Fixed images not displaying in Anki. Two causes: (1) percent-encoded markdown embeds (`![](Pasted%20image%201.png)`) are now decoded so the stored filename matches the `<img src>` reference; (2) recent Anki normalises media filenames to lowercase, so both the stored name and the `<img src>` reference are now lowercased to agree on case-sensitive filesystems.
- **Silent Card Loss from `$` Signs**: Fixed a data-loss bug where stray `$` signs (e.g. currency amounts `$200k` and `$8,000` in different cards) were paired by the inline-math regex across newlines, causing every RegexNote between them to be silently dropped from sync. The math/code regexes now follow Obsidian's actual rendering rules (inline math/code stay single-line; currency-style `$5` is treated as text).
- **Image `alt` attribute hardened**: The `alt` text of generated `<img>` tags is now HTML-escaped, so an `alt` containing `"` no longer breaks the tag.

> Credit: the three fixes above were discovered and originally patched in the [`999cleo/Obsidian_to_Anki_Cleo`](https://github.com/999cleo/Obsidian_to_Anki_Cleo) fork.

### Complete Plugin Redesign (Based on PR #673)

Merged [PR #673](https://github.com/ObsidianToAnki/Obsidian_to_Anki/pull/673) which includes a complete redesign of the plugin with improved UX and new sync features.

Major improvements:

- Redesigned settings UI with tab-based navigation
- Added searchable tables for Note Types and Folders
- Implemented folder picker for easier path selection
- Added import/export settings functionality

New sync commands:

- Sync Current File: Quick sync for active file
- Sync Current Folder: Sync all files in current folder
- Sync Entire Vault: Full vault sync (existing behavior)
- Context menu integration for files and folders

Enhanced user experience:

- Progress modal with real-time status updates
- Status bar indicator showing sync state
- Better error messages and notifications
- Improved performance with smart file change detection

Technical improvements:

- New UI components: TabContainer, SearchableTable, FolderSuggester, ProgressModal
- Better code organization with src/ui/ folder
- Enhanced error handling and user feedback
- All existing features preserved for backward compatibility

### Enhanced Field Control

You can now configure "Add File Link", "Add Context", and "Add Aliases" per **Note Type**.

- **Enable**: Toggle "**Add File Link**", "**Add Context**", or "**Add Aliases**" in the "**Default Settings**" tab.
- **Configuration**:
  - When enabled, new columns will appear in the "**Note Types**" tab (e.g., "File Link Field").
  - For each Note Type, you can select the target field or choose **"None"** to disable the feature for that specific Note Type.
- **Disable**: Turning the global toggle OFF will hide the column and disable the feature across all Note Types.

### Add File Link Customization

You can customize the text used for the "Add File Link" feature.

- **Link Label**: In the "General" settings (under "Add File Link"), you can specify the text for the link.
- **Dynamic Filename**: Use `{{title}}` in the text to automatically insert the note's filename (without extension).
  - Example: `Source: {{title}}` -> `Source: MyNote`
- **Default**: If left empty, it defaults to "Obsidian".

### Configurable CurlyCloze Keyword

The keyword used to identify Cloze Note Types for CurlyCloze syntax (`{...}` -> `{{c1::...}}`) is now configurable.
Previously hardcoded to "Cloze", you can now set any keyword (e.g., "穴埋め") in the "CurlyCloze - Keyword" setting to support localized note type names.

### Smart Scan Toggle

The plugin automatically skips files that haven't changed since the last scan (using MD5 hashes) to improve performance.
You can now disable this feature in the "General" settings (toggle "Smart Scan" off) to force a full re-scan of all files.

### Extended Tag Support (Add Inline Tags)

The "Add Inline Tags" feature now supports a wider range of characters.
It correctly identifies and processes tags containing:

- **Japanese/Unicode characters** (e.g., `#重要`)
- **Nested tags** (e.g., `#parent/child`)
- **Hyphens** (e.g., `#my-tag`)

### Add Frontmatter Tags

Enable the "Add Frontmatter Tags" setting in the "General" tab to automatically send tags defined in the Obsidian YAML frontmatter (Properties) to Anki.
These tags are **added** to any existing inline or global tags.
Supported formats:

- List: `tags: \n  - tag1`
- Array: `tags: [tag1, tag2]`

### Convert to Anki Hierarchy

Enable the "Convert to Anki Hierarchy" setting to automatically convert slash-separated Obsidian tags (e.g., `#foo/bar`) to Anki's hierarchical tag format (`foo::bar`).

- **Applies to**: Both inline tags (`#foo/bar`) and YAML frontmatter tags
- **Example**: `#japanese/grammar` → `japanese::grammar` in Anki
- **Benefit**: Preserves your tag hierarchy when syncing to Anki

### Add Aliases

Enable the "Add Aliases" setting in the "General" tab to automatically append aliases from the frontmatter to a specified field.

- **Config**: In "Note Types" settings, select the target field for aliases in the "Aliases Field" column.
- **Format**: Multiple aliases are separated by a newline (`<br>`) to display as a list in Anki.

### Scan Tags

You can filter which files to scan based on their tags (both inline `#tags` and Frontmatter tags).
In the "General" settings -> "Scan Tags", enter tags separated by commas (e.g., `anki, flashcards`).
If set, only files containing at least one of the specified tags will be processed. Leave empty to scan all files in the "Scan Directory".

> [!NOTE]
> This setting only applies to the **Vault Scan** or **Auto Scan**.
> If you right-click a file and select "Sync to Anki", it will be **forcefully synced** regardless of whether it matches the "Scan Tags".

### Regex Required Tags (Advanced)

Allows you to specify that a Custom Regex should only be applied if the file contains specific tags.
This is useful when you want to apply different Note Types (e.g., "Basic" vs "Basic (Reverse)") to the same text pattern based on a tag (e.g., `#reverse`).

- **Enable**: Go to Settings -> Advanced and toggle "**Regex Required Tags**".
- **Usage**:
    1. In the "Note Types" settings, a new **Required Tags** column will appear.
    2. Enter tags separated by commas (e.g., `tagA, tagB`).
    3. The regex for that row will **only** be applied if the file contains at least one of these tags (OR condition).
- **Prioritization**:
  - Rules **with** Required Tags are automatically prioritized (processed first).
  - If a file matches the tag, the strict rule applies.
  - If not, the plugin falls back to the generic rule (empty tags).

### Save Note ID to Frontmatter (Experimental)

Allows saving the Anki Note ID (`nid`) in the Obsidian Frontmatter (YAML Properties) instead of as an inline comment or block ID.

- **Enable**: Go to Settings -> Advanced and toggle "**Save Note ID to Frontmatter**" in the "Experimental Features" section.

### Bulk Delete IDs (Experimental)

A feature to bulk delete Anki cards associated with a specific file.

- **Enable**: Go to Settings -> Advanced and toggle "Bulk Delete IDs" in the "Experimental Features" section.
- **Usage**: Right-click on a Markdown file in the file explorer and select "**Delete all IDs in file**".
- **Effect**: This will:
    1. Delete the corresponding cards/notes from Anki.
    2. Remove the ID lines (`ID: ...` or `<!--ID: ...-->`) from the Obsidian file.
    3. **Note**: The content of the notes in Obsidian will be preserved.
- **Warning**: This action is destructive to Anki data. A confirmation dialog will be shown before execution.

### Reading View Cloze Renderer

Enhances the display of Anki clozes (`{{c1::answer::hint}}`) in Obsidian's Reading View.

- **Enable**: Go to Settings -> Advanced -> Experimental Features and toggle "**Render Clozes in Reading View**".
- **Functionality**:
  - **Render**: Displays `{{c1::answer::hint}}` as `answer`.
  - **Highlight**: If enabled, the answer text is highlighted using Obsidian's default highlight style (`<mark>`). This setting appears as "**Highlight Rendered Clozes**" when the main toggle is ON.

### Cloze Deletion Context Menu & Hotkeys (Experimental)

Adds context menu items and commands to easily create or remove Anki clozes from selected text in the editor.

- **Enable Context Menu**: Go to Settings -> Advanced -> Experimental Features and toggle "**Cloze Deletion Context Menu**".
- **Commands**:
  - `Add Anki Cloze`: Converts selected text to `{{c<N>::text}}`.
  - `Remove Anki Cloze`: Removes the cloze syntax, leaving only the text.
  - *Note: Commands are available globally and can be assigned to hotkeys in Obsidian settings, regardless of the context menu toggle.*
- **Usage**:
  1. Select text in the editor.
  2. Right-click and choose "**Anki Cloze**", or use your assigned hotkey.
  3. The text is converted to `{{c<N>::text}}`.
  4. The cloze number `<N>` is automatically calculated to fill gaps or increment from the highest existing number.

### AnkiConnect API Key Support

You can now configure an API key to securely connect to AnkiConnect.
This is useful if you have enabled authentication in your AnkiConnect add-on settings to prevent unauthorized access.

- **Enable**: Go to Settings -> Advanced -> Experimental Features and enter your key in "**AnkiConnect API Key**".
- **Usage**:
  - The API key will be automatically included in all requests to Anki.
  - If you haven't configured an API key in AnkiConnect, simply leave this field blank.

---
For basic usage and configurations, please refer to the [Original Wiki](https://github.com/Pseudonium/Obsidian_to_Anki/wiki).
