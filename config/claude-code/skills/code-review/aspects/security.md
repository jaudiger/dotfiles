# Security

Surface security concerns in the changeset. This is a broad review pass —
flag issues and recommend `/code-security` or `/code-audit` follow-ups for
findings that warrant deep analysis.

## Checklist

### 1. Input handling

- New entry points (HTTP endpoints, CLI arguments, file parsers, IPC): is
  input validated before use?
- Existing entry points modified: does the change weaken or bypass validation?
- User input reaching dangerous sinks (SQL, shell commands, HTML output, file
  paths): is it sanitized or parameterized?

### 2. Authentication and authorization

- New endpoints or operations: do they enforce authentication?
- Access control checks: are they server-side, not just UI-based?
- Privilege changes: can a user escalate roles or access another user's data?

### 3. Secret handling

- New secrets (API keys, passwords, tokens): are they read from environment
  variables or a vault, never hardcoded?
- Logging: does the change log anything that could contain secrets or PII?
- Error messages: do they expose internal details (stack traces, file paths,
  SQL) to end users?

### 4. Dependency changes

- New dependencies added: are they well-maintained and from trusted sources?
- Version pins: are new dependencies pinned to specific versions?
- Known vulnerabilities: flag any dependency with a publicly known CVE if
  apparent from the name and version.

### 5. Data exposure

- New API responses or serialization: do they expose more fields than
  necessary?
- Debug or development code: is it guarded against running in production?
- File operations: are paths validated against directory traversal?

### 6. Cryptography

- New crypto usage: are modern algorithms and libraries used?
- Key and secret management: are keys generated securely, stored safely, and
  rotated?
- Comparison: are secrets compared in constant time?
