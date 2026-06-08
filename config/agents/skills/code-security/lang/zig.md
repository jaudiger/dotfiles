# Zig: Security Patterns

Target version: Zig 0.16+.

## Valid domains

crypto, input-validation, transport, logging, config

`authn` and `authz` are intentionally omitted: Zig has no standard authentication or authorization framework. Use `crypto` for primitives (password hashing, signatures, key derivation) and `input-validation` for parsing session tokens or credential payloads.

## Cryptography and secure random

- CSPRNG: `io.random(&buffer)` for OS-backed random bytes. For the `std.Random` interface, build it from `std.Random.IoSource{ .io = io }` and call `.interface()`. Reject deterministic PRNGs (`std.Random.DefaultPrng`, user-seeded generators) for security-sensitive use.
- Secure zeroing: `std.crypto.secureZero(u8, slice)` for zeroing sensitive memory. Reject `@memset` (the compiler may optimize it away). Place `defer std.crypto.secureZero(u8, &key_buffer)` immediately after key material is loaded.
- Constant-time comparison: `std.crypto.timing_safe.eql()`. Reject `std.mem.eql()` and `==` on secrets or MACs.
- Timing side-channel analysis: `std.crypto.timing_safe.classify()` / `declassify()` for marking and unmarking data as secret.
- AEAD ciphers: `std.crypto.aead`: `Aes256Gcm`, `ChaCha20Poly1305`, `Aegis128L`, `Aegis256`. Reject non-AEAD modes and custom constructions.
- Hashing: `std.crypto.hash`: SHA2 (`Sha256`, `Sha512`), SHA3, BLAKE2b, BLAKE3. Reject MD5 and SHA1 for security purposes.
- Digital signatures: `std.crypto.sign`: Ed25519, ECDSA.
- Key exchange: `std.crypto.dh`: X25519. `std.crypto.kem`: ML-KEM for post-quantum.
- Password hashing: `std.crypto.pwhash`: `argon2`, `bcrypt`, `scrypt`, `pbkdf2`. Reject a single-pass hash of a password.
- NaCl-compatible: `std.crypto.nacl`: `Box`, `SecretBox`, `SealedBox` for high-level authenticated encryption.

## Input validation

- Buffer safety: slice bounds checks panic in Debug/ReleaseSafe and are disabled in ReleaseFast/ReleaseSmall. Verify correctness does not depend on runtime checks.
- Integer overflow: safety-checked in Debug/ReleaseSafe, UB in ReleaseFast. Use `@addWithOverflow`, `@subWithOverflow`, `@mulWithOverflow` for explicit checked arithmetic. Use `+%`, `-%`, `*%` only for intentional wrapping.
- `@intCast`: UB in ReleaseFast if the value does not fit. Validate range before casting.
- Float-to-integer conversion: use `@trunc`/`@floor`/`@ceil`/`@round` and validate the source is finite and in range.
- Sentinel-terminated slices: `@ptrCast` or `@truncate` can lose the sentinel; verify sentinel presence after cast.
- Vectors cannot be indexed at runtime; coerce to an array first and bounds-check the index.
- Packed types: pointers in `packed struct`/`packed union` are rejected, and `packed union` requires an explicit backing integer whose `@bitSizeOf` matches every field. Flag wire-format or FFI code that violates these rules.
- User input parsing: use `std.fmt.parseInt`, `std.fmt.parseFloat` with error handling. Validate all fields before use.
- Path handling: `std.Io.Dir.path` helpers; reject raw concatenation of untrusted path segments.

## Transport and TLS

- TLS: `std.crypto.tls`, built on `std.Io` Reader/Writer interfaces. TLS 1.3 client and server.
- HTTP: `std.http.Client` and `std.http.Server`, constructed with `.allocator` and `.io`. Configure timeouts and request size limits. For clients, build requests from structured URI fields (`scheme`, `host`, `port`, `path`) rather than raw strings.
- Certificate verification: verify certificates are validated against a trust store. Flag custom verification that skips checks or accepts any certificate.
- Network cancelation: `Io`-based network calls surface `error.Canceled`. Security-critical flows must propagate the cancelation rather than ignoring it and continuing with partial state.

## Logging

- `std.log`: structured logging with levels (`.err`, `.warn`, `.info`, `.debug`). Verify no secrets in log output.
- Security events: log authentication failures and access denials at `.warn` or `.err`, not `.debug`.
- Log injection: `std.log` uses format strings; user input as a format argument could cause issues. Always use `std.log.info("{s}", .{user_input})`, never `std.log.info(user_input, .{})`.

## Configuration

- Build modes: ReleaseFast disables safety checks. Verify security-critical code does not rely on safety checks catching errors at runtime.
- Allocation patterns for secrets: use a dedicated allocator for secret material. Zero memory on deallocation. Use `defer` for cleanup. `std.heap.ArenaAllocator` is lock-free and thread-safe and can host per-request secret buffers so long as the arena is zeroed and reset on teardown.
- Error handling: `catch unreachable` and `orelse unreachable` are UB in ReleaseFast; verify impossible errors are truly impossible. `error.Canceled` on `Io`-taking calls must not be collapsed into a success path.

## Memory management for secrets

- Allocate key material with explicit lifetime management.
- `defer std.crypto.secureZero(u8, key_slice)` immediately after loading keys.
- Do not store secrets in comptime-known variables (embedded in the binary).
- Use `std.heap.page_allocator` for sensitive buffers to avoid general-purpose allocator pooling that may retain secret bytes across allocations.
