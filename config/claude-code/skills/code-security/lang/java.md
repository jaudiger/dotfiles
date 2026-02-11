# Java — Security Patterns

## Valid domains

authn, authz, crypto, input-validation, transport, logging, config

## Cryptography and secure random (Java 25 LTS)

- **CSPRNG**: `java.security.SecureRandom`. Reject: `java.util.Random`, `Math.random()`, `ThreadLocalRandom` for any security purpose.
- **Key Derivation (Java 25)**: `javax.crypto.KDF` — new Key Derivation Function API (finalized in Java 25, JEP 510). Supports HKDF, designed for Argon2 support.
- **Post-quantum (Java 24+)**: ML-KEM via `KeyPairGenerator.getInstance("ML-KEM-768")` / `KeyFactory` (JEP 496). ML-DSA via `Signature.getInstance("ML-DSA-65")` (JEP 497, FIPS 204).
- **Security Manager**: permanently disabled since Java 24 (JEP 486) — no longer a security mechanism. Do not rely on it.
- **Symmetric encryption**: `Cipher.getInstance("AES/GCM/NoPadding")`, `Cipher.getInstance("ChaCha20-Poly1305")`. Reject: `AES/ECB/*`, `DES/*`, `DESede/*`, `RC4`, `Blowfish`.
- **Password hashing**: use bcrypt (`jBCrypt`, Spring Security `BCryptPasswordEncoder`) or argon2 (`argon2-jvm`, `Argon2PasswordEncoder`). Reject: `MessageDigest.getInstance("SHA-256")` alone for passwords.
- **Constant-time comparison**: `MessageDigest.isEqual()`. Reject: `Arrays.equals()`, `String.equals()` on secrets/MACs.
- **Key storage**: `java.security.KeyStore`. Do not hardcode keys in source.
- **OpenSSL 3.5 security level 2**: RSA < 2048 prohibited. Ensure key sizes are sufficient.

## Authentication and session management

- **Spring Security**: `SecurityFilterChain` bean configuration, `@PreAuthorize` / `@Secured` annotations (adapt to detected Spring Boot version). Verify: CSRF enabled by default, session fixation protection (`sessionManagement().sessionFixation().migrateSession()`).
- **JWT**: use a library with signature verification (e.g., `nimbus-jose-jwt`, `jjwt`). Verify algorithm is enforced, `none` algorithm rejected, expiry/audience/issuer checked.
- **Servlet sessions**: `HttpSession.invalidate()` on logout, `request.changeSessionId()` on login (Servlet 3.1+).

## Authorization

- **Spring Security**: `@PreAuthorize("hasRole('ADMIN')")`, method-level security. Verify authorization on every endpoint, not just URL patterns.
- **IDOR**: verify object-level authorization in service methods, not just role checks.
- **Mass assignment**: use DTOs with explicit fields, not `@ModelAttribute` directly binding to entities.

## Input validation

- **SQL injection**: `PreparedStatement` with `?` placeholders. Flag string concatenation in query strings, especially `Statement.execute(userInput)`.
- **XML safety**: `DocumentBuilderFactory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)` — XXE prevention. Flag default `DocumentBuilderFactory.newInstance()` without hardening.
- **Deserialization**: `ObjectInputStream.readObject()` on untrusted data — RCE risk. Use allowlists (`ObjectInputFilter` in Java 9+) or avoid Java serialization. Jackson `@JsonTypeInfo` with `defaultImpl` or polymorphic deserialization: restrict allowed subtypes.
- **JNDI injection**: `InitialContext.lookup(userInput)` — flag always (Log4Shell class vulnerability).
- **Bean Validation**: `@NotNull`, `@Size`, `@Pattern` with `@Valid` on controller parameters.

## Transport and TLS

- **TLS**: `SSLContext.getInstance("TLSv1.3")` or `SSLContext.getInstance("TLSv1.2")`. Flag: `SSLv3`, `TLSv1`, `TLSv1.1`.
- **Certificate verification**: flag custom `TrustManager` that accepts all certificates (`X509TrustManager` with empty `checkServerTrusted`).
- **Hostname verification**: flag `HttpsURLConnection.setHostnameVerifier()` that returns `true` always.

## Logging

- **SLF4J / Logback / Log4j2**: structured logging. Verify no sensitive data (passwords, tokens, PII) in log messages.
- **Log injection**: parameterized logging (`log.info("User: {}", user)`) prevents format string issues but not newline injection — sanitize user input.
- **Log4j2**: verify JNDI lookup is disabled (`log4j2.formatMsgNoLookups=true` or latest patched version).

## Common frameworks

- **Spring Boot**: security auto-configuration, actuator endpoint protection, CSRF, CORS.
- **Jakarta EE**: security annotations, container-managed auth, JAAS.
- **Micronaut / Quarkus**: annotation-based security, verify framework-specific patterns.
