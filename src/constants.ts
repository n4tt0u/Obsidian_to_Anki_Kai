import { basename } from 'path'

export const ANKI_ICON: string = `<path fill="currentColor" stroke="currentColor" d="M 27.00,3.53 C 18.43,6.28 16.05,10.38 16.00,19.00 16.00,19.00 16.00,80.00 16.00,80.00 16.00,82.44 15.87,85.73 16.74,88.00 20.66,98.22 32.23,97.00 41.00,97.00 41.00,97.00 69.00,97.00 69.00,97.00 76.63,96.99 82.81,95.84 86.35,88.00 88.64,82.94 88.00,72.79 88.00,67.00 88.00,67.00 88.00,24.00 88.00,24.00 87.99,16.51 87.72,10.42 80.98,5.65 76.04,2.15 69.73,3.00 64.00,3.00 64.00,3.00 27.00,3.53 27.00,3.53 Z M 68.89,15.71 C 74.04,15.96 71.96,19.20 74.01,22.68 74.01,22.68 76.72,25.74 76.72,25.74 80.91,30.85 74.53,31.03 71.92,34.29 70.70,35.81 70.05,38.73 67.81,39.09 65.64,39.43 63.83,37.03 61.83,36.00 59.14,34.63 56.30,35.24 55.08,33.40 53.56,31.11 56.11,28.55 56.20,25.00 56.24,23.28 55.32,20.97 56.20,19.35 57.67,16.66 60.89,18.51 64.00,17.71 64.00,17.71 68.89,15.71 68.89,15.71 Z M 43.06,43.86 C 49.81,45.71 48.65,51.49 53.21,53.94 56.13,55.51 59.53,53.51 62.94,54.44 64.83,54.96 66.30,56.05 66.54,58.11 67.10,62.74 60.87,66.31 60.69,71.00 60.57,74.03 64.97,81.26 61.40,83.96 57.63,86.82 51.36,80.81 47.00,82.22 43.96,83.20 40.23,88.11 36.11,87.55 29.79,86.71 33.95,77.99 32.40,74.18 30.78,70.20 24.67,68.95 23.17,64.97 22.34,62.79 23.39,61.30 25.15,60.09 28.29,57.92 32.74,58.49 35.44,55.57 39.11,51.60 36.60,45.74 43.06,43.86 Z" />`

// These regexes follow Obsidian's actual rendering rules. The previous [\s\S]*?
// bodies crossed newlines, so stray '$' signs in different cards paired up into one
// giant math/code span; that span was fed to ignore_spans and search() silently
// skipped every RegexNote inside it (cards vanished from sync). Inline elements are
// now single-line, and currency-style tokens ($200k, $5-$10, ...) are treated as
// text. (Discovered & fixed by 999cleo.)

// Inline math: $body$ (single line; no digit/letter adjacent to the delimiters;
// whitespace must not touch them).
export const OBS_INLINE_MATH_REGEXP: RegExp = /(?<![\d\w\$])\$(?=\S)([^\n$]+?)(?<=\S)\$(?![\d\w])/g

// Display math: $$...$$ (may span lines, but not across a blank-line paragraph break).
export const OBS_DISPLAY_MATH_REGEXP: RegExp = /\$\$(?:(?!\n\s*\n)[\s\S])*?\$\$/g

// Inline code: `...` (single line only; Obsidian's inline code cannot wrap).
export const OBS_CODE_REGEXP: RegExp = /(?<!`)`(?=[^`])[^\n`]*?`/g

// Display code: ```...``` (fenced; multi-line is correct).
export const OBS_DISPLAY_CODE_REGEXP: RegExp = /```[\s\S]*?```/g

export const CODE_CSS_URL = `https://cdn.jsdelivr.net/npm/highlightjs-themes@1.0.0/arta.css`

export function escapeRegex(str: string): string {
    // Got from stackoverflow - https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Normalise an Obsidian embed/link target to its literal on-disk filename.
// Obsidian writes two embed shapes depending on the "Use [[Wikilinks]]" setting and
// how the embed was inserted:
//   - Wikilink:  ![[Pasted image 1.png]]    -> link = "Pasted image 1.png" (literal spaces)
//   - Markdown:  ![](Pasted%20image%201.png) -> link = "Pasted%20image%201.png" (percent-encoded)
// Passing the percent-encoded form through unchanged stores the media under a name
// with a literal "%20", while Anki's media server decodes the <img src> back to a
// space on resolve — the reference no longer matches and the image renders broken.
// Decoding here makes the file-lookup name, the stored name, and the reference all
// agree. Decoding a string without percent-escapes is a no-op (wikilink embeds are
// unaffected). A genuine "%" in a filename would throw, so we fall back to the
// original string rather than break the sync. (Discovered & fixed by 999cleo.)
export function decodeMediaLink(link: string): string {
    try {
        return decodeURIComponent(link)
    } catch (_) {
        return link
    }
}

// Return the exact filename Anki stores a media file under, for the given embed/link
// target. Recent Anki normalises media filenames on store: it strips the directory
// and (observed on Linux desktop) lowercases the whole basename, so "Pasted image
// 1.png" is stored as "pasted image 1.png". On a case-sensitive filesystem
// <img src="Pasted image 1.png"> no longer resolves and the image renders broken.
// Lowercasing both the stored name and the <img src>/[sound:] reference ourselves
// makes them agree deterministically on every Anki version. decodeMediaLink is
// applied first so percent-encoded embeds are handled too. (Discovered & fixed by
// 999cleo.)
export function ankiMediaName(link: string): string {
    return basename(decodeMediaLink(link)).toLowerCase()
}
