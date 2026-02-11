# Cryptography & Secret Management

## Scope

Algorithm selection, key management, secure random number generation, hardcoded secrets, key/secret zeroing, IV/nonce handling, hash function usage, constant-time comparison, and environment variable / secret manager integration.

## Systematic Procedure

### Step 1 — Identify cryptographic operations

Scan the file for every call that:

1. Encrypts or decrypts data (symmetric or asymmetric).
2. Generates or verifies digital signatures or MACs.
3. Hashes data (for integrity, password storage, or key derivation).
4. Generates random values for security purposes (tokens, keys, nonces, IVs).
5. Stores, reads, or transmits secrets (API keys, passwords, private keys, tokens).

Record each with its line number and the specific function/API used.

### Step 2 — Check algorithm selection

For each cryptographic operation:

1. **Symmetric encryption**: is an AEAD mode used? Acceptable: AES-GCM, ChaCha20-Poly1305, AEGIS. Reject: DES, 3DES, RC4, Blowfish, AES-ECB, AES-CBC without separate MAC.
2. **Asymmetric encryption**: is the algorithm current? Acceptable: RSA >= 2048 bits with OAEP, ECIES, X25519. Reject: RSA < 2048, RSA PKCS#1 v1.5 encryption.
3. **Digital signatures**: acceptable: Ed25519, ECDSA (P-256+), RSA >= 2048 with PSS. Reject: RSA PKCS#1 v1.5 signatures (context-dependent).
4. **Hash functions**: SHA-256, SHA-3, BLAKE2/BLAKE3 for integrity. bcrypt, argon2, scrypt for passwords. Reject: MD5, SHA1 for any security purpose.
5. **Key derivation**: HKDF, PBKDF2 (high iteration count), argon2. Reject: single-pass hash of password.

### Step 3 — Check random number generation

1. Is a CSPRNG used for all security-relevant random values? Flag use of non-cryptographic PRNGs (math/rand, random, srand/rand, std.rand).
2. Is the random source properly seeded (or OS-provided)?
3. Are tokens, session IDs, and nonces generated from the CSPRNG with sufficient length (>= 128 bits)?

### Step 4 — Check for hardcoded secrets

1. Search for string literals that look like keys, passwords, tokens, API keys, or connection strings.
2. Check for secrets in constants, default parameter values, comments, or configuration files committed to source.
3. Check for private keys or certificates embedded in source code.
4. Verify that secrets come from environment variables, secret managers, or encrypted configuration.

### Step 5 — Check key management

1. Are keys generated from a CSPRNG with appropriate length for the algorithm?
2. Are keys stored securely (not in source, not in plaintext config)?
3. Is key rotation supported (key versioning, re-encryption path)?
4. Are expired or compromised keys revocable?

### Step 6 — Check IV/nonce handling

1. Is the IV/nonce generated from a CSPRNG for each encryption operation?
2. Is nonce reuse prevented? (For AES-GCM, nonce reuse is catastrophic — authentication and confidentiality are both lost.)
3. Is the IV/nonce of the correct size for the algorithm?
4. For counter-based modes: is the counter managed to prevent rollover?

### Step 7 — Check secret zeroing and lifetime

1. Are keys, passwords, and other secrets zeroed from memory after use?
2. Are secure zeroing functions used (not standard memset, which may be optimized away)?
3. Are secrets kept in memory for the minimum necessary duration?

### Step 8 — Check constant-time operations

1. Are secrets, MACs, and hashes compared using constant-time comparison functions?
2. Flag standard equality operators (`==`, `!=`, `memcmp`, `.equals()`) on secret values.
3. Are there other secret-dependent branches or early returns that could leak information via timing?

## Reporting

For each finding, state:
- The cryptographic operation (file, line, function/API).
- The specific weakness (e.g., "AES-ECB used for encryption — no semantic security").
- A concrete attack scenario (e.g., "identical plaintext blocks produce identical ciphertext, revealing patterns").
- Suggested fix (switch to AES-GCM, use CSPRNG for nonce generation).

If no issues are found, state: "No cryptography issues found in [file]" and briefly explain why the code is correct for this domain.
