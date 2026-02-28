# Security Logging & Audit Trails

## Scope

Sensitive data in logs, PII redaction/masking, security event logging, log injection prevention, structured logging for security events, and log level appropriateness.

## Systematic Procedure

### Step 1: Identify all logging calls

Scan the file for every call that writes to logs:

1. Standard logging frameworks: `log`, `slog`, `log4j`, `slf4j`, `logging`, `winston`, `pino`, `bunyan`, `console.log`, `println`, `printf` (when used for logging).
2. Custom logging wrappers.
3. Audit trail / security event recording.
4. Error reporting services (Sentry, Bugsnag, etc.).

Record each with its line number and the data being logged.

### Step 2: Check for sensitive data in logs

For each logging call, check whether the logged data contains:

1. **Passwords** or password hashes.
2. **Authentication tokens**: JWTs, session IDs, API keys, bearer tokens.
3. **Cryptographic keys** or secrets.
4. **PII**: email addresses, phone numbers, social security numbers, addresses, dates of birth.
5. **Financial data**: credit card numbers, bank account numbers, CVVs.
6. **Health data** or other regulated information.

Flag any logging call that outputs these values in plaintext.

### Step 3: Check PII redaction/masking

1. Are there redaction or masking utilities in use? Verify they cover all sensitive fields.
2. Is redaction applied consistently across all logging paths (not just some)?
3. Is the redaction adequate (full masking or truncation, not just partial hiding like `****1234`)?
4. Is structured logging used to separate data from message templates (preventing accidental inclusion)?

### Step 4: Check security event logging

Verify that the following security-relevant events are logged (when applicable to the code):

1. **Authentication**: successful/failed login attempts, account lockouts, password changes.
2. **Authorization**: access denied events, privilege escalation attempts.
3. **Input validation**: rejected inputs, suspicious patterns.
4. **Session**: creation, destruction, timeout, concurrent session detection.
5. **Administrative actions**: user creation/deletion, permission changes, configuration changes.

For each event type that should be logged but is not, flag as a finding.

### Step 5: Check log injection prevention

1. Can user-controlled input create fake log entries by injecting newlines (`\n`, `\r\n`)?
2. Can user input inject control characters that corrupt log formatting?
3. Is user input sanitized or escaped before inclusion in log messages?
4. Is structured logging (JSON, key-value) used instead of string interpolation?

### Step 6: Check log level appropriateness

1. Are security events logged at an appropriate level (INFO or WARN, not DEBUG)?
2. Are sensitive details that should never appear in production logged at DEBUG level (still a risk if DEBUG is enabled)?
3. Is there a risk that changing log levels in production exposes sensitive data?

## Reporting

For each finding, state:
- The logging call (file, line, function).
- The specific weakness (e.g., "JWT token logged in plaintext at INFO level").
- A concrete attack scenario (e.g., "attacker with log access can steal session tokens").
- Suggested fix (redact token before logging, use structured logging with sensitive field masking).

If no issues are found, state: "No logging security issues found in [file]" and briefly explain why the code is correct for this domain.
