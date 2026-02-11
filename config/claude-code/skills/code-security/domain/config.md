# Secure Defaults & Configuration

## Scope

Debug mode in production, verbose error exposure, default-deny configurations, rate limiting on authentication endpoints, error response information leakage, admin/debug endpoint exposure, dependency pinning, and feature flags for security-relevant features.

## Systematic Procedure

### Step 1 — Identify configuration and environment handling

Scan the file for every location that:

1. Reads configuration values (environment variables, config files, command-line flags).
2. Sets application modes (debug, development, production, staging).
3. Configures error handling or error response behavior.
4. Defines or exposes admin, debug, health, or internal endpoints.
5. Configures rate limiting, throttling, or abuse prevention.

Record each with its line number and the configuration key or value.

### Step 2 — Check debug mode and environment settings

1. Is debug mode disabled by default (requiring explicit opt-in)?
2. Can debug mode be accidentally enabled in production (e.g., truthy default, missing environment check)?
3. Are development-only features (debug toolbar, profiler, hot reload endpoints) gated behind environment checks?
4. Is `DEBUG=true`, `NODE_ENV=development`, or equivalent checked and handled correctly?

### Step 3 — Check error response exposure

1. Do error responses expose stack traces to end users?
2. Do error responses include SQL errors, internal file paths, or framework details?
3. Is there a generic error handler that returns safe messages in production?
4. Are detailed errors only shown in development/debug mode?
5. Do 404 or other responses reveal the existence of internal routes or resources?

### Step 4 — Check default-deny configuration

1. Are permissions, access rules, and firewall rules configured as default-deny?
2. Are new features or endpoints protected by default without explicit opt-in?
3. Are fallback / catch-all handlers configured to deny rather than allow?

### Step 5 — Check rate limiting

1. Are authentication endpoints (login, registration, password reset) rate-limited?
2. Are API endpoints rate-limited to prevent abuse?
3. Is the rate limiting applied at the correct layer (per-IP, per-user, per-endpoint)?
4. Are rate limit responses handled properly (429 status, Retry-After header)?

### Step 6 — Check admin and debug endpoint exposure

1. Are admin endpoints protected by authentication and authorization?
2. Are debug endpoints (profiling, metrics, health with sensitive info) restricted to internal networks or disabled in production?
3. Are default admin credentials changed or removed?
4. Is the admin interface on a separate port or path with additional access controls?

### Step 7 — Check dependency and build configuration

1. Are dependencies pinned to specific versions (lock files committed)?
2. Are there known vulnerable dependencies that should be updated?
3. Are security-relevant compiler/build flags set (stack canaries, ASLR, PIE, RELRO)?
4. Are feature flags used to control rollout of security-sensitive changes?

### Step 8 — Check error handling defaults

1. Do unhandled exceptions result in a safe state (connection closed, request rejected)?
2. Is there a global exception handler that prevents information leakage?
3. Are error pages customized (no default framework error pages in production)?

## Reporting

For each finding, state:
- The configuration point (file, line, setting).
- The specific weakness (e.g., "debug mode enabled by default — stack traces visible to end users").
- A concrete attack scenario (e.g., "attacker can enumerate internal file paths and framework versions from error messages").
- Suggested fix (set debug=false by default, use generic error handler in production, rate-limit login endpoint).

If no issues are found, state: "No configuration security issues found in [file]" and briefly explain why the code is correct for this domain.
