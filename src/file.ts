/*Performing plugin operations on markdown file contents*/

import { FROZEN_FIELDS_DICT } from './interfaces/field-interface'
import { AnkiConnectNote, AnkiConnectNoteAndID } from './interfaces/note-interface'
import { FileData } from './interfaces/settings-interface'
import { Note, InlineNote, RegexNote, CLOZE_ERROR, NOTE_TYPE_ERROR, TAG_SEP, ID_REGEXP_STR, TAG_REGEXP_STR } from './note'
import { basename, extname } from 'path';
import { Md5 } from 'ts-md5/dist/md5';
import * as AnkiConnect from './anki'
import * as c from './constants'
import { FormatConverter } from './format'
import { CachedMetadata, HeadingCache } from 'obsidian'
import { blockHasRequiredTag } from './required-tags'

const double_regexp: RegExp = /(?:\r\n|\r|\n)((?:\r\n|\r|\n)(?:<!--)?ID: \d+)/g

function id_to_str(identifier: number, inline: boolean = false, comment: boolean = false): string {
    let result = "ID: " + identifier.toString()
    if (comment) {
        result = "<!--" + result + "-->"
    }
    if (inline) {
        result += " "
    } else {
        result += "\n"
    }
    return result
}

function apply_edits(text: string, edits: Array<{ start: number, end: number, text: string }>): string {
    /*Apply edits to text in reverse order to maintain indices.*/
    let sorted_edits = edits.sort((a, b) => b.start - a.start)
    for (let edit of sorted_edits) {
        text = text.slice(0, edit.start) + edit.text + text.slice(edit.end)
    }
    return text
}

function spans(pattern: RegExp, text: string): Array<[number, number]> {
    /*Return a list of span-tuples for matches of pattern in text.*/
    let output: Array<[number, number]> = []
    let matches = text.matchAll(pattern)
    for (let match of matches) {
        output.push(
            [match.index, match.index + match[0].length]
        )
    }
    return output
}

function contained_in(span: [number, number], spans: Array<[number, number]>): boolean {
    /*Return whether span is contained in spans (+- 1 leeway)*/
    return spans.some(
        (element) => span[0] >= element[0] - 1 && span[1] <= element[1] + 1
    )
}

function* findignore(pattern: RegExp, text: string, ignore_spans: Array<[number, number]>): IterableIterator<RegExpMatchArray> {
    let matches = text.matchAll(pattern)
    for (let match of matches) {
        if (!(contained_in([match.index, match.index + match[0].length], ignore_spans))) {
            yield match
        }
    }
}

function normalizeObsidianFrontmatterTagToAnki(tag: string, format: boolean): string {
    if (format) {
        return tag.trim().replace(/\//g, '::')
    }
    return tag.trim()
}

abstract class AbstractFile {
    file: string
    path: string
    url: string
    original_file: string
    data: FileData
    file_cache: CachedMetadata

    frozen_fields_dict: FROZEN_FIELDS_DICT
    target_deck: string
    global_tags: string

    notes_to_add: AnkiConnectNote[]
    id_indexes: number[]
    notes_to_edit: AnkiConnectNoteAndID[]
    notes_to_delete: number[]
    all_notes_to_add: AnkiConnectNote[]

    note_ids: Array<number | null>
    card_ids: number[]
    tags: string[]
    aliases: string[]

    formatter: FormatConverter

    constructor(file_contents: string, path: string, url: string, data: FileData, file_cache: CachedMetadata) {
        this.data = data
        this.file = file_contents
        this.path = path
        this.url = url
        this.original_file = this.file
        this.file_cache = file_cache
        this.formatter = new FormatConverter(file_cache, this.data.vault_name)
        this.target_deck = data.template.deckName
        this.global_tags = data.template.tags.join(TAG_SEP)
    }

    getShouldAddContext(note_type: string): boolean {
        if (this.data.add_context) {
            const contextField = this.data.context_fields[note_type];
            return (contextField !== "" && contextField !== undefined);
        }
        return false;
    }

    setup_frozen_fields_dict() {
        let frozen_fields_dict: FROZEN_FIELDS_DICT = {}
        for (let note_type in this.data.fields_dict) {
            let fields: string[] = this.data.fields_dict[note_type]
            let temp_dict: Record<string, string> = {}
            for (let field of fields) {
                temp_dict[field] = ""
            }
            frozen_fields_dict[note_type] = temp_dict
        }
        for (let match of this.file.matchAll(this.data.FROZEN_REGEXP)) {
            const [note_type, fields]: [string, string] = [match[1], match[2]]
            const virtual_note = note_type + "\n" + fields
            const parsed_fields: Record<string, string> = new Note(
                virtual_note,
                this.data.fields_dict,
                this.data.curly_cloze,
                this.data.highlights_to_cloze,
                this.formatter,
                this.data.cloze_keyword
            ).getFields()
            frozen_fields_dict[note_type] = parsed_fields
        }
        this.frozen_fields_dict = frozen_fields_dict
    }

    setup_target_deck() {
        const result = this.file.match(this.data.DECK_REGEXP)
        this.target_deck = result ? result[1] : this.data.template["deckName"]
    }

    setup_global_tags() {
        const result = this.file.match(this.data.TAG_REGEXP)
        this.global_tags = result ? result[1] : ""

        if (this.data.yaml_tags && this.file_cache.frontmatter && this.file_cache.frontmatter.tags) {
            let tags = this.file_cache.frontmatter.tags;
            let tags_str = "";
            if (Array.isArray(tags)) {
                tags_str = tags
                    .map((tag) => normalizeObsidianFrontmatterTagToAnki(String(tag), this.data.use_anki_hierarchy))
                    .join(" ");
            } else if (typeof tags === 'string') {
                tags_str = tags
                    .split(',')
                    .map((tag) => normalizeObsidianFrontmatterTagToAnki(tag, this.data.use_anki_hierarchy))
                    .filter((tag) => tag.length > 0)
                    .join(" ");
            }

            if (tags_str) {
                if (this.global_tags) {
                    this.global_tags += " " + tags_str;
                } else {
                    this.global_tags = tags_str;
                }
            }
        }
    }

    setup_aliases() {
        this.aliases = []
        if (this.file_cache.frontmatter && this.file_cache.frontmatter.aliases) {
            let aliases = this.file_cache.frontmatter.aliases
            if (Array.isArray(aliases)) {
                this.aliases = aliases
            } else if (typeof aliases === 'string') {
                this.aliases = [aliases]
            }
        }
    }

    getHash(): string {
        return Md5.hashStr(this.file) as string
    }

    abstract scanFile(): void

    scanDeletions() {
        for (let match of this.file.matchAll(this.data.EMPTY_REGEXP)) {
            this.notes_to_delete.push(parseInt(match[1]))
        }
    }

    getContextAtIndex(position: number): string {
        let result: string = this.path
        let currentContext: HeadingCache[] = []
        if (!(this.file_cache.hasOwnProperty('headings'))) {
            return result
        }
        for (let currentHeading of this.file_cache.headings) {
            if (position < currentHeading.position.start.offset) {
                //We've gone past position now with headings, so let's return!
                break
            }
            let insert_index: number = 0
            for (let contextHeading of currentContext) {
                if (currentHeading.level > contextHeading.level) {
                    insert_index += 1
                    continue
                }
                break
            }
            currentContext = currentContext.slice(0, insert_index)
            currentContext.push(currentHeading)
        }
        let heading_strs: string[] = []
        for (let contextHeading of currentContext) {
            heading_strs.push(contextHeading.heading)
        }
        let result_arr: string[] = [result]
        result_arr.push(...heading_strs)
        return result_arr.join(" > ")
    }

    abstract writeIDs(): void

    removeEmpties() {
        this.file = this.file.replace(this.data.EMPTY_REGEXP, "")
    }

    getCreateDecks(): AnkiConnect.AnkiConnectRequest {
        let actions: AnkiConnect.AnkiConnectRequest[] = []
        for (let note of this.all_notes_to_add) {
            actions.push(AnkiConnect.createDeck(note.deckName))
        }
        return AnkiConnect.multi(actions)
    }

    getAddNotes(): AnkiConnect.AnkiConnectRequest {
        let actions: AnkiConnect.AnkiConnectRequest[] = []
        for (let note of this.all_notes_to_add) {
            actions.push(AnkiConnect.addNote(note))
        }
        return AnkiConnect.multi(actions)
    }

    getDeleteNotes(): AnkiConnect.AnkiConnectRequest {
        return AnkiConnect.deleteNotes(this.notes_to_delete)
    }

    getUpdateFields(): AnkiConnect.AnkiConnectRequest {
        let actions: AnkiConnect.AnkiConnectRequest[] = []
        for (let parsed of this.notes_to_edit) {
            actions.push(
                AnkiConnect.updateNoteFields(
                    parsed.identifier, parsed.note.fields
                )
            )
        }
        return AnkiConnect.multi(actions)
    }

    getNoteInfo(): AnkiConnect.AnkiConnectRequest {
        let IDs: number[] = []
        for (let parsed of this.notes_to_edit) {
            IDs.push(parsed.identifier)
        }
        return AnkiConnect.notesInfo(IDs)
    }

    getChangeDecks(): AnkiConnect.AnkiConnectRequest {
        return AnkiConnect.changeDeck(this.card_ids, this.target_deck)
    }

    getClearTags(): AnkiConnect.AnkiConnectRequest {
        let actions: AnkiConnect.AnkiConnectRequest[] = []
        for (let parsed of this.notes_to_edit) {
            // Calculate tags to remove: current_tags - (new_tags + global_tags)
            // But parsed.note.tags already includes global_tags (see Note.parse)
            if (parsed.current_tags && parsed.current_tags.length) {
                const desiredTags = new Set(parsed.note.tags)
                const tagsToRemove = parsed.current_tags.filter(tag => !desiredTags.has(tag))

                if (tagsToRemove.length > 0) {
                    actions.push(AnkiConnect.removeTags([parsed.identifier], tagsToRemove.join(" ")))
                }
            } else {
                // Fallback if current_tags unknown (should not happen with new logic, but safe fallback?)
                // If we don't know current tags, we can't safely remove only specific ones without risking leaving garbage.
                // But sticking to old behavior (remove all 'possible' tags) is bad.
                // If current_tags is missing, it implies notesInfo failed or logic error.
                // We will skip removal to be safe, or we could blindly remove "tags that might be there"?
                // Let's assume current_tags is populated. If not, we do nothing for removal.
            }
        }
        return AnkiConnect.multi(actions)
    }

    getAddTags(): AnkiConnect.AnkiConnectRequest {
        let actions: AnkiConnect.AnkiConnectRequest[] = []
        for (let parsed of this.notes_to_edit) {
            // Calculate tags to add: desired_tags - current_tags
            const desiredTags = new Set(parsed.note.tags)
            let tagsToAdd: string[] = []

            if (parsed.current_tags) {
                const currentTags = new Set(parsed.current_tags)
                tagsToAdd = parsed.note.tags.filter(tag => !currentTags.has(tag))
            } else {
                tagsToAdd = parsed.note.tags
            }

            if (tagsToAdd.length > 0) {
                actions.push(
                    AnkiConnect.addTags([parsed.identifier], tagsToAdd.join(" "))
                )
            }
        }
        return AnkiConnect.multi(actions)
    }

}

export class AllFile extends AbstractFile {
    ignore_spans: [number, number][]
    custom_regexps: Record<string, string>
    inline_notes_to_add: AnkiConnectNote[]
    inline_id_indexes: number[]
    regex_notes_to_add: AnkiConnectNote[]
    regex_id_indexes: number[]

    useFrontmatterID: boolean = false
    frontmatterID: number | null = null
    existingIDSpans: [number, number][] = []
    notesToWriteInline: { position: number, id: number }[] = [] // For fallback: had valid ID (YAML) but needs inline

    constructor(file_contents: string, path: string, url: string, data: FileData, file_cache: CachedMetadata) {
        super(file_contents, path, url, data, file_cache)
        this.custom_regexps = data.custom_regexps
    }

    add_spans_to_ignore() {
        this.ignore_spans = []
        this.ignore_spans.push(...spans(this.data.FROZEN_REGEXP, this.file))
        const deck_result = this.file.match(this.data.DECK_REGEXP)
        if (deck_result) {
            this.ignore_spans.push([deck_result.index, deck_result.index + deck_result[0].length])
        }
        const tag_result = this.file.match(this.data.TAG_REGEXP)
        if (tag_result) {
            this.ignore_spans.push([tag_result.index, tag_result.index + tag_result[0].length])
        }
        this.ignore_spans.push(...spans(this.data.NOTE_REGEXP, this.file))
        this.ignore_spans.push(...spans(this.data.INLINE_REGEXP, this.file))
        this.ignore_spans.push(...spans(c.OBS_INLINE_MATH_REGEXP, this.file))
        this.ignore_spans.push(...spans(c.OBS_DISPLAY_MATH_REGEXP, this.file))
        this.ignore_spans.push(...spans(c.OBS_CODE_REGEXP, this.file))
        this.ignore_spans.push(...spans(c.OBS_DISPLAY_CODE_REGEXP, this.file))
    }

    setupScan() {
        this.setup_frozen_fields_dict()
        this.setup_target_deck()
        this.setup_global_tags()
        this.setup_aliases()
        this.add_spans_to_ignore()
        this.existingIDSpans = []
        this.notesToWriteInline = []

        // Determine if we should use Frontmatter ID
        const noteMatches = Array.from(this.file.matchAll(this.data.NOTE_REGEXP)).length
        const inlineMatches = Array.from(this.file.matchAll(this.data.INLINE_REGEXP)).length
        let regexMatches = 0
        for (let note_type in this.custom_regexps) {
            if (this.custom_regexps[note_type]) {
                const regexp_str = this.custom_regexps[note_type]
            }
        }

        // Simplified approach: Check settings first
        if (this.data.saveIDToFrontmatter) {
            // We can obtain the ID from frontmatter if available
            if (this.file_cache.frontmatter && this.file_cache.frontmatter.nid) {
                this.frontmatterID = parseInt(this.file_cache.frontmatter.nid);
            }
        }

        this.notes_to_add = []
        this.inline_notes_to_add = []
        this.regex_notes_to_add = []
        this.id_indexes = []
        this.inline_id_indexes = []
        this.regex_id_indexes = []
        this.notes_to_edit = []
        this.notes_to_delete = []
    }

    scanNotes() {
        for (let note_match of this.file.matchAll(this.data.NOTE_REGEXP)) {
            let [note, position]: [string, number] = [note_match[1], note_match.index + note_match[0].indexOf(note_match[1]) + note_match[1].length]
            // That second thing essentially gets the index of the end of the first capture group.
            let note_obj = new Note(
                note,
                this.data.fields_dict,
                this.data.curly_cloze,
                this.data.highlights_to_cloze,
                this.formatter,
                this.data.cloze_keyword
            )
            let context = this.getShouldAddContext(note_obj.note_type) ? this.getContextAtIndex(note_match.index) : ""
            let parsed = note_obj.parse(
                this.target_deck,
                this.url,
                this.frozen_fields_dict,
                this.data,
                context,
                this.aliases,
                basename(this.path, extname(this.path))
            )
            if (parsed.identifier == null) {
                // Need to make sure global_tags get added
                parsed.note.tags.push(...this.global_tags.split(TAG_SEP))
                this.notes_to_add.push(parsed.note)
                this.id_indexes.push(position)
            } else {
                // Determine ID span
                // Note: The Note class logic extracts ID from the last line(s).
                // We re-detect it here to find the span in the file.
                // It is expected to be at the end of 'note' string.
                const idMatch = note.match(new RegExp(ID_REGEXP_STR + "$")); // Anchor to end?
                // ID_REGEXP_STR is `\n?(?:<!--)?(?:ID: (\d+).*)`
                if (idMatch) {
                    const matchIndex = note.lastIndexOf(idMatch[0]);
                    if (matchIndex !== -1) {
                        this.existingIDSpans.push([
                            note_match.index + matchIndex,
                            note_match.index + matchIndex + idMatch[0].length
                        ]);
                    }
                }

                if (!this.data.EXISTING_IDS.includes(parsed.identifier)) {
                    if (parsed.identifier == CLOZE_ERROR) {
                        continue
                    }
                    // Need to show an error otherwise
                    else if (parsed.identifier == NOTE_TYPE_ERROR) {
                        console.warn("Did not recognise note type ", parsed.note.modelName, " in file ", this.path)
                    } else {
                        console.warn("Note with id", parsed.identifier, " in file ", this.path, " does not exist in Anki!")
                    }
                } else {
                    this.notes_to_edit.push(parsed)
                }
            }
        }
    }

    scanInlineNotes() {
        for (let note_match of this.file.matchAll(this.data.INLINE_REGEXP)) {
            let [note, position]: [string, number] = [note_match[1], note_match.index + note_match[0].indexOf(note_match[1]) + note_match[1].length]
            // That second thing essentially gets the index of the end of the first capture group.
            let note_obj = new InlineNote(
                note,
                this.data.fields_dict,
                this.data.curly_cloze,
                this.data.highlights_to_cloze,
                this.formatter,
                this.data.cloze_keyword
            )
            let context = this.getShouldAddContext(note_obj.note_type) ? this.getContextAtIndex(note_match.index) : ""
            let parsed = note_obj.parse(
                this.target_deck,
                this.url,
                this.frozen_fields_dict,
                this.data,
                context,
                this.aliases,
                basename(this.path, extname(this.path))
            )
            if (parsed.identifier == null) {
                // Need to make sure global_tags get added
                parsed.note.tags.push(...this.global_tags.split(TAG_SEP))
                this.inline_notes_to_add.push(parsed.note)
                this.inline_id_indexes.push(position)
            } else {
                // Capture ID span for inline notes
                // InlineNote.ID_REGEXP is `(?:<!--)?ID: (\d+)`
                const idMatch = note.match(InlineNote.ID_REGEXP)
                if (idMatch) {
                    // Start of note + index of match
                    this.existingIDSpans.push([
                        note_match.index + idMatch.index,
                        note_match.index + idMatch.index + idMatch[0].length
                    ])
                }

                if (!this.data.EXISTING_IDS.includes(parsed.identifier)) {
                    // Need to show an error
                    if (parsed.identifier == CLOZE_ERROR) {
                        continue
                    }
                    console.warn("Note with id", parsed.identifier, " in file ", this.path, " does not exist in Anki!")
                } else {
                    this.notes_to_edit.push(parsed)
                }
            }
        }
    }

    search(note_type: string, regexp_str: string) {
        //Search the file for regex matches
        //ignoring matches inside ignore_spans,
        //and adding any matches to ignore_spans.
        for (let search_id of [true, false]) {
            for (let search_tags of [true, false]) {
                let id_str = search_id ? ID_REGEXP_STR : ""
                let tag_str = search_tags ? TAG_REGEXP_STR : ""
                let regexp: RegExp = new RegExp(regexp_str + tag_str + id_str, 'gm')
                for (let match of findignore(regexp, this.file, this.ignore_spans)) {
                    // Per-block Required Tags check: skip a match that doesn't carry
                    // the required tag WITHOUT claiming it in ignore_spans, so that a
                    // later note type can still pick it up (fixes #10).
                    if (this.data.regex_required_tags) {
                        const reqTags = this.data.regexp_tags?.[note_type] ?? "";
                        if (!blockHasRequiredTag(
                            match.index,
                            match.index + match[0].length,
                            this.file_cache,
                            reqTags
                        )) {
                            continue;
                        }
                    }
                    this.ignore_spans.push([match.index, match.index + match[0].length])
                    let note_obj = new RegexNote(
                        match, note_type, this.data.fields_dict,
                        search_tags, search_id, this.data.curly_cloze, this.data.highlights_to_cloze, this.formatter, this.data.cloze_keyword
                    )
                    let context = this.getShouldAddContext(note_type) ? this.getContextAtIndex(match.index) : ""
                    const parsed: AnkiConnectNoteAndID = note_obj.parse(
                        this.target_deck,
                        this.url,
                        this.frozen_fields_dict,
                        this.data,
                        context,
                        this.aliases,
                        basename(this.path, extname(this.path))
                    )
                    if (search_id) {
                        if (!(this.data.EXISTING_IDS.includes(parsed.identifier))) {
                            if (parsed.identifier == CLOZE_ERROR) {
                                // This means it wasn't actually a note! So we should remove it from ignore_spans
                                this.ignore_spans.pop()
                                continue
                            }
                            console.warn("Note with id", parsed.identifier, " in file ", this.path, " does not exist in Anki!")
                        } else {
                            this.notes_to_edit.push(parsed)
                        }
                    } else {
                        if (parsed.identifier == CLOZE_ERROR) {
                            // This means it wasn't actually a note! So we should remove it from ignore_spans
                            this.ignore_spans.pop()
                            continue
                        }
                        parsed.note.tags.push(...this.global_tags.split(TAG_SEP))
                        this.regex_notes_to_add.push(parsed.note)
                        this.regex_id_indexes.push(match.index + match[0].length)
                    }
                    // For Regex Notes, if we found an ID, it is part of the match?
                    // RegexNote constructor takes `match`. `pop()` is used if `search_id` is true.
                    // The match array contains full match at [0].
                    // If search_id is true, the regex included ID_REGEXP_STR at the end.
                    if (search_id && parsed.identifier) {
                        // The ID part is at the end of the match.
                        const matchStr = match[0]
                        const idMatch = matchStr.match(new RegExp(ID_REGEXP_STR + "$"));
                        if (idMatch) {
                            const matchIndex = matchStr.lastIndexOf(idMatch[0]);
                            if (matchIndex !== -1) {
                                this.existingIDSpans.push([
                                    match.index + matchIndex,
                                    match.index + matchIndex + idMatch[0].length
                                ]);
                            }
                        }
                    }
                }
            }
        }
    }

    scanFile() {
        this.setupScan()
        this.scanNotes()
        this.scanInlineNotes()

        const noteTypes = Object.keys(this.custom_regexps);
        // Sort note types: prioritizes those with required tags ONLY if enabled
        if (this.data.regex_required_tags) {
            noteTypes.sort((a, b) => {
                const tagsA = this.data.regexp_tags && this.data.regexp_tags[a] ? this.data.regexp_tags[a].trim() : "";
                const tagsB = this.data.regexp_tags && this.data.regexp_tags[b] ? this.data.regexp_tags[b].trim() : "";

                // If both have tags or both don't, maintain execution order (stable sort not strictly guaranteed but acceptable here)
                // Ideally specific should beat generic. 
                // Has tags (-1) comes before No tags (1)
                if (tagsA && !tagsB) return -1;
                if (!tagsA && tagsB) return 1;
                return 0;
            });
        }

        for (let note_type of noteTypes) {
            const regexp_str: string = this.custom_regexps[note_type]
            if (regexp_str) {
                // Required Tags are now checked per-block inside search().
                this.search(note_type, regexp_str)
            }
        }
        this.scanDeletions()
        this.postProcessFrontmatterID()
        this.all_notes_to_add = this.notes_to_add.concat(this.inline_notes_to_add).concat(this.regex_notes_to_add)
    }

    postProcessFrontmatterID() {
        const totalNotes = this.notes_to_add.length + this.inline_notes_to_add.length + this.regex_notes_to_add.length + this.notes_to_edit.length;

        // If strictly one note AND settings enabled, use Frontmatter ID
        if (this.data.saveIDToFrontmatter && totalNotes === 1) {
            this.useFrontmatterID = true;

            if (this.frontmatterID) {
                // Case 1: Frontmatter ID exists.
                // Check where the single note is.
                if (this.notes_to_add.length === 1) {
                    // Note was considered "new" (no inline ID).
                    // If Frontmatter ID is valid in Anki, move to notes_to_edit.
                    if (this.data.EXISTING_IDS.includes(this.frontmatterID)) {
                        const note = this.notes_to_add.pop();
                        // Remove its write-index logic?
                        this.id_indexes.pop();

                        this.notes_to_edit.push({ note: note, identifier: this.frontmatterID });
                    }
                    // If not valid, it stays in notes_to_add, but writeIDs will write to frontmatter because useFrontmatterID=true.
                } else if (this.inline_notes_to_add.length === 1 || this.regex_notes_to_add.length === 1) {
                    // Same logic for other types (unlikely for "Main" note but possible)
                    if (this.inline_notes_to_add.length) {
                        if (this.data.EXISTING_IDS.includes(this.frontmatterID)) {
                            const note = this.inline_notes_to_add.pop();
                            this.inline_id_indexes.pop();
                            this.notes_to_edit.push({ note: note, identifier: this.frontmatterID });
                        }
                    } else {
                        if (this.data.EXISTING_IDS.includes(this.frontmatterID)) {
                            const note = this.regex_notes_to_add.pop();
                            this.regex_id_indexes.pop();
                            this.notes_to_edit.push({ note: note, identifier: this.frontmatterID });
                        }
                    }
                } else if (this.notes_to_edit.length === 1) {
                    // Note had an inline ID.
                    // Prefer Frontmatter ID over Inline ID?
                    // We should use Frontmatter ID.
                    const parsed = this.notes_to_edit[0];
                    if (parsed.identifier !== this.frontmatterID) {
                        // IDs differ. 
                        // If Frontmatter ID is valid, we assume that's the correct one.
                        // But maybe inconsistent state?
                        // Let's adopt Frontmatter ID.
                        if (this.data.EXISTING_IDS.includes(this.frontmatterID)) {
                            parsed.identifier = this.frontmatterID;
                        }
                    }
                    // Since useFrontmatterID is true, writeIDs will remove the inline ID (via existingIDSpans) and ensure ID is in Frontmatter.
                }
            } else {
                // Case 2: No Frontmatter ID.
                // If note has inline ID (notes_to_edit), we keep it, but writeIDs will move it to frontmatter.
                // If note has no ID (notes_to_add), logic works as is -> writeIDs will write new ID to frontmatter.
            }
        } else {
            this.useFrontmatterID = false;

            // Critical Fallback: If we had a Frontmatter ID (nid) but now have multiple notes (or setting OFF).
            if (this.frontmatterID && this.data.EXISTING_IDS.includes(this.frontmatterID)) {
                // We need to restore this ID to the "Main" note as an inline ID.
                // The "Main" note should be in notes_to_add (because it had no inline ID).
                if (this.notes_to_add.length > 0) {
                    // We assume the first note in notes_to_add is the one that owns the Frontmatter ID.
                    // (Heuristic: Standard notes are usually the main content).
                    const note = this.notes_to_add.shift(); // Remove from add
                    const position = this.id_indexes.shift(); // Remove position

                    if (note && position !== undefined) {
                        // Move to edit
                        this.notes_to_edit.push({ note: note, identifier: this.frontmatterID });
                        // Schedule inline write
                        this.notesToWriteInline.push({ position: position, id: this.frontmatterID });
                    }
                }
            }
        }
    }

    fix_newline_ids() {
        this.file = this.file.replace(double_regexp, "$1")
    }

    writeIDs() {
        let edits: { start: number, end: number, text: string }[] = []

        // Helper to determine target ID for Frontmatter
        const getTargetID = (): number | null => {
            if (this.notes_to_edit.length > 0) return this.notes_to_edit[0].identifier;
            if (this.note_ids.length > 0) return this.note_ids[0];
            // If fallback inline write logic puts note in note_ids, it works.
            return null;
        }

        if (this.useFrontmatterID) {
            // 1. Remove Existing Inline IDs
            for (let span of this.existingIDSpans) {
                edits.push({ start: span[0], end: span[1], text: "" });
            }

            // 2. Write/Update Frontmatter ID
            const targetID = getTargetID();
            if (targetID) {
                const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
                const match = this.file.match(frontmatterRegex);
                if (match) {
                    let frontmatter = match[1];
                    let newFrontmatter = frontmatter;
                    // Match key "nid:" followed by anything (or nothing) until newline
                    const nidRegex = /^nid:.*$/m;
                    if (nidRegex.test(frontmatter)) {
                        newFrontmatter = frontmatter.replace(nidRegex, `nid: ${targetID}`);
                    } else {
                        newFrontmatter = frontmatter + `\nnid: ${targetID}`;
                    }
                    edits.push({ start: 0, end: match[0].length, text: `---\n${newFrontmatter.trim()}\n---` });
                } else {
                    // No frontmatter, create it
                    edits.push({ start: 0, end: 0, text: `---\nnid: ${targetID}\n---\n` });
                }
            }
        } else {
            // Fallback: Remove nid from Frontmatter if exists
            if (this.frontmatterID) {
                const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
                const match = this.file.match(frontmatterRegex);
                if (match) {
                    let frontmatter = match[1];
                    const nidRegex = /^nid:.*\n?/m;
                    if (nidRegex.test(frontmatter)) {
                        let newFrontmatter = frontmatter;
                        if (/nid:[^\n]*$/.test(frontmatter.trim())) {
                            // Last property: Remove entirely
                            // Removes newline before if exists, and the line itself
                            newFrontmatter = frontmatter.replace(/(\n\s*)?nid:[^\n]*\s*$/, "");
                        } else {
                            // Not last: Clear value
                            // Use regex that excludes newline to prevent merging with next line
                            newFrontmatter = frontmatter.replace(/^nid:[^\n]*/m, "nid:");
                        }

                        // Assuming we keep the frontmatter even if empty?
                        edits.push({ start: 0, end: match[0].length, text: `---\n${newFrontmatter}\n---` });
                    }
                }
            }

            // Fallback Inline Writes (Restoring YAML ID to Inline)
            this.notesToWriteInline.forEach(item => {
                edits.push({ start: item.position, end: item.position, text: id_to_str(item.id, false, this.data.comment) });
            });

            // Standard Inline Writes
            this.id_indexes.forEach(
                (id_position: number, index: number) => {
                    const identifier: number | null = this.note_ids[index]
                    if (identifier) {
                        edits.push({ start: id_position, end: id_position, text: id_to_str(identifier, false, this.data.comment) })
                    }
                }
            )
            this.inline_id_indexes.forEach(
                (id_position: number, index: number) => {
                    const identifier: number | null = this.note_ids[index + this.notes_to_add.length] //Since regular then inline
                    if (identifier) {
                        edits.push({ start: id_position, end: id_position, text: id_to_str(identifier, true, this.data.comment) })
                    }
                }
            )
            this.regex_id_indexes.forEach(
                (id_position: number, index: number) => {
                    const identifier: number | null = this.note_ids[index + this.notes_to_add.length + this.inline_notes_to_add.length] // Since regular then inline then regex
                    if (identifier) {
                        edits.push({ start: id_position, end: id_position, text: "\n" + id_to_str(identifier, false, this.data.comment).trim() })
                    }
                }
            )
        }

        this.file = apply_edits(this.file, edits)

        // fix_newline_ids might be needed if inline writes created duplicates or bad spacing regarding existing newlines?
        // But with apply_edits and clean replacement, it should be fine.
        // Keeping it just in case for legacy inline stuff.
        if (!this.useFrontmatterID) {
            this.fix_newline_ids()
        }
    }
}
