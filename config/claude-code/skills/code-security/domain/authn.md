# Authentication & Session Management

## Scope

Password hashing, credential storage, token validation, session lifecycle, session storage, session fixation prevention, and multi-factor authentication flow integrity.

## Systematic Procedure

### Step 1 — Identify authentication entry points

Scan the file for every function or handler that:

1. Accepts credentials (username/password, API key, OAuth token, SSO assertion).
2. Creates, validates, or refreshes authentication tokens (JWT, session cookies, API tokens).
3. Manages session lifecycle (login, logout, session creation, session destruction).
4. Implements password reset, account recovery, or MFA verification.

Record each with its line number and the variables that carry credentials or tokens.

### Step 2 — Check password hashing

For every path that stores or verifies a password:

1. Is a memory-hard hash used? Acceptable: bcrypt, argon2, scrypt. Reject: MD5, SHA1, SHA256 alone, unsalted hashes.
2. Is the salt generated per-password from a CSPRNG? Flag hardcoded or shared salts.
3. Is the work factor / cost parameter configured to a reasonable value? (bcrypt cost >= 10, argon2 memory >= 64 MiB.)
4. Is the hash comparison done in constant time?

### Step 3 — Check credential storage

1. Are passwords, API keys, or tokens stored in plaintext anywhere (database, config, logs, comments)?
2. Are credentials hardcoded in source code? Check string literals, constants, environment variable defaults.
3. Are credentials transmitted in URL query parameters (visible in logs, referrer headers)?

### Step 4 — Check token validation

For every JWT or similar token:

1. Is the signature verified before trusting claims? Flag `decode()` without `verify()`.
2. Are `exp` (expiry), `aud` (audience), and `iss` (issuer) claims validated?
3. Is the algorithm enforced? Flag acceptance of `none` algorithm or algorithm confusion (RS256 vs HS256).
4. Are token secrets/keys of sufficient length and entropy?

### Step 5 — Check session lifecycle

1. Is a new session ID generated on login (session fixation prevention)?
2. Is the session ID rotated on privilege escalation (e.g., after MFA step)?
3. Is the session invalidated server-side on logout (not just cookie deletion)?
4. Are idle timeout and absolute timeout enforced?
5. Is there a mechanism to revoke all sessions for a user?

### Step 6 — Check session storage and transport

1. Cookie flags: `Secure` (HTTPS only), `HttpOnly` (no JS access), `SameSite` (CSRF mitigation)?
2. Is the session ID of sufficient length and entropy (>= 128 bits from CSPRNG)?
3. Are session IDs exposed in URLs (URL rewriting)?
4. Is session data stored server-side with the cookie containing only the session ID?

### Step 7 — Check MFA flow integrity

1. Can the MFA step be bypassed by directly accessing post-MFA endpoints?
2. Is the MFA verification state tied to the session, not just a client-side flag?
3. Are MFA backup codes single-use and hashed?

## Reporting

For each finding, state:
- The authentication mechanism (file, line, function).
- The specific weakness (e.g., "password hashed with SHA256 without salt").
- A concrete attack scenario (e.g., "attacker with database access can crack passwords using rainbow tables").
- Suggested fix (use bcrypt with cost >= 10, generate per-password salt from CSPRNG).

If no issues are found, state: "No authentication issues found in [file]" and briefly explain why the code is correct for this domain.
