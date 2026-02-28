# Zig: Security Patterns

## Valid domains

crypto, input-validation, transport, logging, config

## Cryptography and secure random (Zig 0.15 APIs)

- **CSPRNG**: `std.crypto.random` (OS-backed CSPRNG). Reject: `std.rand` (PRNG; deterministic, not for security).
- **Secure zeroing**: `std.crypto.secureZero()` for zeroing sensitive memory. Reject: `@memset` (compiler may optimize away). Use `defer std.crypto.secureZero(u8, &key_buffer)` immediately after key material is loaded.
- **Constant-time comparison**: `std.crypto.timing_safe.eql()`. Reject: `std.mem.eql()`, `==` on secrets/MACs.
- **Timing side-channel analysis**: `std.crypto.timing_safe.classify()` / `declassify()` for marking and unmarking data as secret.
- **AEAD ciphers**: `std.crypto.aead`: `Aes256Gcm`, `ChaCha20Poly1305`, `Aegis128L`, `Aegis256`. Reject: non-AEAD modes, custom constructions.
- **Hashing**: `std.crypto.hash`: SHA2 (`Sha256`, `Sha512`), SHA3, BLAKE2b, BLAKE3. Reject: MD5, SHA1 for security purposes.
- **Digital signatures**: `std.crypto.sign`: Ed25519, ECDSA.
- **Key exchange**: `std.crypto.dh`: X25519. `std.crypto.kem`: ML-KEM (post-quantum).
- **Password hashing**: `std.crypto.pwhash`: `argon2`, `bcrypt`, `scrypt`, `pbkdf2`. Reject: single-pass hash of password.
- **NaCl-compatible**: `std.crypto.nacl`: `Box`, `SecretBox`, `SealedBox` for high-level authenticated encryption.

## Input validation

- **Buffer safety**: Zig's slice bounds checking (in Debug/ReleaseSafe) catches out-of-bounds access. In ReleaseFast/ReleaseSmall, bounds checking is disabled; verify correctness does not depend on runtime checks.
- **Integer overflow**: checked by default in Debug/ReleaseSafe, undefined in ReleaseFast. Use `@addWithOverflow`, `@subWithOverflow`, `@mulWithOverflow` for explicit checked arithmetic. Use `+%`, `-%`, `*%` for explicit wrapping.
- **`@intCast`**: UB in ReleaseFast if value does not fit. Validate range before casting.
- **Sentinel-terminated slices**: `@ptrCast` or `@truncate` can lose the sentinel; verify sentinel presence after cast.
- **User input parsing**: use `std.fmt.parseInt`, `std.fmt.parseFloat` with error handling. Validate all fields before use.

## Transport and TLS

- **TLS**: `std.crypto.tls`: uses new `std.Io` interfaces in Zig 0.15. Provides TLS 1.3 client/server.
- **Certificate verification**: verify certificates are validated against a trust store. Flag custom verification that skips checks.
- **HTTP**: `std.http` client and server. Configure timeouts and request size limits.

## Logging

- **`std.log`**: structured logging with log levels (`.err`, `.warn`, `.info`, `.debug`). Verify no secrets in log output.
- **Security events**: log authentication failures, access denials at `.warn` or `.err` level, not `.debug`.
- **Log injection**: `std.log` uses format strings; user input as a format argument could cause issues. Always use `std.log.info("{s}", .{user_input})` not `std.log.info(user_input, .{})`.

## Configuration

- **Build modes**: ReleaseFast disables safety checks. Verify that security-critical code does not rely on safety checks catching errors at runtime.
- **Allocation patterns for secrets**: use a dedicated allocator for secret material. Zero memory on deallocation. Use `defer` for cleanup.
- **Error handling**: `catch unreachable` and `orelse unreachable` are UB in ReleaseFast; verify impossible errors are truly impossible.

## Memory management for secrets

- Allocate key material with explicit lifetime management.
- `defer std.crypto.secureZero(u8, key_slice)` immediately after loading keys.
- Do not store secrets in comptime-known variables (embedded in binary).
- Use `std.heap.page_allocator` for sensitive buffers (avoid general-purpose allocator pooling).
