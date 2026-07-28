import { Notice, Plugin, addIcon, TFile, TFolder, Menu, TAbstractFile, Editor, MarkdownView } from 'obsidian'
import * as AnkiConnect from './src/anki'
import { PluginSettings, ParsedSettings } from './src/interfaces/settings-interface'
import { DEFAULT_IGNORED_FILE_GLOBS, SettingsTab } from './src/settings'
import { ANKI_ICON } from './src/constants'
import { settingToData } from './src/setting-to-data'
import { FileManager } from './src/files-manager'
import { ProgressModal } from './src/ui/ProgressModal'
import { checkAndBulkDelete } from './src/bulk-delete'
import { clozeRenderer } from './src/renderer'

export default class MyPlugin extends Plugin {

	settings: PluginSettings
	note_types: Array<string>
	fields_dict: Record<string, string[]>
	added_media: string[]
	file_hashes: Record<string, string>
	statusBarItem: HTMLElement
	isSyncing: boolean = false

	async getDefaultSettings(): Promise<PluginSettings> {
		let settings: PluginSettings = {
			CUSTOM_REGEXPS: {},
			REGEXP_TAGS: {},
			FILE_LINK_FIELDS: {},
			CONTEXT_FIELDS: {},
			ALIAS_FIELDS: {},
			FOLDER_DECKS: {},
			FOLDER_TAGS: {},
			Syntax: {
				"Begin Note": "START",
				"End Note": "END",
				"Begin Inline Note": "STARTI",
				"End Inline Note": "ENDI",
				"Target Deck Line": "TARGET DECK",
				"File Tags Line": "FILE TAGS",
				"Delete Note Line": "DELETE",
				"Frozen Fields Line": "FROZEN"
			},
			Defaults: {
				"Scan Directory": "",
				"Scan Tags": "",
				"Default Tags": "Obsidian_to_Anki",
				"Deck": "Default",
				"Scheduling Interval": 0,
				"Add File Link": false,
				"Add Context": false,
				"Add Aliases": false,
				"CurlyCloze": false,
				"CurlyCloze - Highlights to Clozes": false,
				"ID Comments": true,
				"Add Inline Tags": false,
				"Convert to Anki Hierarchy": true,
				"CurlyCloze - Keyword": "Cloze",
				"Smart Scan": true,
				"Add Frontmatter Tags": false,
				"Bulk Delete IDs": false,
				"Regex Required Tags": false,
				"Add File Link - Link Label": "Obsidian",
				"Save Note ID to Frontmatter": false,
				"Render Clozes in Reading View": false,
				"Render Clozes - Highlight": false,
				"Cloze Deletion Context Menu": false,
				"Show Status Bar": true,
				"AnkiConnect API Key": "",
				"Sync AnkiWeb After Export": false
			},
			IGNORED_FILE_GLOBS: DEFAULT_IGNORED_FILE_GLOBS,
		}
		/*Making settings from scratch, so need note types*/
		this.note_types = (await AnkiConnect.invoke('modelNames') as Array<string>).sort()
		this.fields_dict = await this.generateFieldsDict()
		for (let note_type of this.note_types) {
			settings["CUSTOM_REGEXPS"][note_type] = ""
			const field_names: string[] = await AnkiConnect.invoke(
				'modelFieldNames', { modelName: note_type }
			) as string[]
			this.fields_dict[note_type] = field_names
			settings["FILE_LINK_FIELDS"][note_type] = field_names[0]
		}
		return settings
	}

	async generateFieldsDict(): Promise<Record<string, string[]>> {
		let fields_dict = {}
		for (let note_type of this.note_types) {
			const field_names: string[] = await AnkiConnect.invoke(
				'modelFieldNames', { modelName: note_type }
			) as string[]
			fields_dict[note_type] = field_names
		}
		return fields_dict
	}

	async saveDefault(): Promise<void> {
		const default_sets = await this.getDefaultSettings()
		this.saveData(
			{
				settings: default_sets,
				"Added Media": [],
				"File Hashes": {},
				fields_dict: {}
			}
		)
	}

	async loadSettings(): Promise<PluginSettings> {
		let current_data = await this.loadData()
		if (current_data == null || Object.keys(current_data).length != 4) {
			new Notice("Need to connect to Anki generate default settings...")
			const default_sets = await this.getDefaultSettings()
			this.saveData(
				{
					settings: default_sets,
					"Added Media": [],
					"File Hashes": {},
					fields_dict: {}
				}
			)
			new Notice("Default settings successfully generated!")
			return default_sets
		} else {
			return current_data.settings
		}
	}

	async loadAddedMedia(): Promise<string[]> {
		let current_data = await this.loadData()
		if (current_data == null) {
			await this.saveDefault()
			return []
		} else {
			return current_data["Added Media"]
		}
	}

	async loadFileHashes(): Promise<Record<string, string>> {
		let current_data = await this.loadData()
		if (current_data == null) {
			await this.saveDefault()
			return {}
		} else {
			return current_data["File Hashes"]
		}
	}

	async loadFieldsDict(): Promise<Record<string, string[]>> {
		let current_data = await this.loadData()
		if (current_data == null) {
			await this.saveDefault()
			const fields_dict = await this.generateFieldsDict()
			return fields_dict
		}
		return current_data.fields_dict
	}

	async saveAllData(): Promise<void> {
		this.saveData(
			{
				settings: this.settings,
				"Added Media": this.added_media,
				"File Hashes": this.file_hashes,
				fields_dict: this.fields_dict
			}
		)
	}

	regenerateSettingsRegexps() {
		let regexp_section = this.settings["CUSTOM_REGEXPS"]
		let regexp_tags_section = this.settings["REGEXP_TAGS"]
		// For new note types
		for (let note_type of this.note_types) {
			this.settings["CUSTOM_REGEXPS"][note_type] = regexp_section.hasOwnProperty(note_type) ? regexp_section[note_type] : ""
			// Initialize REGEXP_TAGS if check fails, but wait, REGEXP_TAGS is new so it might not exist.
			if (regexp_tags_section) {
				this.settings["REGEXP_TAGS"][note_type] = regexp_tags_section.hasOwnProperty(note_type) ? regexp_tags_section[note_type] : ""
			} else {
				// First time initialization handling happens in settings.ts mostly, checking hasOwnProperty.
			}
		}
		// Removing old note types
		for (let note_type of Object.keys(this.settings["CUSTOM_REGEXPS"])) {
			if (!this.note_types.includes(note_type)) {
				delete this.settings["CUSTOM_REGEXPS"][note_type]
			}
		}
		// Removing old note types from REGEXP_TAGS
		if (this.settings["REGEXP_TAGS"]) {
			for (let note_type of Object.keys(this.settings["REGEXP_TAGS"])) {
				if (!this.note_types.includes(note_type)) {
					delete this.settings["REGEXP_TAGS"][note_type]
				}
			}
		}

		// Removing old note types from FILE_LINK_FIELDS
		if (this.settings.FILE_LINK_FIELDS) {
			for (let note_type of Object.keys(this.settings.FILE_LINK_FIELDS)) {
				if (!this.note_types.includes(note_type)) {
					delete this.settings.FILE_LINK_FIELDS[note_type]
				}
			}
		}

		// Removing old note types from CONTEXT_FIELDS
		if (this.settings.CONTEXT_FIELDS) {
			for (let note_type of Object.keys(this.settings.CONTEXT_FIELDS)) {
				if (!this.note_types.includes(note_type)) {
					delete this.settings.CONTEXT_FIELDS[note_type]
				}
			}
		}

		// Removing old note types from ALIAS_FIELDS
		if (this.settings.ALIAS_FIELDS) {
			for (let note_type of Object.keys(this.settings.ALIAS_FIELDS)) {
				if (!this.note_types.includes(note_type)) {
					delete this.settings.ALIAS_FIELDS[note_type]
				}
			}
		}
	}

	validateSelectedFields() {
		// Validates that the selected fields for each note type are still valid.
		// If a field is no longer valid (e.g. was renamed or deleted in Anki), it resets to the first available field.
		for (const note_type of this.note_types) {
			const availableFields = this.fields_dict[note_type];
			if (!availableFields || availableFields.length === 0) continue;

			// Check File Link Field
			const currentLinkField = this.settings.FILE_LINK_FIELDS[note_type];
			if (currentLinkField && !availableFields.includes(currentLinkField)) {
				this.settings.FILE_LINK_FIELDS[note_type] = availableFields[0];
			}

			// Check Context Field
			const currentContextField = this.settings.CONTEXT_FIELDS[note_type];
			if (currentContextField && !availableFields.includes(currentContextField)) {
				// Keep as "" (None) if it was None and granular control allows it, checks for validity otherwise
				if (currentContextField !== "") {
					this.settings.CONTEXT_FIELDS[note_type] = availableFields[0];
				}
			}

			// Check Alias Field
			const currentAliasField = this.settings.ALIAS_FIELDS[note_type];
			if (currentAliasField && !availableFields.includes(currentAliasField)) {
				// Keep as "" (None) if it was None and granular control allows it, checks for validity otherwise
				if (currentAliasField !== "") {
					this.settings.ALIAS_FIELDS[note_type] = availableFields[0];
				}
			}
		}
	}

	/**
	 * Recursively traverse a TFolder and return all TFiles.
	 * @param tfolder - The TFolder to start the traversal from.
	 * @returns An array of TFiles found within the folder and its subfolders.
	 */
	getAllTFilesInFolder(tfolder) {
		const allTFiles = [];
		// Check if the provided object is a TFolder
		if (!(tfolder instanceof TFolder)) {
			return allTFiles;
		}
		// Iterate through the contents of the folder
		tfolder.children.forEach((child) => {
			// If it's a TFile, add it to the result
			if (child instanceof TFile) {
				allTFiles.push(child);
			} else if (child instanceof TFolder) {
				// If it's a TFolder, recursively call the function on it
				const filesInSubfolder = this.getAllTFilesInFolder(child);
				allTFiles.push(...filesInSubfolder);
			}
			// Ignore other types of files or objects
		});
		return allTFiles;
	}

	async scanVault() {
		await this.syncFiles(null, "vault")
	}

	async syncCurrentFile() {
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) {
			new Notice("No active file")
			return
		}
		if (activeFile.extension !== 'md') {
			new Notice("Active file is not a markdown file")
			return
		}
		await this.syncFiles([activeFile], "current file")
	}

	async syncCurrentFolder() {
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) {
			new Notice("No active file to determine folder")
			return
		}
		const folder = activeFile.parent
		if (!folder) {
			new Notice("Could not determine current folder")
			return
		}
		const filesInFolder = this.getAllTFilesInFolder(folder)
		await this.syncFiles(filesInFolder, `folder: ${folder.path}`)
	}

	async syncFiles(files: TFile[] | null, scope: string) {
		if (this.isSyncing) {
			new Notice("Sync already in progress...")
			return
		}

		this.isSyncing = true
		this.updateStatusBar("syncing")

		const progressModal = new ProgressModal(this.app, () => {
			this.isSyncing = false
			this.updateStatusBar("idle")
		})
		progressModal.open()

		try {
			progressModal.setStatus("Checking connection to Anki...")
			console.info("Checking connection to Anki...")

			try {
				await AnkiConnect.invoke('modelNames')
			} catch (e) {
				const errorMsg = String(e).toLowerCase();
				if (errorMsg.includes('key')) {
					new Notice("Error: couldn't connect to Anki! API key is incorrect.")
				} else {
					new Notice("Error: couldn't connect to Anki! Make sure Anki is running.")
				}
				console.error(e)
				progressModal.close()
				this.isSyncing = false
				this.updateStatusBar("error")
				return
			}

			progressModal.setStatus("Connected to Anki! Preparing files...")

			const data: ParsedSettings = await settingToData(this.app, this.settings, this.fields_dict)

			let filesToSync: TFile[]
			if (files === null) {
				// Scan vault or custom directory
				const scanDir = this.app.vault.getAbstractFileByPath(this.settings.Defaults["Scan Directory"])
				if (scanDir !== null) {
					if (scanDir instanceof TFolder) {
						console.info("Using custom scan directory: " + scanDir.path)
						filesToSync = this.getAllTFilesInFolder(scanDir)
					} else {
						new Notice("Error: incorrect path for scan directory")
						progressModal.close()
						this.isSyncing = false
						this.updateStatusBar("error")
						return
					}
				} else {
					filesToSync = this.app.vault.getMarkdownFiles()
				}
				// Filter by Scan Tags
				const scanTagsSetting = this.settings.Defaults["Scan Tags"]
				if (scanTagsSetting && scanTagsSetting.trim().length > 0) {
					const scanTags = scanTagsSetting.split(',').map(t => t.trim()).filter(t => t.length > 0)
					if (scanTags.length > 0) {
						console.info(`Filtering files by tags: ${scanTags.join(', ')}`)
						filesToSync = filesToSync.filter(file => {
							const cache = this.app.metadataCache.getFileCache(file)
							if (!cache) return false

							// Check frontmatter tags
							const frontmatterTags = cache.frontmatter?.tags
							if (frontmatterTags) {
								if (Array.isArray(frontmatterTags)) {
									if (frontmatterTags.some(tag => scanTags.includes(tag))) return true
								} else if (typeof frontmatterTags === 'string') {
									// Handle case where tags might be a comma-separated string in YAML
									const fileTags = frontmatterTags.split(',').map(t => t.trim())
									if (fileTags.some(tag => scanTags.includes(tag))) return true
								}
							}

							// Check inline tags (#tag)
							const inlineTags = cache.tags
							if (inlineTags) {
								if (inlineTags.some(tagCache => {
									const tagName = tagCache.tag.replace('#', '')
									return scanTags.includes(tagName)
								})) return true
							}

							return false
						})
					}
				}
			} else {
				filesToSync = files
			}

			progressModal.setStatus(`Syncing ${scope}...`)
			progressModal.setProgress(0, 1, `Found ${filesToSync.length} file(s)`)

			const manager = new FileManager(this.app, data, filesToSync, this.file_hashes, this.added_media)

			progressModal.setStatus("Scanning files for changes...")
			await manager.initialiseFiles()

			const changedFilesCount = manager.ownFiles.length
			if (changedFilesCount === 0) {
				new Notice("No changes detected!")
				progressModal.close()
				this.isSyncing = false
				this.updateStatusBar("idle")
				return
			}

			progressModal.setProgress(1, 2, `Processing ${changedFilesCount} changed file(s)...`)

			await manager.requests_1()

			this.added_media = Array.from(manager.added_media_set)
			const hashes = manager.getHashes()
			for (let key in hashes) {
				this.file_hashes[key] = hashes[key]
			}

			progressModal.setProgress(2, 2, "Saving changes...")
			await this.saveAllData()

			const syncAnkiWeb =
				this.settings.Defaults["Sync AnkiWeb After Export"]

			let ankiWebSynced = false

			if (syncAnkiWeb) {
				progressModal.setStatus("Syncing AnkiWeb...")

				const syncTimeoutMs = 30_000

				let timeoutId: number | undefined

				try {
					await Promise.race([
						AnkiConnect.invoke("sync"),

						new Promise((_, reject) => {
							timeoutId = window.setTimeout(
								() => reject(
									new Error("AnkiWeb sync timed out")
								),
								syncTimeoutMs
							)
						})
					])

					ankiWebSynced = true
				} catch (error) {
					console.error("AnkiWeb sync failed:", error)
					ankiWebSynced = false
				} finally {
					window.clearTimeout(timeoutId)
				}
			}

			progressModal.close()

			if (ankiWebSynced) {
				new Notice(`✅ Successfully synced ${changedFilesCount} file(s) to Anki and AnkiWeb!`)
			} else if (syncAnkiWeb) {
				new Notice(`⚠️ Successfully synced ${changedFilesCount} file(s) to Anki, but AnkiWeb sync failed...`)
			} else {
				new Notice(`✅ Successfully synced ${changedFilesCount} file(s) to Anki!`)
			}

			this.updateStatusBar("success")

			// Reset to idle after 3 seconds
			setTimeout(() => {
				this.updateStatusBar("idle")
			}, 3000)

		} catch (e) {
			console.error("Error during sync:", e)
			new Notice("Error during sync. Check console for details.")
			progressModal.close()
			this.updateStatusBar("error")
		} finally {
			this.isSyncing = false
		}
	}

	updateStatusBar(state: "idle" | "syncing" | "success" | "error") {
		if (!this.statusBarItem) return

		this.statusBarItem.empty()

		const container = this.statusBarItem.createDiv({ cls: 'anki-status-bar-item' })

		let icon = "📝"
		let text = "Anki"
		let className = ""

		switch (state) {
			case "syncing":
				icon = "🔄"
				text = "Syncing..."
				className = "anki-status-syncing"
				break
			case "success":
				icon = "✅"
				text = "Synced"
				className = "anki-status-success"
				break
			case "error":
				icon = "❌"
				text = "Error"
				className = "anki-status-error"
				break
			default:
				icon = "📝"
				text = "Anki"
		}

		container.createSpan({ text: icon })
		container.createSpan({ text: text, cls: className })
	}

	configureStatusBar() {
		if (!this.statusBarItem) return
		if (this.settings.Defaults["Show Status Bar"]) {
			this.statusBarItem.style.display = ''
		} else {
			this.statusBarItem.style.display = 'none'
		}
	}

	async onload() {
		console.log('loading Obsidian_to_Anki...');
		addIcon('anki', ANKI_ICON)
		try {
			this.settings = await this.loadSettings()
			AnkiConnect.setApiKey(this.settings.Defaults["AnkiConnect API Key"] || "");
		}
		catch (e) {
			const errorMsg = String(e).toLowerCase();
			if (errorMsg.includes('key')) {
				new Notice("Couldn't connect to Anki! API key is incorrect. Check console for error message.")
			} else {
				new Notice("Couldn't connect to Anki! Check console for error message.")
			}
			return
		}

		this.registerMarkdownPostProcessor((el, ctx) => {
			clozeRenderer(el, ctx, this.settings.Defaults["Render Clozes in Reading View"], this.settings.Defaults["Render Clozes - Highlight"])
		})

		this.note_types = Object.keys(this.settings["CUSTOM_REGEXPS"]).sort()
		this.fields_dict = await this.loadFieldsDict()
		if (Object.keys(this.fields_dict).length == 0) {
			new Notice('Need to connect to Anki to generate fields dictionary...')
			try {
				this.fields_dict = await this.generateFieldsDict()
				new Notice("Fields dictionary successfully generated!")
			}
			catch (e) {
				const errorMsg = String(e).toLowerCase();
				if (errorMsg.includes('key')) {
					new Notice("Couldn't connect to Anki! API key is incorrect. Check console for error message.")
				} else {
					new Notice("Couldn't connect to Anki! Check console for error message.")
				}
				return
			}
		}
		this.added_media = await this.loadAddedMedia()
		this.file_hashes = await this.loadFileHashes()

		// Add status bar
		this.statusBarItem = this.addStatusBarItem()
		this.updateStatusBar("idle")
		this.configureStatusBar()

		this.addSettingTab(new SettingsTab(this.app, this));

		this.addRibbonIcon('anki', 'Obsidian_to_Anki - Sync Vault', async () => {
			await this.scanVault()
		})

		// Commands
		this.addCommand({
			id: 'anki-sync-vault',
			name: 'Sync Entire Vault',
			callback: async () => {
				await this.scanVault()
			}
		})

		this.addCommand({
			id: 'anki-sync-current-file',
			name: 'Sync Current File',
			callback: async () => {
				await this.syncCurrentFile()
			}
		})

		this.addCommand({
			id: 'anki-sync-current-folder',
			name: 'Sync Current Folder',
			callback: async () => {
				await this.syncCurrentFolder()
			}
		})

		this.addCommand({
			id: 'anki-cloze-add',
			name: 'Add Anki Cloze',
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (selection && !this.checkClozeContext(editor)) {
					if (!checking) {
						this.applyCloze(editor, selection);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'anki-cloze-remove',
			name: 'Remove Anki Cloze',
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				if (this.checkClozeContext(editor)) {
					if (!checking) {
						this.removeCloze(editor);
					}
					return true;
				}
				return false;
			}
		});

		// Context menu for files
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				if (file instanceof TFile && file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('Sync to Anki')
							.setIcon('anki')
							.onClick(async () => {
								await this.syncFiles([file], `file: ${file.name}`)
							})
					})
					// Check if experimental feature is enabled
					if (this.settings.Defaults["Bulk Delete IDs"]) {
						menu.addItem((item) => {
							item
								.setTitle('Delete all IDs in file')
								.setIcon('trash')
								.onClick(async () => {
									await checkAndBulkDelete(this.app, file)
								});
							(item as any).setWarning(true);
						})
					}
				} else if (file instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle('Sync Folder to Anki')
							.setIcon('anki')
							.onClick(async () => {
								const filesInFolder = this.getAllTFilesInFolder(file)
								await this.syncFiles(filesInFolder, `folder: ${file.path}`)
							})
					})
				}
			})
		)

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				if (this.settings.Defaults["Cloze Deletion Context Menu"]) {
					if (this.checkClozeContext(editor)) {
						menu.addItem((item) => {
							item
								.setTitle('Remove Anki Cloze')
								.setIcon('anki')
								.onClick(() => {
									this.removeCloze(editor);
								});
						});
					} else {
						const selection = editor.getSelection();
						if (selection) {
							menu.addItem((item) => {
								item
									.setTitle('Anki Cloze')
									.setIcon('anki')
									.onClick(() => {
										this.applyCloze(editor, selection);
									});
							});
						}
					}
				}
			})
		);
	}

	private applyCloze(editor: Editor, selection: string) {
		const startLine = editor.getCursor("from").line;
		const endLine = editor.getCursor("to").line;
		let contextContent = "";

		for (let i = startLine; i <= endLine; i++) {
			contextContent += editor.getLine(i) + "\n";
		}

		const regex = /{{c(\d+)::/g;
		const matches = contextContent.matchAll(regex);
		const existingNumbers = new Set<number>();
		for (const match of matches) {
			existingNumbers.add(parseInt(match[1], 10));
		}

		let nextNumber = 1;
		while (existingNumbers.has(nextNumber)) {
			nextNumber++;
		}

		const replacement = `{{c${nextNumber}::${selection}}}`;
		editor.replaceSelection(replacement);
	}

	private checkClozeContext(editor: Editor): boolean {
		return this.findOverlappingClozes(editor).length > 0;
	}

	private findOverlappingClozes(editor: Editor): { line: number, from: number, to: number, content: string }[] {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		const results = [];

		for (let i = from.line; i <= to.line; i++) {
			const lineText = editor.getLine(i);
			const regex = /{{c\d+::((?:(?!}}).)*)}}/g;
			let match;
			while ((match = regex.exec(lineText)) !== null) {
				const start = match.index;
				const end = start + match[0].length;

				let selStart = (i === from.line) ? from.ch : 0;
				let selEnd = (i === to.line) ? to.ch : lineText.length;

				let isOverlap = false;
				if (selStart === selEnd) {
					// Point cursor (inclusive check)
					if (selStart >= start && selStart <= end) isOverlap = true;
				} else {
					// Range selection (overlap check)
					if (selStart < end && selEnd > start) isOverlap = true;
				}

				if (isOverlap) {
					results.push({
						line: i,
						from: start,
						to: end,
						content: match[1]
					});
				}
			}
		}
		return results;
	}

	private removeCloze(editor: Editor) {
		const clozes = this.findOverlappingClozes(editor);
		// Sort by line descending, then from descending to ensure replacements don't shift indices
		clozes.sort((a, b) => {
			if (a.line !== b.line) return b.line - a.line;
			return b.from - a.from;
		});

		for (const cloze of clozes) {
			const content = cloze.content.split('::')[0];
			editor.replaceRange(content, { line: cloze.line, ch: cloze.from }, { line: cloze.line, ch: cloze.to });
		}
	}

	async onunload() {
		console.log("Saving settings for Obsidian_to_Anki...")
		this.saveAllData()
		console.log('unloading Obsidian_to_Anki...');
	}
}
