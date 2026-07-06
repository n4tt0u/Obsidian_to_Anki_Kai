// Regression test for media filename case normalisation. Locks the fix for the
// silent broken-image bug where recent Anki LOWERCASES media filenames on store
// ("Pasted image 1.png" -> "pasted image 1.png") while the plugin wrote
// <img src="Pasted image 1.png"> (original case). On a case-sensitive filesystem
// (Linux/macOS) the reference no longer matched the stored file, so the image
// rendered broken even though the file was present.
//
// Run with:
//   node tests/regex/media-link-case.test.js
//
// Imports ankiMediaName + decodeMediaLink from src/constants.ts (via
// ts-node/register) so any source-side regression is caught.

require("ts-node/register");
const c = require("../../src/constants");
const { basename, extname } = require("path");

const decodeMediaLink = c.decodeMediaLink;
const ankiMediaName = c.ankiMediaName;
// --- end contract copy ---

let failed = 0;
function assert(cond, label) {
    if (cond) { console.log("  \u2713", label); }
    else { console.log("  \u2717", label); failed++; }
}

// Model the full pipeline: the name we store the file under, the name we put in
// <img src>, and the name Anki ends up with after ITS OWN lowercasing on store.
// The card renders iff the stored-as name equals the referenced name.
function pipeline(embedLink) {
    const stored_as = ankiMediaName(embedLink);        // we store under this
    const img_src   = ankiMediaName(embedLink);        // we reference this
    const anki_normalises = stored_as.toLowerCase();   // Anki lowercases on store
    return { stored_as, img_src, renders: img_src === anki_normalises };
}

console.log("== Capitalised name (the reported bug) renders ==");
{
    const r = pipeline("Pasted image 20260617151708.png");
    assert(r.stored_as === "pasted image 20260617151708.png", `stored lowercase (got "${r.stored_as}")`);
    assert(r.img_src === r.stored_as, "img src matches stored name");
    assert(r.renders, "image resolves and renders");
}

console.log("== Percent-encoded AND capitalised (markdown embed) renders ==");
{
    const r = pipeline("Pasted%20Image%201.png");
    assert(r.stored_as === "pasted image 1.png", `decoded + lowercased (got "${r.stored_as}")`);
    assert(!r.img_src.includes("%"), "no percent-escapes left");
    assert(r.renders, "renders");
}

console.log("== Mixed-case with subfolder renders ==");
{
    const r = pipeline("_media/My Diagram.PNG");
    assert(r.stored_as === "my diagram.png", `basename + lowercased (got "${r.stored_as}")`);
    assert(r.renders, "renders");
}

console.log("== Already-lowercase name is unchanged (no double-mangle) ==");
{
    const r = pipeline("already lowercase.png");
    assert(r.stored_as === "already lowercase.png", "unchanged");
    assert(r.renders, "renders");
}

console.log("== Unicode filename lowercases safely ==");
{
    // "CafÉ.png" -> decode no-op -> lowercase
    const r = pipeline("Caf\u00c9.png");
    assert(r.stored_as === "caf\u00e9.png", `unicode lowercased (got "${r.stored_as}")`);
    assert(r.renders, "renders");
}

console.log("== Extension detection still works on decoded link ==");
{
    const AUDIO_EXTS = [".wav", ".m4a", ".flac", ".mp3", ".wma", ".aac", ".webm"];
    // extension check uses the decoded (not lowercased) link in source; verify
    // a capitalised extension still classifies (extname is case-preserving, the
    // EXTS list is lowercase, so source lowercases via ankiMediaName for the ref
    // but classification uses extname on decodedLink -> guard with toLowerCase).
    const decoded = decodeMediaLink("Recording.MP3");
    assert(AUDIO_EXTS.includes(extname(decoded).toLowerCase()), "uppercase .MP3 detected as audio when lowercased");
}

if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
}
console.log("\nAll media-link-case tests passed.");
