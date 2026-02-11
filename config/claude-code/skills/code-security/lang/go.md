# Go — Security Patterns

## Valid domains

authn, authz, crypto, input-validation, transport, logging, config

## Cryptography and secure random (Go 1.24+)

- **CSPRNG**: `crypto/rand.Read()` — guaranteed not to fail since Go 1.24 (no error return needed). Reject: `math/rand`, `math/rand/v2` for any security purpose.
- **New stdlib crypto packages (Go 1.24)**: `crypto/mlkem` (post-quantum ML-KEM-768/1024), `crypto/hkdf`, `crypto/pbkdf2`, `crypto/sha3`. Prefer these over third-party equivalents when available.
- **Password hashing**: `golang.org/x/crypto/bcrypt` (`bcrypt.GenerateFromPassword` with cost >= 10), `golang.org/x/crypto/argon2` (`argon2.IDKey`). Reject: plain SHA256/SHA512 of password.
- **Constant-time comparison**: `crypto/subtle.ConstantTimeCompare()`. Reject: `==`, `bytes.Equal()`, `strings.EqualFold()` on secrets/MACs.
- **Symmetric encryption**: `crypto/aes` with `crypto/cipher.NewGCM()` (AES-GCM), `golang.org/x/crypto/chacha20poly1305`. Reject: ECB mode, `cipher.NewCBCEncrypter` without separate MAC.
- **Deprecated (Go 1.24)**: `cipher.NewOFB`, `cipher.NewCFBEncrypter`, `cipher.NewCFBDecrypter` — use AEAD modes or `cipher.NewCTR`.
- **Key exchange**: `crypto/tls` supports X25519MLKEM768 by default in Go 1.24.
- **Go 1.26**: `EncryptPKCS1v15`/`DecryptPKCS1v15` deprecated — use OAEP. New `crypto/hpke` package.
- **Secure zeroing**: Go does not have a stdlib secure-zero. Use `crypto/subtle` or manually zero slices with a loop that the compiler cannot optimize away. Consider `memguard` for sensitive values.

## Authentication and session management

- **JWT**: use `golang-jwt/jwt/v5` — call `jwt.Parse()` with explicit `jwt.WithValidMethods()`. Reject: `jwt.ParseUnverified()` for trusted decisions, accepting `none` algorithm.
- **Cookie flags**: `http.Cookie{Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode}`.
- **Session management**: `gorilla/sessions` or `scs` — verify session ID regeneration on login.

## Input validation

- **SQL injection**: `database/sql` with `?` or `$1` placeholders. Flag string concatenation or `fmt.Sprintf` in query strings.
- **Command injection**: `os/exec.Command()` uses argument array (safe). Flag `exec.Command("sh", "-c", userInput)`.
- **HTML escaping**: `html/template` auto-escapes. Reject: `text/template` for HTML output — no escaping.
- **Path traversal**: `filepath.Join(base, userInput)` does not prevent `..`. Use `filepath.Clean()` then verify `strings.HasPrefix(cleaned, base)`.

## Transport and TLS

- **TLS config**: `tls.Config{MinVersion: tls.VersionTLS12}`. Flag: missing `MinVersion` (defaults vary by Go version).
- **Certificate verification**: skip verify is `tls.Config{InsecureSkipVerify: true}`. Flag in production code.
- **HTTP client timeout**: `http.Client{Timeout: ...}`. Flag: default `http.Client{}` with no timeout (hangs forever).
- **HTTP server timeout**: set `ReadTimeout`, `WriteTimeout`, `IdleTimeout` on `http.Server`. Missing timeouts enable slowloris.

## CORS and headers

- **CORS**: verify `Access-Control-Allow-Origin` is not `*` when credentials are used.
- **HSTS**: set `Strict-Transport-Security` header in middleware.
- **SSRF**: validate URL scheme and hostname before `http.Get(userURL)`.

## Logging

- **slog (Go 1.21+)**: structured logging. Use `slog.Group` and custom `LogValuer` to redact sensitive fields.
- **Log injection**: sanitize user input for newlines before logging with `log` package (unstructured).

## Common frameworks

- **net/http**: stdlib HTTP server. Configure timeouts, use middleware for auth/CORS/headers.
- **Gin / Echo / Chi**: verify middleware ordering (auth before handlers), CSRF protection.
- **gRPC-Go**: use interceptors for auth, TLS for transport.
