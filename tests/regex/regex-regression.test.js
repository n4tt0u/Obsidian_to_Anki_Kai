// Regression tests for the ignore-region regexes that caused silent card loss
// in Kai 5.0.x. Run with:
//
//   node tests/regex/regex-regression.test.js
//
// Exits non-zero on failure. Imports the *actual* regexes from src/constants.ts
// (via ts-node/register) so any source-side regression is caught at CI time —
// not a stale literal copy that silently drifts from the source.

require("ts-node/register");
const c = require("../../src/constants");

const OBS_INLINE_MATH_REGEXP = c.OBS_INLINE_MATH_REGEXP;
const OBS_DISPLAY_MATH_REGEXP = c.OBS_DISPLAY_MATH_REGEXP;
const OBS_CODE_REGEXP = c.OBS_CODE_REGEXP;

let failed = 0;
function assert(cond, label) {
    if (cond) {
        console.log("  ✓", label);
    } else {
        console.log("  ✗", label);
        failed++;
    }
}
function matches(re, str) {
    return [...str.matchAll(new RegExp(re.source, re.flags))];
}

console.log("== Inline math: legitimate matches ==");
assert(matches(OBS_INLINE_MATH_REGEXP, "Pythagoras: $a^2+b^2=c^2$ done.").length === 1, "single line math matches");
assert(matches(OBS_INLINE_MATH_REGEXP, "Two: $x$ and $y$ on one line.").length === 2, "two on a line");
assert(matches(OBS_INLINE_MATH_REGEXP, "Spaced $x$ and $y$ matches both.").length === 2, "spaced pair");

console.log("== Inline math: currency / regressions must NOT match ==");
assert(matches(OBS_INLINE_MATH_REGEXP, "Make a $200k scale in June").length === 0, "$200k currency not math");
assert(matches(OBS_INLINE_MATH_REGEXP, "between $5 and $10").length === 0, "two currency amounts");
assert(matches(OBS_INLINE_MATH_REGEXP, "$8,000 invoice paid in March").length === 0, "$8,000 currency");
assert(matches(OBS_INLINE_MATH_REGEXP, "scale in June... " + "x".repeat(50) + "\nQ: Next card?\nA: $8,000 invoice").length === 0, "no cross-line currency span");

console.log("== Inline math: cannot cross newlines ==");
const multi = "If $200k is on this line\nand $80k is on another, do not pair them.";
assert(matches(OBS_INLINE_MATH_REGEXP, multi).length === 0, "no cross-newline match");

console.log("== Inline math: whitespace at edges blocks match ==");
assert(matches(OBS_INLINE_MATH_REGEXP, "bad $ a $ here").length === 0, "leading space");
assert(matches(OBS_INLINE_MATH_REGEXP, "bad $a $ here").length === 0, "trailing space");

console.log("== Inline code: single-line only ==");
assert(matches(OBS_CODE_REGEXP, "use `foo()` for that").length === 1, "single backtick code");
assert(matches(OBS_CODE_REGEXP, "stray ` over here\n\n\nand ` over there").length === 0, "no cross-line backtick pairing");

console.log("== Display math: only valid when adjacent ==");
assert(matches(OBS_DISPLAY_MATH_REGEXP, "see $$x = 1$$ here").length === 1, "valid display math");
assert(matches(OBS_DISPLAY_MATH_REGEXP, "$$\nblock\nspans\n$$").length === 1, "multiline display math");

console.log("== Real-world reproduction: zero cards swallowed ==");
const reproduction = `Q: Why don't most businesses use cash accounting?
A: Cash often moves at a different time to the actual business activity. If you make a $200k sale in June but the customer pays in July, cash accounting records nothing in June.

Q: Under accrual accounting, when is **revenue** recognised?
A: When it is **earned**.

Q: What is **Cash Profit**?
A: Revenues minus expenses under cash accounting.

Q: A company receives an invoice for **$8,000 of electricity** used during the year, which will be paid next year.
A: - **Accrual:** **-$8,000** (incurred). - **Cash:** **$0**.
`;
const swallowed = matches(OBS_INLINE_MATH_REGEXP, reproduction);
assert(swallowed.length === 0, `no math spans created from currency in narrative content (got ${swallowed.length}: ${swallowed.map(m=>JSON.stringify(m[0])).join(", ")})`);

if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
}
console.log("\nAll regex regression tests passed.");
