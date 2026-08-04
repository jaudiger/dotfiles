# Banned patterns in code comments

MUST NOT use numbered sequences, section banners, lists, or concrete examples in code comments. Numbered sequences include `1.`, `2.`, `Step 1`, and `Phase 1`. Section banners include `// -- SECTION --`, `// === SECTION ===`, `// --- SECTION ---`, `/* ======= */`, and other decorative separator lines. Write flowing sentences instead of lists. Describe behavior abstractly instead of illustrating it with concrete values. Avoid "e.g.", "for example", "such as", "like", and bare parenthetical values. Put any concrete value essential to understanding in a test.
