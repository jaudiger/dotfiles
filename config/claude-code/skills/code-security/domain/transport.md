# Secure Communication & HTTP Security Headers

## Scope

TLS configuration, certificate validation, HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options), CORS policy, cookie security flags, sensitive data in URLs, and SSRF prevention.

## Systematic Procedure

### Step 1 — Identify network communication points

Scan the file for every call that:

1. Establishes a TLS/SSL connection (client or server).
2. Configures HTTP server or client settings.
3. Sets HTTP response headers.
4. Constructs or follows URLs.
5. Makes outbound HTTP/HTTPS requests.

Record each with its line number and the specific API used.

### Step 2 — Check TLS configuration

For each TLS/SSL setup:

1. Is the minimum TLS version set to 1.2 or higher? Flag TLS 1.0 and 1.1.
2. Are strong cipher suites configured? Flag: RC4, DES, 3DES, NULL ciphers, export-grade ciphers.
3. Is certificate verification enabled? Flag: `InsecureSkipVerify: true`, `verify=False`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, disabled hostname verification.
4. Are self-signed certificates accepted in production code? (Acceptable in test/dev only.)
5. Is certificate pinning used where appropriate (mobile apps, high-security APIs)?

### Step 3 — Check HTTP security headers

For HTTP responses served by the application:

1. **HSTS** (`Strict-Transport-Security`): is it set with `max-age` >= 31536000 and `includeSubDomains`?
2. **CSP** (`Content-Security-Policy`): is it configured? Flag `unsafe-inline`, `unsafe-eval`, overly permissive `script-src`.
3. **X-Frame-Options**: is it set to `DENY` or `SAMEORIGIN`? (Or equivalent via CSP `frame-ancestors`.)
4. **X-Content-Type-Options**: is it set to `nosniff`?
5. **Referrer-Policy**: is it configured to limit referrer leakage?
6. **Permissions-Policy**: is it set to restrict browser features (camera, microphone, geolocation)?

### Step 4 — Check CORS configuration

1. Is `Access-Control-Allow-Origin` set to `*` (wildcard)? Flag if credentials are also allowed.
2. Is the origin validated against an explicit allowlist (not reflected from the request)?
3. Are `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` restricted to what is needed?
4. Is `Access-Control-Allow-Credentials` set to `true` only when necessary?
5. Is `Access-Control-Max-Age` configured to a reasonable value?

### Step 5 — Check cookie security

For every cookie set by the application:

1. Is the `Secure` flag set (HTTPS only)?
2. Is the `HttpOnly` flag set (no JavaScript access)?
3. Is the `SameSite` attribute set to `Strict` or `Lax`?
4. Is the `Path` attribute restricted appropriately?
5. Is the `Domain` attribute not overly broad?

### Step 6 — Check for sensitive data in URLs

1. Are tokens, passwords, API keys, or session IDs passed as URL query parameters?
2. Are sensitive values included in URL paths that may be logged?
3. Are redirect URLs validated to prevent open redirect?

### Step 7 — Check for SSRF

For every outbound HTTP request constructed from user input:

1. Is the URL scheme validated (only `http`/`https`, not `file`, `gopher`, `ftp`)?
2. Is the hostname validated against an allowlist?
3. Is the resolved IP address checked (no internal/private/loopback IPs)?
4. Are redirects followed safely (re-validate after redirect)?
5. Is there protection against DNS rebinding?

## Reporting

For each finding, state:
- The network operation (file, line, function/API).
- The specific weakness (e.g., "TLS certificate verification disabled in production HTTP client").
- A concrete attack scenario (e.g., "attacker can perform MITM and intercept all traffic").
- Suggested fix (enable certificate verification, set minimum TLS 1.2, add HSTS header).

If no issues are found, state: "No transport security issues found in [file]" and briefly explain why the code is correct for this domain.
