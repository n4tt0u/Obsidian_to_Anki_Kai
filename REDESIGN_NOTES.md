# Plugin Redesign - Version 4.0

## 🎉 Major Improvements

This redesign brings significant UX improvements, better performance, and more flexible sync options.

---

## ✨ New Features

### 1. **Improved Settings UI**

#### Tab-Based Organization
Settings are now organized into clear tabs:
- **General**: Default settings, scan directory, ignored files
- **Note Types**: Configure note type mappings with searchable table
- **Folders**: Folder-specific deck and tag settings with search
- **Syntax**: Customize syntax markers
- **Advanced**: Actions and import/export settings

#### Searchable Tables
- Both Note Types and Folders tables now have search functionality
- Quickly find specific note types or folders without scrolling

#### Folder Picker
- **Browse Button** next to Scan Directory field
- Visual folder selection instead of typing paths
- Prevents typos and makes configuration easier

#### Import/Export Settings
- **Export** your settings to JSON file for backup
- **Import** settings from JSON file to restore or share configurations

---

### 2. **Flexible Sync Commands**

Three new sync options with keyboard shortcuts:

| Command | Description | Use Case |
|---------|-------------|----------|
| **Sync Current File** | Sync only the active file | Quick updates to single file |
| **Sync Current Folder** | Sync all files in current folder | Work on specific project/topic |
| **Sync Entire Vault** | Sync all files (or scan directory) | Full sync (existing behavior) |

**How to use:**
1. Via Command Palette (Ctrl/Cmd + P):
   - "Obsidian to Anki: Sync Current File"
   - "Obsidian to Anki: Sync Current Folder"
   - "Obsidian to Anki: Sync Entire Vault"

2. Via Context Menu (Right-click):
   - Right-click on any markdown file → "Sync to Anki"
   - Right-click on any folder → "Sync Folder to Anki"

3. Via Ribbon Icon (same as before):
   - Click the Anki icon to sync entire vault

---

### 3. **Progress Tracking**

#### Visual Progress Modal
- Shows real-time progress during sync
- Displays current operation status
- Shows percentage and file counts
- Can be cancelled if needed

#### Status Bar Indicator
- New status bar item shows sync state:
  - 📝 **Anki** - Idle, ready to sync
  - 🔄 **Syncing...** - Sync in progress
  - ✅ **Synced** - Sync completed successfully (3s timeout)
  - ❌ **Error** - Sync failed

---

### 4. **Performance Improvements**

#### Better File Processing
- Shows number of changed files before processing
- Skips unchanged files (using hash comparison)
- "No changes detected" notification when nothing to sync

#### Improved Error Handling
- Clear error messages when Anki is not running
- Better feedback on connection issues
- Graceful degradation on errors

#### Batch Processing
- Files are processed in optimized batches
- Progress updates show current batch

---

## 🎨 UI/UX Improvements

### Modern Design
- Cleaner tab interface
- Better visual hierarchy
- Improved spacing and typography
- Consistent use of Obsidian's design tokens

### Better Feedback
- More informative notifications
- Success messages show number of files synced
- Clear error messages with actionable hints
- Progress modal prevents user confusion

### Accessibility
- Keyboard navigation in folder picker
- Search inputs are properly labeled
- Better contrast for status indicators

---

## 🛠️ Technical Improvements

### New Components
- `TabContainer` - Reusable tab interface
- `SearchableTable` - Tables with built-in search
- `FolderSuggester` - Fuzzy folder picker modal
- `ProgressModal` - Progress tracking UI

### Code Organization
- UI components in `src/ui/` folder
- Cleaner separation of concerns
- Better TypeScript types
- Improved error handling

### Backward Compatibility
- All existing features preserved
- Settings automatically migrate
- Old workflows still work

---

## 📝 Migration Notes

### Settings
- Settings format unchanged - no migration needed
- New import/export feature available for backup
- Old settings file backed up as `settings-old.ts.backup`

### Commands
- Old "Scan Vault" command renamed to "Sync Entire Vault"
- Ribbon icon behavior unchanged
- All existing hotkeys still work

---

## 🔮 Future Enhancements

Potential improvements for future versions:
- Auto-sync on file save (optional)
- Sync queue for multiple operations
- Detailed sync logs/history
- Conflict resolution UI
- More granular progress tracking
- Sync profiles/presets

---

## 🐛 Known Issues

None at this time. Please report issues on GitHub.

---

## 📚 How to Contribute

1. Test the new features
2. Report bugs or suggest improvements
3. Submit pull requests
4. Share your custom configurations

---

## 🙏 Credits

Original plugin by Pseudonium
Redesign improvements: Enhanced UX, new sync commands, progress tracking

---

**Enjoy the improved Obsidian to Anki experience!** 🎉
