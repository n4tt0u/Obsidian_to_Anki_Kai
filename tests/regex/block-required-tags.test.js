// Unit tests for per-block Required Tags matching (issue #10).
//
//   node tests/regex/block-required-tags.test.js
//
// Exits non-zero on failure. Imports the real implementation from
// src/required-tags.ts via ts-node/register so source-side regressions are
// caught at CI time — not a stale literal copy.
//
// Background: "Regex Required Tags" used to be checked once per *file*, so a
// file mixing #card/basic and #card/reversed notes had whichever note type ran
// first claim every block via ignore_spans. The fix moved the check to the
// regex search loop and made it block-scoped (inline tag position must overlap
// the matched range). frontmatter tags still apply file-wide.

require("ts-node/register");
const { blockHasRequiredTag } = require("../../src/required-tags");

let failed = 0;
function assert(cond, label) {
    if (cond) {
        console.log("  ✓", label);
    } else {
        console.log("  ✗", label);
        failed++;
    }
}

// --- stub helpers (mirror just the CachedMetadata fields the function reads) ---
function mkTag(tag, start, end) {
    return { tag, position: { start: { offset: start, line: 0, col: 0 }, end: { offset: end, line: 0, col: 0 } } };
}
function mkCache(tags, frontmatterTags) {
    const c = {};
    if (tags !== undefined) c.tags = tags;
    if (frontmatterTags !== undefined) c.frontmatter = { tags: frontmatterTags };
    return c;
}

console.log("== No constraint ==");

console.log("== No-constraint / parse edge cases ==");
assert(blockHasRequiredTag(0, 100, mkCache(undefined, undefined), "") === true, "empty requiredTagsStr → no constraint (true)");
assert(blockHasRequiredTag(0, 100, mkCache([mkTag("#card/reversed", 10, 24)], undefined), "   ") === true, "whitespace-only requiredTagsStr → true");
assert(blockHasRequiredTag(0, 100, mkCache(undefined, undefined), "card/basic") === false, "constraint present, no tags anywhere → false");

console.log("== Inline tag by position ==");
assert(blockHasRequiredTag(0, 100, mkCache([mkTag("#card/basic", 10, 22)], undefined), "card/basic") === true, "#card/basic inside block → true");
assert(blockHasRequiredTag(0, 100, mkCache([mkTag("#card/reversed", 10, 24)], undefined), "card/basic") === false, "#card/reversed inside block, require card/basic → false");
assert(blockHasRequiredTag(0, 50, mkCache([mkTag("#card/basic", 60, 72)], undefined), "card/basic") === false, "#card/basic outside block → false");

console.log("== Position overlap semantics ==");
assert(blockHasRequiredTag(0, 20, mkCache([mkTag("#card/basic", 15, 25)], undefined), "card/basic") === true, "tag straddling block end boundary → true (overlap)");
assert(blockHasRequiredTag(10, 30, mkCache([mkTag("#card/basic", 5, 15)], undefined), "card/basic") === true, "tag straddling block start boundary → true (overlap)");
assert(blockHasRequiredTag(0, 10, mkCache([mkTag("#card/basic", 10, 20)], undefined), "card/basic") === false, "tag touching but not overlapping (start==matchEnd) → false");

console.log("== Frontmatter (file-wide) ==");
assert(blockHasRequiredTag(0, 100, mkCache(undefined, ["card/basic"]), "card/basic") === true, "frontmatter array has required → true (any block)");
assert(blockHasRequiredTag(0, 100, mkCache(undefined, ["card/reversed"]), "card/basic") === false, "frontmatter has other tag → false");
assert(blockHasRequiredTag(0, 100, mkCache(undefined, "card/basic, other"), "card/basic") === true, "frontmatter string form parsed → true");
assert(blockHasRequiredTag(0, 100, mkCache([mkTag("#unrelated", 10, 20)], ["card/basic"]), "card/basic") === true, "frontmatter short-circuits even if inline tags differ");

console.log("== Tag normalization & matching ==");
assert(blockHasRequiredTag(0, 100, mkCache([mkTag("#card/basic", 10, 22)], undefined), "card/basic") === true, "'#' stripped from inline tag before compare");
assert(blockHasRequiredTag(0, 100, mkCache([mkTag("#card/reversed", 10, 24)], undefined), "card/basic, card/reversed") === true, "one of multiple comma-separated required → true");
assert(blockHasRequiredTag(0, 100, mkCache([mkTag("#card/basic", 10, 22)], undefined), "card") === false, "required 'card' does NOT partially match #card/basic (exact)");

console.log("== Defensive cases ==");
assert(blockHasRequiredTag(0, 100, mkCache([{ tag: "#card/basic" }], undefined), "card/basic") === false, "tag without position is skipped → false (no throw)");
assert(blockHasRequiredTag(0, 100, null, "card/basic") === false, "null fileCache → false (no throw)");
assert(blockHasRequiredTag(0, 100, undefined, "card/basic") === false, "undefined fileCache → false (no throw)");

console.log("== Issue #10 reproduction: two adjacent blocks in one file ==");
// File layout (char offsets are illustrative):
//   block A [0..40):   Q: Simple basic card #card/basic \n A: answer
//   block B [50..90):  Q: Reverse card  #card/reversed \n A: answer
const issue10Cache = mkCache([
    mkTag("#card/basic", 5, 17),
    mkTag("#card/reversed", 55, 69)
], undefined);
const aMatchesBasic = blockHasRequiredTag(0, 40, issue10Cache, "card/basic");        // expect true
const aMatchesReversed = blockHasRequiredTag(0, 40, issue10Cache, "card/reversed");  // expect false
const bMatchesReversed = blockHasRequiredTag(50, 90, issue10Cache, "card/reversed"); // expect true
const bMatchesBasic = blockHasRequiredTag(50, 90, issue10Cache, "card/basic");       // expect false
assert(aMatchesBasic === true && aMatchesReversed === false, "basic block matches only the basic note type");
assert(bMatchesReversed === true && bMatchesBasic === false, "reversed block matches only the reversed note type");

if (failed > 0) {
    console.log(`\n${failed} test(s) FAILED`);
    process.exit(1);
}
console.log("\nAll block-required-tags tests passed.");
