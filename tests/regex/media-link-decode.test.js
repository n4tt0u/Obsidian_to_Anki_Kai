// Regression test for media-link normalisation. Locks the fix for the silent
// broken-image bug: a markdown-style embed with percent-encoded spaces
// (![](Pasted%20image%201.png)) was stored in Anki under a name with a literal
// "%20" while the <img src> Anki resolved had its "%20" decoded back to a space,
// so the lookup missed and the image rendered broken.
//
// Run with:
//   node tests/regex/media-link-decode.test.js
//
// Exits non-zero on failure. Imports decodeMediaLink from src/constants.ts
// (via ts-node/register) so any source-side regression is caught.

require("ts-node/register");
const c = require("../../src/constants");
const { basename, extname } = require("path");

const decodeMediaLink = c.decodeMediaLink;

let failed = 0;
function assert(cond, label) {
    if (cond) {
        console.log("  \u2713", label);
    } else {
        console.log("  \u2717", label);
        failed++;
    }
}

// Simulate the three names that must agree for an image to render in Anki:
//   stored = name the file is saved under in Anki's media collection
//   imgSrc = value put in <img src="...">
//   lookup = what Anki's media server resolves imgSrc to (it decodes %-encoding)
function pipeline(embedLink) {
    const decoded = decodeMediaLink(embedLink);
    const stored = basename(decoded);
    const imgSrc = basename(decoded);
    const lookup = decodeMediaLink(imgSrc); // Anki decodes the src on resolve
    return { stored, imgSrc, lookup, renders: lookup === stored };
}

console.log("== Wikilink embed (literal spaces) still works ==");
{
    const r = pipeline("Pasted image 1.png");
    assert(r.stored === "Pasted image 1.png", "stored under literal name");
    assert(r.renders, "image resolves and renders");
}

console.log("== Markdown embed (percent-encoded spaces) is repaired ==");
{
    const r = pipeline("Pasted%20image%201.png");
    assert(r.stored === "Pasted image 1.png", `stored under decoded name (got "${r.stored}")`);
    assert(!r.imgSrc.includes("%20"), "img src has no %20");
    assert(r.renders, "image resolves and renders (no broken link)");
}

console.log("== Subfolder + encoded spaces ==");
{
    const r = pipeline("attachments/My%20Diagram.png");
    assert(r.stored === "My Diagram.png", `basename decoded (got "${r.stored}")`);
    assert(r.renders, "renders");
}

console.log("== Encoded unicode filename ==");
{
    // "café.png" -> "caf%C3%A9.png"
    const r = pipeline("caf%C3%A9.png");
    assert(r.stored === "caf\u00e9.png", `unicode decoded (got "${r.stored}")`);
    assert(r.renders, "renders");
}

console.log("== Malformed escape falls back, does not throw ==");
{
    // A real "%" that is not a valid escape (e.g. "100%done.png") must not crash.
    let threw = false;
    let r;
    try { r = pipeline("100%done.png"); } catch (_) { threw = true; }
    assert(!threw, "no exception on malformed escape");
    assert(r && r.renders, "still produces a consistent (stored === lookup) pair");
}

console.log("== Audio extension detection survives decode ==");
{
    const AUDIO_EXTS = [".wav", ".m4a", ".flac", ".mp3", ".wma", ".aac", ".webm"];
    const decoded = decodeMediaLink("My%20Recording.mp3");
    assert(AUDIO_EXTS.includes(extname(decoded)), "decoded .mp3 detected as audio");
}

if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
}
console.log("\nAll media-link-decode tests passed.");
