import { PluginSettingTab, Setting, Notice, TFolder, App } from 'obsidian'
import * as AnkiConnect from './anki'
import { TabContainer } from './ui/TabContainer'
import { SearchableTable } from './ui/SearchableTable'
import { FolderSuggestModal, getAllFolders } from './ui/FolderSuggester'

const defaultDescs = {
	"Scan Directory": "The directory to scan. Leave empty to scan the entire vault",
	"Scan Tags": "The tags to scan. Leave empty to scan all files. Separate multiple tags with commas.",
	"Tag": "The tag(s) that the plugin automatically adds to any generated cards. Separate multiple tags with commas.",
	"Deck": "The deck the plugin adds cards to if TARGET DECK is not specified in the file.",
	"Scheduling Interval": "The time, in minutes, between automatic scans of the vault. Set this to 0 to disable automatic scanning.",
	"Add File Link": "Append a link to the file that generated the flashcard on the field specified in the table.",
	"Add Context": "Append 'context' for the card, in the form of path > heading > heading etc, to the field specified in the table.",
	"Add Aliases": "Append aliases from frontmatter to the field specified in the table.",
	"CurlyCloze": "Convert {cloze deletions} -> {{c1::cloze deletions}} on note types that have a 'Keyword' in their name.",
	"CurlyCloze - Keyword": "The keyword to trigger CurlyCloze on note types.",
	"CurlyCloze - Highlights to Clozes": "Convert ==highlights== -> {highlights} to be processed by CurlyCloze.",
	"ID Comments": "Wrap note IDs in a HTML comment.",
	"Add Obsidian Tags": "Interpret #tags in the fields of a note as Anki tags, removing them from the note text in Anki.",
	"Add Obsidian YAML Tags": "Send tags defined in YAML frontmatter to Anki.",
	"Smart Scan": "Skip files that haven't changed since the last scan (based on MD5 hash). Disable to force a full scan.",
	"Bulk Delete IDs": "Enables 'Delete all IDs in file' menu. Deletes Anki notes for IDs found in the selected file and removes the IDs."
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

		// Scan Tags
		new Setting(container)
			.setName('Scan Tags')
			.setDesc(defaultDescs['Scan Tags'])
			.addText(text => text
				.setPlaceholder('tag1, tag2')
				.setValue(plugin.settings.Defaults["Scan Tags"] || '')
				.onChange((value) => {
					plugin.settings.Defaults["Scan Tags"] = value
					plugin.saveAllData()
				}))

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
		if (!(plugin.settings["Defaults"].hasOwnProperty("Scan Tags"))) {
			plugin.settings["Defaults"]["Scan Tags"] = ""
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Add Context"))) {
			plugin.settings["Defaults"]["Add Context"] = false
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Add Aliases"))) {
			plugin.settings["Defaults"]["Add Aliases"] = false
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Scheduling Interval"))) {
			plugin.settings["Defaults"]["Scheduling Interval"] = 0
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("CurlyCloze - Highlights to Clozes"))) {
			plugin.settings["Defaults"]["CurlyCloze - Highlights to Clozes"] = false
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
		if (!(plugin.settings["Defaults"].hasOwnProperty("Add Obsidian YAML Tags"))) {
			plugin.settings["Defaults"]["Add Obsidian YAML Tags"] = false
		}
		if (!(plugin.settings["Defaults"].hasOwnProperty("Bulk Delete IDs"))) {
			plugin.settings["Defaults"]["Bulk Delete IDs"] = false
		}


		if (!(plugin.settings["Defaults"].hasOwnProperty("Regex Required Tags"))) {
			plugin.settings["Defaults"]["Regex Required Tags"] = false
		}

		for (let key of Object.keys(defaultDescs)) {
			// Skip Scan Directory (already added above) and Regex
			if (key === "Scan Directory" || key === "Scan Tags" || key === "Regex" || key === "Bulk Delete IDs" || key === "Regex Required Tags" || key === "Smart Scan") {
				continue
			}

			if (typeof plugin.settings["Defaults"][key] === "string") {
				new Setting(container)
					.setName(key)
					.setDesc(defaultDescs[key])
					.addText(
						text => {
							if (key === "Tag") {
								text.setPlaceholder("tag1, tag2")
							}
							text.setValue(plugin.settings["Defaults"][key])
								.onChange((value) => {
									plugin.settings["Defaults"][key] = value
									plugin.saveAllData()
								})
						}
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
								if (key === "Add File Link" || key === "Add Context" || key === "Add Aliases") {
									this.display()
								}
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
		const enableRequiredTags = plugin.settings.Defaults["Regex Required Tags"];
		const enableLink = plugin.settings.Defaults["Add File Link"];
		const enableContext = plugin.settings.Defaults["Add Context"];
		const enableAliases = plugin.settings.Defaults["Add Aliases"];


		container.createEl('h3', { text: 'Note Type Configuration' })
		container.createEl('p', {
			text: 'Configure custom regular expressions and field mappings for each Anki note type.',
			cls: 'setting-item-description'
		})

		// Create searchable table
		const tableContainer = container.createDiv()
		const headers = ['Note Type', 'Custom Regexp'];
		if (enableRequiredTags) {
			headers.push('Required Tags');
		}

		// Conditionally add headers
		if (enableLink) headers.push('File Link Field');
		if (enableContext) headers.push('Context Field');
		if (enableAliases) headers.push('Aliases Field');

		const searchableTable = new SearchableTable(
			tableContainer,
			headers,
			'Search note types...'
		)

		if (!(plugin.settings.hasOwnProperty("CONTEXT_FIELDS"))) {
			plugin.settings.CONTEXT_FIELDS = {}
		}
		if (!(plugin.settings.hasOwnProperty("ALIAS_FIELDS"))) {
			plugin.settings.ALIAS_FIELDS = {}
		}
		if (!(plugin.settings.hasOwnProperty("REGEXP_TAGS"))) {
			plugin.settings.REGEXP_TAGS = {}
		}

		for (let note_type of plugin.note_types) {
			const row = searchableTable.addRow()
			const cells: HTMLTableCellElement[] = []

			// Calculate total columns needed
			let colCount = 2; // Note Type + Custom Regexp
			if (enableRequiredTags) colCount++;
			if (enableLink) colCount++;
			if (enableContext) colCount++;
			if (enableAliases) colCount++;

			for (let i = 0; i < colCount; i++) {
				cells.push(searchableTable.insertCell(row))
			}

			let cellIdx = 0;
			cells[cellIdx++].innerHTML = note_type; // Note Type
			this.setup_custom_regexp(note_type, cells[cellIdx++], plugin); // Custom Regexp

			if (enableRequiredTags) {
				this.setup_regexp_tags(note_type, cells[cellIdx++], plugin); // Required Tags
			}

			if (enableLink) {
				this.setup_link_field(note_type, cells[cellIdx++], plugin);
			}
			if (enableContext) {
				this.setup_context_field(note_type, cells[cellIdx++], plugin);
			}
			if (enableAliases) {
				this.setup_alias_field(note_type, cells[cellIdx++], plugin);
			}
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

		container.createEl('h3', { text: 'Experimental Features', cls: 'anki-settings-section' })

		new Setting(container)
			.setName("Smart Scan")
			.setDesc(defaultDescs["Smart Scan"])
			.addToggle(toggle => toggle
				.setValue(plugin.settings.Defaults["Smart Scan"])
				.onChange((value) => {
					plugin.settings.Defaults["Smart Scan"] = value
					plugin.saveAllData()
				})
			)


		new Setting(container)
			.setName("Bulk Delete IDs")
			.setDesc(defaultDescs["Bulk Delete IDs"])
			.addToggle(toggle => toggle
				.setValue(plugin.settings.Defaults["Bulk Delete IDs"])
				.onChange((value) => {
					plugin.settings.Defaults["Bulk Delete IDs"] = value
					plugin.saveAllData()
				})
			)





		new Setting(container)
			.setName("Regex Required Tags")
			.setDesc("Enables 'Required Tags' column in Note Types. Allows specifying tags that must be present for a regex to apply.")
			.addToggle(toggle => toggle
				.setValue(plugin.settings.Defaults["Regex Required Tags"])
				.onChange((value) => {
					plugin.settings.Defaults["Regex Required Tags"] = value
					plugin.saveAllData()
					this.display() // Refresh to show/hide column
				})
			)
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
	setup_custom_regexp(note_type: string, cell: HTMLTableCellElement, plugin: any) {
		let regexp_section = plugin.settings["CUSTOM_REGEXPS"]
		let custom_regexp = new Setting(cell)
			.addText(
				text => text.setValue(
					regexp_section.hasOwnProperty(note_type) ? regexp_section[note_type] : ""
				)
					.onChange((value) => {
						plugin.settings["CUSTOM_REGEXPS"][note_type] = value
						plugin.saveAllData()
					})
			)
		custom_regexp.settingEl = cell
		custom_regexp.infoEl.remove()
		custom_regexp.controlEl.className += " anki-center"
	}

	setup_regexp_tags(note_type: string, cell: HTMLTableCellElement, plugin: any) {
		let regexp_tags_section = plugin.settings["REGEXP_TAGS"]
		let setting = new Setting(cell)
			.addText(
				text => text.setValue(
					regexp_tags_section.hasOwnProperty(note_type) ? regexp_tags_section[note_type] : ""
				)
					.setPlaceholder("tag1, tag2")
					.onChange((value) => {
						plugin.settings["REGEXP_TAGS"][note_type] = value
						plugin.saveAllData()
					})
			)
		setting.settingEl = cell
		setting.infoEl.remove()
		setting.controlEl.className += " anki-center"
	}

	setup_link_field(note_type: string, cell: HTMLTableCellElement, plugin: any) {
		let link_fields_section = plugin.settings.FILE_LINK_FIELDS
		let link_field = new Setting(cell)
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
					dropdown.addOption("", "None")
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
		link_field.settingEl = cell
		link_field.infoEl.remove()
		link_field.controlEl.className += " anki-center"
	}

	setup_context_field(note_type: string, cell: HTMLTableCellElement, plugin: any) {
		let context_fields_section: Record<string, string> = plugin.settings.CONTEXT_FIELDS
		let context_field = new Setting(cell)
			.addDropdown(
				async dropdown => {
					const field_names = plugin.fields_dict[note_type]
					dropdown.addOption("", "None")
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
		context_field.settingEl = cell
		context_field.infoEl.remove()
		context_field.infoEl.remove()
		context_field.controlEl.className += " anki-center"
	}

	setup_alias_field(note_type: string, cell: HTMLTableCellElement, plugin: any) {
		let alias_fields_section: Record<string, string> = plugin.settings.ALIAS_FIELDS
		let alias_field = new Setting(cell)
			.addDropdown(
				async dropdown => {
					const field_names = plugin.fields_dict[note_type]
					dropdown.addOption("", "None")
					for (let field of field_names) {
						dropdown.addOption(field, field)
					}
					dropdown.setValue(
						alias_fields_section.hasOwnProperty(note_type) ? alias_fields_section[note_type] : field_names[0]
					)
					dropdown.onChange((value) => {
						plugin.settings.ALIAS_FIELDS[note_type] = value
						plugin.saveAllData()
					})
				}
			)
		alias_field.settingEl = cell
		alias_field.infoEl.remove()
		alias_field.controlEl.className += " anki-center"
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

								new Notice('Generating fields dictionary...')
								try {
									plugin.fields_dict = await plugin.generateFieldsDict()
									plugin.validateSelectedFields() // Fix invalid selections
									new Notice("Fields dictionary successfully generated!")
								}
								catch (e) {
									new Notice("Couldn't connect to Anki! Check console for error message.")
									return
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
