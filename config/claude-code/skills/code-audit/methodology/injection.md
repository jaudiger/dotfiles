# Injection Detection Methodology

## Scope

SQL injection, command injection, path traversal, template injection, header injection, log injection, and any pattern where untrusted input is interpolated into a structured context without sanitization.

## Systematic Procedure

### Step 1 — Identify all external input entry points

For every source of untrusted data:

1. HTTP request parameters (query, body, headers, cookies, path segments).
2. File contents, file names, file paths from user uploads.
3. Database query results (if used to construct further queries).
4. Environment variables, command-line arguments (if attacker-influenceable).
5. Deserialized data (JSON, XML, YAML, MessagePack).
6. Inter-process communication (IPC, message queues).

Record each entry point with its line number and the variable that holds it.

### Step 2 — Trace input to dangerous sinks

For each input identified in Step 1, trace forward through assignments, transformations, and function calls. Flag when the input reaches any of these sinks:

1. **SQL/database query**: string concatenation or interpolation into a query. Verify parameterized queries/prepared statements are used instead.
2. **OS command execution**: system(), exec(), spawn(), popen(), or equivalent. Verify input is not interpolated into the command string. Prefer argument arrays over shell strings.
3. **File path construction**: any user input concatenated into a file path. Check for `../` traversal, null bytes, symlink following.
4. **HTML/template rendering**: user input interpolated into HTML without escaping. Check for XSS via innerHTML, dangerouslySetInnerHTML, template literals.
5. **HTTP header construction**: user input in response headers. Check for CRLF injection (newlines in header values).
6. **Log output**: user input written to logs without sanitization. Check for log forging (newlines creating fake log entries).
7. **LDAP/XML/XPath queries**: user input in structured queries without escaping.
8. **Regular expression construction**: user input used to build regex patterns. Check for ReDoS (catastrophic backtracking).
9. **Deserialization of untrusted data**: deserializing user-controlled bytes into objects (pickle, Java serialization, YAML unsafe_load).

### Step 3 — Verify sanitization at each sink

For each input-to-sink path found:

1. Is the input sanitized, escaped, or parameterized before reaching the sink?
2. Is the sanitization correct for the specific sink type? (HTML escaping does not prevent SQL injection.)
3. Is the sanitization applied at the right point? (Sanitizing early then transforming the string can re-introduce the vulnerability.)
4. Is an allowlist used where possible instead of a denylist? (Denylists are easily bypassed.)

### Step 4 — Check path traversal specifically

For every file path constructed from user input:

1. Does the code normalize the path (resolve `.`, `..`, symlinks) before checking?
2. Is there a root/base directory check after normalization?
3. Can null bytes truncate the path (relevant in C and some runtimes)?
4. On Windows: check for alternate data streams (`:`) and reserved names (CON, PRN, etc.).

### Step 5 — Check deserialization safety

1. Is untrusted data deserialized with a safe deserializer? (JSON is generally safe; pickle, YAML full load, Java ObjectInputStream are dangerous.)
2. Are deserialized objects validated before use?
3. Can deserialized data trigger constructor/destructor side effects?

## Reporting

For each finding, state:
- The input source (file, line, variable).
- The dangerous sink (file, line, operation).
- The injection type (SQL, command, path traversal, XSS, etc.).
- A concrete payload that demonstrates the vulnerability.
- Suggested fix (parameterize, escape, allowlist, use safe API).

If no issues are found, state: "No injection issues found in [file]" and briefly explain why the code is correct for this concern.
