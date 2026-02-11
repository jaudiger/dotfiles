# Rust — Security Patterns

## Valid domains

authn, authz, crypto, input-validation, transport, logging, config

## Cryptography and secure random

- **Crypto backends**: `aws-lc-rs` (now default rustls backend) — provides FIPS 140-3 compliance and post-quantum ML-KEM support. `ring` as alternative. Reject: rolling custom crypto primitives.
- **CSPRNG**: `rand::rngs::OsRng`, `rand::thread_rng()` (backed by OS entropy). `getrandom` crate for raw OS randomness. Reject: `rand::rngs::SmallRng`, `rand::rngs::StdRng::seed_from_u64(constant)` for security purposes.
- **Password hashing**: `argon2` crate (`argon2::Argon2::hash_password`), `bcrypt` crate. Reject: plain SHA256/SHA512 of password.
- **Secret types**: `secrecy::Secret<T>` wraps sensitive values, prevents accidental logging/display. `secrecy::ExposeSecret` for controlled access.
- **Key zeroing**: `zeroize` crate (`Zeroize` trait, `Zeroizing<T>` wrapper). Derive `Zeroize` on types holding key material. Reject: relying on `Drop` alone (optimizer may elide the zeroing).
- **Constant-time comparison**: `subtle::ConstantTimeEq` (`ct_eq()`). Reject: `==`, `PartialEq` on secrets/MACs.
- **Symmetric encryption**: `aes-gcm` crate, `chacha20poly1305` crate. Reject: ECB mode, `aes` crate without authenticated mode.
- **Hashing**: `sha2`, `blake2`, `blake3` crates for integrity. `argon2`/`bcrypt` for passwords.

## Authentication and session management

- **JWT**: `jsonwebtoken` crate — use `jsonwebtoken::decode()` with `Validation` struct (algorithm, audience, issuer). Reject: `dangerous_insecure_decode()` for trusted decisions.
- **Session management**: `tower-sessions`, `actix-session`. Verify session ID regeneration on login, secure cookie flags.
- **Cookie flags**: `cookie::Cookie::build().secure(true).http_only(true).same_site(SameSite::Strict)`.

## Authorization

- **Axum**: use extractors and middleware layers via `tower`. Verify auth middleware runs before handlers.
- **Actix-web**: use middleware and guards (`web::guard`). Verify authorization on every route.
- **IDOR**: verify object-level authorization in service functions (not just role checks at the route level).

## Input validation

- **SQL injection**: `sqlx` with `query!()` / `query_as!()` (compile-time checked), `diesel` with type-safe query builder. Flag: `sqlx::query(&format!("SELECT ... {}", user_input))`.
- **Command injection**: `std::process::Command::new("cmd").arg(user_input)` (safe — each arg is separate). Reject: `Command::new("sh").arg("-c").arg(format!("... {}", user_input))`.
- **HTML escaping**: no auto-escaping in `format!`. Use template engines with escaping (`askama`, `tera`, `maud`). Flag: `format!("<div>{}</div>", user_input)` in HTTP responses.
- **Path traversal**: `std::path::Path::join(user_input)` does not prevent `..`. Canonicalize with `.canonicalize()` then check `.starts_with(base)`.
- **Deserialization**: `serde` is generally safe (no arbitrary code execution), but validate deserialized data. `serde_json`, `serde_yaml`: parse then validate against domain types.

## Transport and TLS

- **TLS**: `rustls` with `rustls-aws-lc-rs` or `rustls-ring` provider crates (separated since rustls 0.24). `rustls` disables TLS < 1.2 by default.
- **Certificate verification**: `rustls` verifies certificates by default via `webpki`. Flag: custom `ServerCertVerifier` that accepts all certificates.
- **HTTP client**: `reqwest` (built on `hyper` + `rustls`/`native-tls`). Verify: `danger_accept_invalid_certs(false)` (default), timeout configured.
- **HTTP server**: `axum`/`actix-web`/`warp`. Configure timeouts and request size limits.

## Logging

- **tracing**: structured logging. Use `tracing::instrument` with `skip` attribute to exclude sensitive fields: `#[instrument(skip(password))]`.
- **Sensitive data**: do not implement `Display` or `Debug` for types containing secrets. Use `secrecy::Secret<T>` (redacts on Debug/Display).
- **log crate**: parameterized logging (`log::info!("User {} logged in", user_id)`). No format-string injection risk (compile-time format strings), but verify no secrets in arguments.

## Configuration

- **Environment**: `std::env::var("SECRET")`. Verify secrets not hardcoded. Use `dotenvy` for development, but do not commit `.env` files.
- **Error responses**: do not expose internal error details to clients. Map internal errors to generic HTTP error responses. `thiserror` for internal errors, custom `IntoResponse` for client-facing errors.

## Common frameworks

- **Axum**: `tower` middleware stack for auth, rate limiting, CORS. `axum::extract` for type-safe request parsing.
- **Actix-web**: middleware, guards, extractors. `actix-cors` for CORS configuration.
- **Rocket**: fairings for middleware, request guards for auth.
