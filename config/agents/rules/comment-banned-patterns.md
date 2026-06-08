# Banned patterns in code comments

NEVER use any of the following in code comments.

## No numbered sequences

Do not use `1.`, `2.`, `Step 1`, `Phase 1`, or any numbered/lettered enumeration.

## No section banners

Do not use `// -- SECTION --`, `// === SECTION ===`, `// --- SECTION ---`, `/* ======= */`, or any decorative separator line.

## No lists

Do not use bullet, numbered, or dash-separated lists. Fold the information into flowing prose sentences instead.

## No concrete examples

Do not illustrate with concrete values. Avoid "e.g.", "for example", "such as", "like", and bare parenthetical values. Describe behavior abstractly. If a concrete value is essential for understanding, put it in a test.
