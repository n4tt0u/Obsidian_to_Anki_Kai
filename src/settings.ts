import { PluginSettingTab, Setting, Notice, TFolder, App } from 'obsidian'
import * as AnkiConnect from './anki'
import { TabContainer } from './ui/TabContainer'
import { SearchableTable } from './ui/SearchableTable'
import { FolderSuggestModal, getAllFolders } from './ui/FolderSuggester'

const defaultDescs = {
	"Scan Directory": "The directory to scan. Leave empty to scan the entire vault",
	"Tag": "The tag that the plugin automatically adds to any generated cards.",
	"Deck": "The deck the plugin adds cards to if TARGET DECK is not specified in the file.",
	"Scheduling Interval": "The time, in minutes, between automatic scans of the vault. Set this to 0 to disable automatic scanning.",
	"Add File Link": "Append a link to the file that generated the flashcard on the field specified in the table.",
	"Add File Link - Insert Newline": "Insert a newline/break before the file link.",
	"Add Context": "Append 'context' for the card, in the form of path > heading > heading etc, to the field specified in the table.",
	"CurlyCloze": "Convert {cloze deletions} -> {{c1::cloze deletions}} on note types that have a 'Keyword' in their name.",
	"CurlyCloze - Keyword": "The keyword to trigger CurlyCloze on note types.",
	"CurlyCloze - Highlights to Clozes": "Convert ==highlights== -> {highlights} to be processed by CurlyCloze.",
	"ID Comments": "Wrap note IDs in a HTML comment.",
	"Add Obsidian Tags": "Interpret #tags in the fields of a note as Anki tags, removing them from the note text in Anki.",
	"YAML Tags": "Send tags defined in YAML frontmatter to Anki.",
	"Smart Scan": "Skip files that haven't changed since the last scan (based on MD5 hash). Disable to force a full scan."
}

export const DEFAULT_IGNORED_FILE_GLOBS = [
	'**/*.excalidraw.md'
];

export class SettingsTab extends PluginSettingTab {
	private tabContainer: TabContainer

	display() {
		const { containerEl } = this
		containerEl.empty()

		// Header
		containerEl.createEl('h2', { text: 'Obsidian_to_Anki Settings' })
		const wikiLink = containerEl.createEl('a', {
			text: 'For more information check the wiki',
			href: "https://github.com/Pseudonium/Obsidian_to_Anki/wiki"
		})
		wikiLink.style.marginBottom = '16px'
		wikiLink.style.display = 'block'

		// Create tabs
		this.tabContainer = new TabContainer(containerEl, [
			{ id: 'general', name: 'General' },
			{ id: 'note-types', name: 'Note Types' },
			{ id: 'folders', name: 'Folders' },
			{ id: 'syntax', name: 'Syntax' },
			{ id: 'advanced', name: 'Advanced' }
		])

		this.setupGeneralTab()
		this.setupNoteTypesTab()
		this.setupFoldersTab()
		this.setupSyntaxTab()
		this.setupAdvancedTab()
	}

	private setupGeneralTab() {
		const container = this.tabContainer.getTabContent('general')
		if (!container) return

		const plugin = (this as any).plugin

		// Defaults section
		container.createEl('h3', { text: 'Default Settings' })

		// Scan Directory with Folder Picker
		const scanDirSetting = new Setting(container)
			.setName('Scan Directory')
			.setDesc(defaultDescs['Scan Directory'])

		const scanDirContainer = scanDirSetting.controlEl.createDiv({
			cls: 'anki-folder-picker-container'
		})

		const scanDirInput = scanDirContainer.createEl('input', {
			type: 'text',
			value: plugin.settings.Defaults["Scan Directory"] || '',
			placeholder: 'Leave empty for entire vault'
		})
		scanDirInput.style.flexGrow = '1'

		scanDirInput.addEventListener('change', () => {
			plugin.settings.Defaults["Scan Directory"] = scanDirInput.value
			plugin.saveAllData()
		})

		const folderPickerBtn = scanDirContainer.createEl('button', {
			text: '📁 Browse',
			cls: 'anki-folder-picker-btn'
		})

		folderPickerBtn.addEventListener('click', () => {
			const folders = getAllFolders(this.app)
			new FolderSuggestModal(this.app, folders, (folder) => {
				scanDirInput.value = folder.path
				plugin.settings.Defaults["Scan Directory"] = folder.path
				plugin.saveAllData()
			}).open()
		})

		// Other defaults
		this.addDefaultSettings(container, plugin)

		// Ignored Files section
		container.createEl('h3', { text: 'Ignored Files & Folders', cls: 'anki-settings-section' })
		this.setup_ignore_files(container, plugin)
	}

	private addDefaultSettings(container: HTMLElement, plugin: any) {
		// To account for new settings
		if (!(plugin.settings["Defaults"].hasOwnProperty("Scan Directory"))) {
			plugin.settings["Defaults"]["Scan Directory"] = ""
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Add Context"))) {
			plugin.settings["Defaults"]["Add Context"] = false
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Scheduling Interval"))) {
			plugin.settings["Defaults"]["Scheduling Interval"] = 0
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("CurlyCloze - Highlights to Clozes"))) {
			plugin.settings["Defaults"]["CurlyCloze - Highlights to Clozes"] = false
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Add File Link - Insert Newline"))) {
			plugin.settings["Defaults"]["Add File Link - Insert Newline"] = true
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Add Obsidian Tags"))) {
			plugin.settings["Defaults"]["Add Obsidian Tags"] = false
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("CurlyCloze - Keyword"))) {
			plugin.settings["Defaults"]["CurlyCloze - Keyword"] = "Cloze"
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Smart Scan"))) {
			plugin.settings["Defaults"]["Smart Scan"] = true
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("YAML Tags"))) {
			plugin.settings["Defaults"]["YAML Tags"] = false
		}

		for (let key of Object.keys(defaultDescs)) {
			// Skip Scan Directory (already added above) and Regex
			if (key === "Scan Directory" || key === "Regex") {
				continue
			}

			if (typeof plugin.settings["Defaults"][key] === "string") {
				new Setting(container)
					.setName(key)
					.setDesc(defaultDescs[key])
					.addText(
						text => text.setValue(plugin.settings["Defaults"][key])
							.onChange((value) => {
								plugin.settings["Defaults"][key] = value
								plugin.saveAllData()
							})
					)
			} else if (typeof plugin.settings["Defaults"][key] === "boolean") {
				new Setting(container)
					.setName(key)
					.setDesc(defaultDescs[key])
					.addToggle(
						toggle => toggle.setValue(plugin.settings["Defaults"][key])
							.onChange((value) => {
								plugin.settings["Defaults"][key] = value
								plugin.saveAllData()
							})
					)
			} else {
				new Setting(container)
					.setName(key)
					.setDesc(defaultDescs[key])
					.addSlider(
						slider => {
							slider.setValue(plugin.settings["Defaults"][key])
								.setLimits(0, 360, 5)
								.setDynamicTooltip()
								.onChange(async (value) => {
									plugin.settings["Defaults"][key] = value
									await plugin.saveAllData()
									if (plugin.hasOwnProperty("schedule_id")) {
										window.clearInterval(plugin.schedule_id)
									}
									if (value != 0) {
										plugin.schedule_id = window.setInterval(async () => await plugin.scanVault(), value * 1000 * 60)
										plugin.registerInterval(plugin.schedule_id)
									}
								})
						}
					)
			}
		}
	}

	private setupNoteTypesTab() {
		const container = this.tabContainer.getTabContent('note-types')
		if (!container) return

		const plugin = (this as any).plugin

		container.createEl('h3', { text: 'Note Type Configuration' })
		container.createEl('p', {
			text: 'Configure custom regular expressions and field mappings for each Anki note type.',
			cls: 'setting-item-description'
		})

		// Create searchable table
		const tableContainer = container.createDiv()
		const searchableTable = new SearchableTable(
			tableContainer,
			['Note Type', 'Custom Regexp', 'File Link Field', 'Context Field'],
			'Search note types...'
		)

		if (!(plugin.settings.hasOwnProperty("CONTEXT_FIELDS"))) {
			plugin.settings.CONTEXT_FIELDS = {}
		}

		for (let note_type of plugin.note_types) {
			const row = searchableTable.addRow()
			const cells: HTMLTableCellElement[] = []

			for (let i = 0; i < 4; i++) {
				cells.push(searchableTable.insertCell(row))
			}

			cells[0].innerHTML = note_type
			this.setup_custom_regexp(note_type, cells, plugin)
			this.setup_link_field(note_type, cells, plugin)
			this.setup_context_field(note_type, cells, plugin)
		}
	}

	private setupFoldersTab() {
		const container = this.tabContainer.getTabContent('folders')
		if (!container) return

		const plugin = (this as any).plugin
		const folder_list = this.get_folders()

		container.createEl('h3', { text: 'Folder Configuration' })
		container.createEl('p', {
			text: 'Set custom decks and tags for specific folders. These settings apply to all files within the folder.',
			cls: 'setting-item-description'
		})

		// Create searchable table
		const tableContainer = container.createDiv()
		const searchableTable = new SearchableTable(
			tableContainer,
			['Folder', 'Folder Deck', 'Folder Tags'],
			'Search folders...'
		)

		if (!(plugin.settings.hasOwnProperty("FOLDER_DECKS"))) {
			plugin.settings.FOLDER_DECKS = {}
		}
		if (!(plugin.settings.hasOwnProperty("FOLDER_TAGS"))) {
			plugin.settings.FOLDER_TAGS = {}
		}

		for (let folder of folder_list) {
			const row = searchableTable.addRow()
			const cells: HTMLTableCellElement[] = []

			for (let i = 0; i < 3; i++) {
				cells.push(searchableTable.insertCell(row))
			}

			cells[0].innerHTML = folder.path
			this.setup_folder_deck(folder, cells, plugin)
			this.setup_folder_tag(folder, cells, plugin)
		}
	}

	private setupSyntaxTab() {
		const container = this.tabContainer.getTabContent('syntax')
		if (!container) return

		const plugin = (this as any).plugin

		container.createEl('h3', { text: 'Syntax Settings' })
		container.createEl('p', {
			text: 'Customize the syntax markers used to identify flashcards in your notes.',
			cls: 'setting-item-description'
		})

		for (let key of Object.keys(plugin.settings["Syntax"])) {
			new Setting(container)
				.setName(key)
				.addText(
					text => text.setValue(plugin.settings["Syntax"][key])
						.onChange((value) => {
							plugin.settings["Syntax"][key] = value
							plugin.saveAllData()
						})
				)
		}
	}

	private setupAdvancedTab() {
		const container = this.tabContainer.getTabContent('advanced')
		if (!container) return

		const plugin = (this as any).plugin

		container.createEl('h3', { text: 'Actions' })
		this.setup_buttons(container, plugin)

		container.createEl('h3', { text: 'Import/Export Settings', cls: 'anki-settings-section' })
		this.setup_import_export(container, plugin)
	}

	private setup_ignore_files(container: HTMLElement, plugin: any) {
		plugin.settings["IGNORED_FILE_GLOBS"] = plugin.settings.hasOwnProperty("IGNORED_FILE_GLOBS") ?
			plugin.settings["IGNORED_FILE_GLOBS"] : DEFAULT_IGNORED_FILE_GLOBS

		const descriptionFragment = document.createDocumentFragment()
		descriptionFragment.createEl("span", { text: "Glob patterns for files to ignore. One per line. " })
		descriptionFragment.createEl("a", {
			text: "See README for examples",
			href: "https://github.com/Pseudonium/Obsidian_to_Anki?tab=readme-ov-file#features"
		})

		new Setting(container)
			.setName("Patterns to ignore")
			.setDesc(descriptionFragment)
			.addTextArea(text => {
				text.setValue(plugin.settings.IGNORED_FILE_GLOBS.join("\n"))
					.setPlaceholder("Examples:\n**/*.excalidraw.md\nTemplates/**\n**/private/**")
					.onChange((value) => {
						let ignoreLines = value.split("\n")
						ignoreLines = ignoreLines.filter(e => e.trim() != "")
						plugin.settings.IGNORED_FILE_GLOBS = ignoreLines
						plugin.saveAllData()
					})
				text.inputEl.rows = 8
				text.inputEl.cols = 50
			})
	}

	private setup_import_export(container: HTMLElement, plugin: any) {
		new Setting(container)
			.setName("Export Settings")
			.setDesc("Export your plugin settings to a JSON file")
			.addButton(button => {
				button.setButtonText("Export")
					.onClick(async () => {
						const settings = plugin.settings
						const dataStr = JSON.stringify(settings, null, 2)
						const blob = new Blob([dataStr], { type: 'application/json' })
						const url = URL.createObjectURL(blob)
						const a = document.createElement('a')
						a.href = url
						a.download = 'obsidian-to-anki-settings.json'
						a.click()
						URL.revokeObjectURL(url)
						new Notice("Settings exported successfully!")
					})
			})

		new Setting(container)
			.setName("Import Settings")
			.setDesc("Import plugin settings from a JSON file")
			.addButton(button => {
				button.setButtonText("Import")
					.onClick(() => {
						const input = document.createElement('input')
						input.type = 'file'
						input.accept = '.json'
						input.onchange = async (e: any) => {
							const file = e.target.files[0]
							if (file) {
								const reader = new FileReader()
								reader.onload = async (e: any) => {
									try {
										const imported = JSON.parse(e.target.result)
										plugin.settings = imported
										await plugin.saveAllData()
										this.display() // Refresh UI
										new Notice("Settings imported successfully!")
									} catch (err) {
										new Notice("Error importing settings: " + err.message)
									}
								}
								reader.readAsText(file)
							}
						}
						input.click()
					})
			})
	}

	// Helper methods from original settings.ts
	setup_custom_regexp(note_type: string, cells: HTMLTableCellElement[], plugin: any) {
		let regexp_section = plugin.settings["CUSTOM_REGEXPS"]
		let custom_regexp = new Setting(cells[1])
			.addText(
				text => text.setValue(
					regexp_section.hasOwnProperty(note_type) ? regexp_section[note_type] : ""
				)
					.onChange((value) => {
						plugin.settings["CUSTOM_REGEXPS"][note_type] = value
						plugin.saveAllData()
					})
			)
		custom_regexp.settingEl = cells[1]
		custom_regexp.infoEl.remove()
		custom_regexp.controlEl.className += " anki-center"
	}

	setup_link_field(note_type: string, cells: HTMLTableCellElement[], plugin: any) {
		let link_fields_section = plugin.settings.FILE_LINK_FIELDS
		let link_field = new Setting(cells[2])
			.addDropdown(
				async dropdown => {
					if (!(plugin.fields_dict[note_type])) {
						plugin.fields_dict = await plugin.loadFieldsDict()
						if (Object.keys(plugin.fields_dict).length != plugin.note_types.length) {
							new Notice('Need to connect to Anki to generate fields dictionary...')
							try {
								plugin.fields_dict = await plugin.generateFieldsDict()
								new Notice("Fields dictionary successfully generated!")
							}
							catch (e) {
								new Notice("Couldn't connect to Anki! Check console for error message.")
								return
							}
						}
					}
					const field_names = plugin.fields_dict[note_type]
					for (let field of field_names) {
						dropdown.addOption(field, field)
					}
					dropdown.setValue(
						link_fields_section.hasOwnProperty(note_type) ? link_fields_section[note_type] : field_names[0]
					)
					dropdown.onChange((value) => {
						plugin.settings.FILE_LINK_FIELDS[note_type] = value
						plugin.saveAllData()
					})
				}
			)
		link_field.settingEl = cells[2]
		link_field.infoEl.remove()
		link_field.controlEl.className += " anki-center"
	}

	setup_context_field(note_type: string, cells: HTMLTableCellElement[], plugin: any) {
		let context_fields_section: Record<string, string> = plugin.settings.CONTEXT_FIELDS
		let context_field = new Setting(cells[3])
			.addDropdown(
				async dropdown => {
					const field_names = plugin.fields_dict[note_type]
					for (let field of field_names) {
						dropdown.addOption(field, field)
					}
					dropdown.setValue(
						context_fields_section.hasOwnProperty(note_type) ? context_fields_section[note_type] : field_names[0]
					)
					dropdown.onChange((value) => {
						plugin.settings.CONTEXT_FIELDS[note_type] = value
						plugin.saveAllData()
					})
				}
			)
		context_field.settingEl = cells[3]
		context_field.infoEl.remove()
		context_field.controlEl.className += " anki-center"
	}

	get_folders(): TFolder[] {
		return getAllFolders(this.app)
	}

	setup_folder_deck(folder: TFolder, cells: HTMLTableCellElement[], plugin: any) {
		let folder_decks = plugin.settings.FOLDER_DECKS
		if (!(folder_decks.hasOwnProperty(folder.path))) {
			folder_decks[folder.path] = ""
		}
		let folder_deck = new Setting(cells[1])
			.addText(
				text => text.setValue(folder_decks[folder.path])
					.onChange((value) => {
						plugin.settings.FOLDER_DECKS[folder.path] = value
						plugin.saveAllData()
					})
			)
		folder_deck.settingEl = cells[1]
		folder_deck.infoEl.remove()
		folder_deck.controlEl.className += " anki-center"
	}

	setup_folder_tag(folder: TFolder, cells: HTMLTableCellElement[], plugin: any) {
		let folder_tags = plugin.settings.FOLDER_TAGS
		if (!(folder_tags.hasOwnProperty(folder.path))) {
			folder_tags[folder.path] = ""
		}
		let folder_tag = new Setting(cells[2])
			.addText(
				text => text.setValue(folder_tags[folder.path])
					.onChange((value) => {
						plugin.settings.FOLDER_TAGS[folder.path] = value
						plugin.saveAllData()
					})
			)
		folder_tag.settingEl = cells[2]
		folder_tag.infoEl.remove()
		folder_tag.controlEl.className += " anki-center"
	}

	setup_buttons(container: HTMLElement, plugin: any) {
		new Setting(container)
			.setName("Regenerate Note Type Table")
			.setDesc("Connect to Anki to regenerate the table with new note types, or remove deleted note types.")
			.addButton(
				button => {
					button.setButtonText("Regenerate").setClass("mod-cta")
						.onClick(async () => {
							new Notice("Connecting to Anki to update note types...")
							try {
								plugin.note_types = await AnkiConnect.invoke('modelNames')
								plugin.regenerateSettingsRegexps()
								plugin.fields_dict = await plugin.loadFieldsDict()
								if (Object.keys(plugin.fields_dict).length != plugin.note_types.length) {
									new Notice('Generating fields dictionary...')
									try {
										plugin.fields_dict = await plugin.generateFieldsDict()
										new Notice("Fields dictionary successfully generated!")
									}
									catch (e) {
										new Notice("Couldn't connect to Anki! Check console for error message.")
										return
									}
								}
								await plugin.saveAllData()
								this.display() // Refresh entire UI
								new Notice("Note types updated successfully!")
							} catch (e) {
								new Notice("Couldn't connect to Anki! Check console for details.")
								console.error(e)
							}
						})
				}
			)

		new Setting(container)
			.setName("Clear Media Cache")
			.setDesc("Clear the cached list of media filenames that have been added to Anki. Use this if you've updated a media file with the same name.")
			.addButton(
				button => {
					button.setButtonText("Clear").setClass("mod-warning")
						.onClick(async () => {
							plugin.added_media = []
							await plugin.saveAllData()
							new Notice("Media cache cleared successfully!")
						})
				}
			)

		new Setting(container)
			.setName("Clear File Hash Cache")
			.setDesc("Clear the cached dictionary of file hashes. The plugin will re-scan all files on next sync.")
			.addButton(
				button => {
					button.setButtonText("Clear").setClass("mod-warning")
						.onClick(async () => {
							plugin.file_hashes = {}
							await plugin.saveAllData()
							new Notice("File hash cache cleared successfully!")
						})
				}
			)
	}
}
