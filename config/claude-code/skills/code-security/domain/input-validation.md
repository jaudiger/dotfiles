# Input Validation & Safe Deserialization

## Scope

Allowlist vs denylist validation, schema validation at system boundaries, context-aware output encoding, unsafe deserialization, content-type validation, file upload safety, XML/JSON/YAML parsing safety, and regex denial of service (ReDoS).

## Systematic Procedure

### Step 1 — Identify all external input entry points

For every source of untrusted data:

1. HTTP request parameters (query, body, headers, cookies, path segments).
2. File contents, file names, file metadata from user uploads.
3. Deserialized data (JSON, XML, YAML, MessagePack, Protocol Buffers).
4. Inter-process communication, message queues, webhook payloads.
5. Database results used to construct further operations (second-order injection).

Record each entry point with its line number and the variable that holds it.

### Step 2 — Check validation strategy

For each input entry point:

1. Is validation performed at the system boundary (before business logic)?
2. Is an allowlist approach used (accept known-good) rather than a denylist (reject known-bad)?
3. Is schema validation applied (type, format, length, range, allowed values)?
4. Is the validation library/framework appropriate (zod, joi, Pydantic, marshmallow, Bean Validation)?
5. Are validation errors handled without exposing internal details?

### Step 3 — Check output encoding

For each place where data flows to an output context:

1. **HTML**: is data HTML-encoded before insertion? Flag raw interpolation.
2. **JavaScript**: is data JSON-encoded or JavaScript-escaped?
3. **SQL**: are parameterized queries used? (Covered more deeply in language files.)
4. **Shell**: is data passed as arguments (not interpolated into command strings)?
5. **URL**: is data URL-encoded before insertion into URLs?
6. Is the encoding context-appropriate? (HTML encoding does not prevent JavaScript injection in event handlers.)

### Step 4 — Check deserialization safety

1. Is untrusted data deserialized with a safe deserializer? Flag: Java `ObjectInputStream`, Python `pickle`/`yaml.load`, PHP `unserialize`, Ruby `Marshal.load` on untrusted data.
2. For JSON: is the parsed output validated against a schema before use?
3. For XML: are external entities disabled (XXE prevention)? Is doctype processing disabled (billion laughs)?
4. For YAML: is safe loading used (`yaml.safe_load`, `SafeLoader`)?
5. Can deserialized objects trigger constructor or destructor side effects?

### Step 5 — Check file upload handling

For every file upload handler:

1. Is the file type validated by content (magic bytes), not just extension or Content-Type header?
2. Is the file size limited?
3. Is the file name sanitized (no path traversal, no special characters)?
4. Are uploaded files stored outside the webroot or served through a controlled handler?
5. Are executable file types rejected?

### Step 6 — Check XML/JSON/YAML parsing

1. **XML**: external entity resolution disabled? Flag `FEATURE_EXTERNAL_GENERAL_ENTITIES`, missing `setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)` or equivalent.
2. **XML**: DTD processing disabled? Billion laughs (entity expansion) prevention?
3. **YAML**: `yaml.safe_load` / `SafeLoader` used? Flag `yaml.load` / `yaml.unsafe_load` / `FullLoader` on untrusted data.
4. **JSON**: depth limits configured? Extremely nested JSON can cause stack overflow.

### Step 7 — Check regex safety

1. Are any regular expressions constructed from user input? Flag `new RegExp(userInput)`, `re.compile(userInput)` without escaping.
2. Do any regexes have patterns susceptible to catastrophic backtracking? Look for: nested quantifiers `(a+)+`, overlapping alternations `(a|a)+`, repeated groups with optional elements `(a*)*`.
3. Are regex timeouts or safe regex libraries used for user-facing pattern matching?

## Reporting

For each finding, state:
- The input source (file, line, variable).
- The specific weakness (e.g., "XML parser allows external entities — XXE possible").
- A concrete attack scenario (e.g., "attacker can read arbitrary files via XXE payload").
- Suggested fix (disable external entities, use allowlist validation, switch to safe deserializer).

If no issues are found, state: "No input validation issues found in [file]" and briefly explain why the code is correct for this domain.
