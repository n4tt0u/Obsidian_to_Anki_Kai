/**
 * Per-block Required Tags matching for Custom Regexps.
 *
 * Extracted into its own module (with no `obsidian` import) so it is unit-
 * testable in plain Node via ts-node, the way tests/regex/*.test.js already
 * exercises src/constants.ts. file.ts imports and calls this from inside the
 * regex search loop.
 */

/**
 * Minimal structural view of the CachedMetadata fields this module reads.
 * Kept loose on purpose — the real TagCache / CachedMetadata from `obsidian`
 * satisfy it via structural typing, while tests can pass a tiny stub.
 */
interface RequiredTagPosition {
    start: { offset: number }
    end: { offset: number }
}

interface RequiredTagCacheEntry {
    tag: string
    position?: RequiredTagPosition
}

export interface RequiredTagsFileCache {
    tags?: RequiredTagCacheEntry[]
    frontmatter?: { tags?: unknown }
}

function parseRequiredTags(tagsStr: string): string[] {
    if (!tagsStr) return []
    return tagsStr
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
}

function frontmatterTagList(fmTags: unknown): string[] {
    if (Array.isArray(fmTags)) return fmTags.map(t => String(t))
    if (typeof fmTags === 'string') {
        return fmTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
    }
    return []
}

/**
 * Check whether a regex-matched block (by character offset range) satisfies the
 * Required Tags constraint for its note type.
 *
 * Unlike the old per-file check, this only looks at tags that actually fall
 * *inside* the matched block, so a single file can mix notes that target
 * different note types (e.g. #card/basic vs #card/reversed). See issue #10.
 *
 * - An empty `requiredTagsStr` means "no constraint" (always true).
 * - Frontmatter tags apply file-wide (any block matches if present).
 * - Inline tags (#tag) are matched by overlapping position within
 *   [matchStart, matchEnd).
 * - Explicit "Tags: ..." lines (the plugin's own note syntax) are intentionally
 *   NOT considered here — they are not exposed by Obsidian's metadata cache.
 *   Inline #tags are, and the plugin mirrors them into the Tags: line on write
 *   anyway, so this covers the practical use cases.
 */
export function blockHasRequiredTag(
    matchStart: number,
    matchEnd: number,
    fileCache: RequiredTagsFileCache | undefined | null,
    requiredTagsStr: string
): boolean {
    if (!requiredTagsStr || requiredTagsStr.trim().length === 0) return true

    const required = parseRequiredTags(requiredTagsStr)
    if (required.length === 0) return true

    // Frontmatter tags apply file-wide.
    const fmTags = fileCache?.frontmatter?.tags
    if (fmTags !== undefined && fmTags !== null) {
        if (frontmatterTagList(fmTags).some(tag => required.includes(tag))) return true
    }

    // Inline tags whose position overlaps the matched block.
    const inlineTags = fileCache?.tags
    if (inlineTags) {
        for (const tc of inlineTags) {
            if (!tc.position) continue
            const tagStart = tc.position.start.offset
            const tagEnd = tc.position.end.offset
            if (tagStart < matchEnd && tagEnd > matchStart) {
                const tagName = tc.tag.replace(/^#/, '')
                if (required.includes(tagName)) return true
            }
        }
    }

    return false
}
