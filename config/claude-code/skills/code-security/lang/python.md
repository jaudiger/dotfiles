# Python: Security Patterns

## Valid domains

authn, authz, crypto, input-validation, transport, logging, config

## Cryptography and secure random (Python 3.13+)

- **CSPRNG**: `secrets` module (`secrets.token_bytes()`, `secrets.token_hex()`, `secrets.token_urlsafe()`, `secrets.choice()`). Reject: `random` module for any security purpose (predictable PRNG).
- **Password hashing**: `bcrypt` package (`bcrypt.hashpw`, `bcrypt.checkpw`), `argon2-cffi` (`argon2.PasswordHasher`). Reject: `hashlib.sha256(password)` alone, `crypt` module (removed in Python 3.13).
- **Constant-time comparison**: `hmac.compare_digest()`. Reject: `==` on secrets, tokens, MACs, hashes.
- **hashlib**: uses HACL* verified implementations since Python 3.12 for SHA1/SHA2/SHA3/MD5. Still reject MD5/SHA1 for security purposes (algorithm weakness, not implementation).
- **Cryptography package**: third-party `cryptography` library. Removed CAST5/SEED/IDEA/Blowfish ciphers. Added Argon2id support (requires OpenSSL 3.2+). Use `Fernet` for symmetric encryption (AES-CBC + HMAC, high-level), or `AESGCM`/`ChaCha20Poly1305` for AEAD.
- **Key/secret zeroing**: Python does not make this easy (immutable strings, GC). Avoid storing secrets in `str`: use `bytes`/`bytearray` and zero manually. Consider `SecretStr` from pydantic for API boundaries.

## Authentication and session management

- **Django**: `django.contrib.auth`: uses PBKDF2 by default, supports bcrypt/argon2 via `PASSWORD_HASHERS` setting. Verify `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`.
- **Flask**: `Flask-Login` for session management, `Flask-Security` or `Flask-HTTPAuth` for auth. Verify `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, secret key not hardcoded.
- **JWT**: `PyJWT`: use `jwt.decode(token, key, algorithms=["HS256"])` with explicit algorithm. Reject: `jwt.decode(token, options={"verify_signature": False})` for trusted decisions.

## Authorization

- **Django**: `@login_required`, `@permission_required`, `has_perm()` checks. Verify object-level permissions (django-guardian or custom).
- **Flask**: `@login_required` decorator, custom authorization decorators. Verify server-side checks on every request.
- **IDOR**: verify that object retrieval includes ownership/permission check, not just `Model.objects.get(id=user_input)`.

## Input validation

- **SQL injection**: Django ORM and SQLAlchemy use parameterized queries by default. Flag: `raw()`, `execute()` with string formatting (`f"SELECT ... {user_input}"`, `"SELECT ... " + user_input`, `"SELECT ... %s" % user_input`).
- **Command injection**: `subprocess.run(["cmd", arg1, arg2], shell=False)` (safe). Reject: `subprocess.run(cmd_string, shell=True)`, `os.system()`, `os.popen()`. Use `shlex.quote()` if shell is unavoidable.
- **XML safety**: use `defusedxml` for safe XML parsing (XXE prevention). Reject: `xml.etree.ElementTree`, `xml.sax`, `xml.dom` on untrusted input without hardening.
- **YAML safety**: `yaml.safe_load()` / `yaml.SafeLoader`. Reject: `yaml.load()` / `yaml.unsafe_load()` / `yaml.FullLoader` on untrusted data.
- **Deserialization**: `pickle.load()` / `pickle.loads()` on untrusted data; arbitrary code execution. Flag always on external input.
- **Schema validation**: `pydantic` (v2 preferred), `marshmallow`, `cerberus`, Django Forms/Serializers for input validation at system boundaries.
- **Path traversal**: `os.path.join(base, user_input)`: does not prevent `..`. Use `os.path.realpath()` then verify `os.path.commonpath()`.

## Transport and TLS

- **TLS verification**: `requests` verifies certificates by default. Flag: `requests.get(url, verify=False)`, `urllib3.disable_warnings()`.
- **SSL context**: `ssl.create_default_context()` is secure by default. Flag: `ssl.SSLContext()` without setting `check_hostname` and `verify_mode`.
- **Minimum TLS**: `context.minimum_version = ssl.TLSVersion.TLSv1_2`.

## Logging

- **logging module**: use `logging.getLogger()` with parameterized messages (`logger.info("User %s logged in", user_id)`). Verify no secrets/PII in log output.
- **Django**: `LOGGING` setting. Verify `DEBUG = False` in production.
- **Structured logging**: `structlog`, `python-json-logger`. Use sensitive field filtering.

## Configuration

- **Django**: `DEBUG = False` in production, `SECRET_KEY` from environment (not hardcoded), `ALLOWED_HOSTS` configured, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`.
- **Flask**: `app.debug = False` in production, `SECRET_KEY` from environment.
- **Environment**: `os.environ.get("SECRET")`: verify secrets not in source code or version-controlled `.env` files.

## Common frameworks

- **Django**: security middleware (`SecurityMiddleware`), CSRF protection (`CsrfViewMiddleware`), clickjacking protection (`XFrameOptionsMiddleware`).
- **Flask**: `Flask-Talisman` for security headers, `Flask-WTF` for CSRF, `Flask-Limiter` for rate limiting.
- **FastAPI**: `Depends()` for auth injection, Pydantic for input validation, CORS middleware configuration.
