# C: Security Patterns

## Valid domains

authn, authz, crypto, input-validation, transport, logging, config

## Cryptography and secure random

- **CSPRNG**: `arc4random()`, `arc4random_buf()`, `getrandom()` (Linux), `getentropy()`. Reject: `rand()`, `srand()`, `random()`, `srandom()` for any security purpose.
- **Secure zeroing**: C23 `memset_explicit()` is the preferred portable approach. Fallbacks by platform: `explicit_bzero()` (POSIX), `OPENSSL_cleanse()` (OpenSSL), `SecureZeroMemory()` (Windows). For pre-C23 without platform APIs, the volatile function pointer pattern (`*(volatile memset_t)memset`). Reject: plain `memset()`: the compiler may optimize it away when the buffer is not subsequently read.
- **Constant-time comparison**: `CRYPTO_memcmp()` (OpenSSL), `sodium_memcmp()` (libsodium). Reject: `memcmp()`, `strcmp()`: timing side channels on secret data.
- **Symmetric encryption**: OpenSSL 3.x EVP API (`EVP_EncryptInit_ex2`, `EVP_AEAD`), libsodium `crypto_aead_*` (XChaCha20-Poly1305, AES-GCM). Reject: DES, RC4, Blowfish, raw ECB mode.
- **Random bytes**: `RAND_bytes()` (OpenSSL), `randombytes_buf()` (libsodium). Reject: `RAND_pseudo_bytes()` (deprecated).
- **Hashing**: `EVP_Digest*()` (OpenSSL), `crypto_generichash()` (libsodium BLAKE2b). Reject: MD5, SHA1 for security purposes.
- **Password hashing**: `crypto_pwhash()` (libsodium; Argon2id), or bcrypt via system `crypt_r()`. Reject: plain SHA256/SHA512 of password.

## Input validation and buffer safety

- `snprintf()` vs `sprintf()`: always prefer bounded variants. `sprintf()` is unbounded; buffer overflow.
- `strlcpy()` / `strlcat()` vs `strcpy()` / `strcat()`: prefer bounded versions. Not available on all platforms; check for `_BSD_SOURCE` or use `snprintf()`.
- Format string attacks: `printf(user_input)` paired with `printf("%s", user_input)`. Any function in the `printf` family with user-controlled format string.
- Integer overflow before allocation: `malloc(n * sizeof(T))`: if `n * sizeof(T)` overflows, allocation is too small. Use `calloc(n, sizeof(T))` or checked multiplication.
- Path traversal: `snprintf(path, ..., "%s/%s", base, user_input)`: validate for `..`, null bytes, symlinks. Use `realpath()` then check prefix.

## Transport and TLS

- OpenSSL TLS: `SSL_CTX_set_min_proto_version(ctx, TLS1_2_VERSION)`. Reject: SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1.
- Certificate verification: `SSL_CTX_set_verify(ctx, SSL_VERIFY_PEER, NULL)`. Flag: `SSL_VERIFY_NONE` in production.
- Hostname verification: `SSL_set1_host()` or `X509_check_host()`. Missing hostname check means MITM is possible even with certificate verification.

## Command execution

- `system()`, `popen()`: shell command injection. Use `execve()` / `execvp()` with argument array.
- `dlopen()` with user-controlled path: code injection. Validate path against allowlist.

## Common frameworks

- OpenSSL 3.x: provider-based architecture. Use `EVP_*` APIs, not deprecated low-level APIs (`DES_*`, `RC4`, `BF_*`).
- libsodium: high-level API preferred (`crypto_secretbox`, `crypto_box`, `crypto_sign`, `crypto_pwhash`).
- mbedTLS: `mbedtls_ssl_config_defaults()` with appropriate security profile.
