# TypeScript — Security Patterns

## Valid domains

authn, authz, crypto, input-validation, transport, logging, config

## Cryptography and secure random (Node.js 22+ LTS)

- **CSPRNG**: `crypto.randomBytes()`, `crypto.randomUUID()`, `crypto.randomInt()`. Web Crypto API: `crypto.getRandomValues()`. Reject: `Math.random()` for any security purpose.
- **Constant-time comparison**: `crypto.timingSafeEqual()`. Reject: `===`, `==`, `Buffer.compare()` on secrets/MACs.
- **Password hashing**: `bcrypt` package (`bcrypt.hash` with saltRounds >= 10), `argon2` package. Web Crypto API supports Argon2 algorithms. Reject: plain SHA256/MD5 of password.
- **Symmetric encryption**: `crypto.createCipheriv('aes-256-gcm', ...)` with AEAD. Reject: `aes-256-cbc` without separate MAC, `des`, `rc4`, `createCipher()` (deprecated, derives key from password with MD5).
- **Node.js 24 LTS**: uses OpenSSL 3.5, security level 2 — RSA < 2048 and RC4 prohibited.
- **Key/secret handling**: avoid storing secrets in `string` (immutable, not zeroable). Use `Buffer` and fill with zero after use (`buf.fill(0)`). Consider `sodium-native` for secure memory.

## Authentication and session management

- **JWT**: `jsonwebtoken.verify(token, secret, { algorithms: ['HS256'] })` with explicit algorithm. Reject: `jsonwebtoken.decode(token)` for trusted decisions (no signature verification), accepting `none` algorithm.
- **Session**: `express-session` with secure configuration: `{ secret: fromEnv, cookie: { secure: true, httpOnly: true, sameSite: 'strict' }, resave: false, saveUninitialized: false }`.
- **Password storage**: never store plaintext. Use bcrypt or argon2 with sufficient cost factor.

## Authorization

- **Express**: middleware-based auth (`app.use(authMiddleware)` before route handlers). Verify middleware ordering.
- **Next.js**: middleware for auth, `getServerSideProps` / Server Components for server-side checks. Reject: client-only auth checks.
- **IDOR**: verify object-level authorization in route handlers, not just authentication.
- **Mass assignment**: use explicit destructuring or validation (zod, joi) to restrict accepted fields.

## Input validation

- **Schema validation**: `zod`, `joi`, `yup`, `ajv` for runtime validation. Validate at system boundaries (API handlers, form submissions).
- **SQL injection**: use parameterized queries via ORM (Prisma, TypeORM, Knex `?` placeholders). Flag: template literals in SQL (`\`SELECT * FROM ${table}\``).
- **Command injection**: `child_process.execFile('cmd', [arg1, arg2])` (safe). Reject: `child_process.exec(userInput)`, `child_process.execSync(cmd + userInput)`.
- **XSS**: `DOMPurify` for HTML sanitization. Flag: `innerHTML`, `dangerouslySetInnerHTML`, `document.write()` with user input.
- **Path traversal**: `path.join(base, userInput)` does not prevent `..`. Use `path.resolve()` then verify `result.startsWith(base)`.
- **Regex DoS**: `new RegExp(userInput)` — flag always. Use `validator.js` or `re2` for safe regex on user input.
- **Prototype pollution**: flag `Object.assign(target, userInput)`, `_.merge(target, userInput)`, `JSON.parse` spread into objects without validation.

## Transport and TLS

- **HTTPS**: `https.createServer()` with TLS configuration. Set `minVersion: 'TLSv1.2'` on `tls.createSecureContext()`.
- **Certificate verification**: flag `NODE_TLS_REJECT_UNAUTHORIZED=0`, `rejectUnauthorized: false` in production.
- **HTTP security headers**: `helmet` middleware — enables HSTS, CSP, X-Frame-Options, X-Content-Type-Options, etc. Verify it is applied to all routes.
- **CORS**: `cors` middleware. Flag: `origin: '*'` with `credentials: true`. Use explicit origin allowlist.
- **Cookie flags**: `express-session` or `cookie-parser` with `{ secure: true, httpOnly: true, sameSite: 'strict' }`.
- **SSRF**: validate URL scheme and hostname before `fetch(userUrl)` or `axios.get(userUrl)`.

## Logging

- **Winston / Pino**: structured logging. Use redaction features (`pino` `redact` option) for sensitive fields.
- **console.log**: avoid in production. May accidentally log sensitive data without redaction.
- **Log injection**: structured JSON logging prevents newline injection. Flag: string-interpolated log messages with user input.

## Configuration

- **Environment**: `process.env.SECRET`. Verify secrets not hardcoded. Use `dotenv` for development only, do not commit `.env`.
- **Debug mode**: `NODE_ENV !== 'production'` checks. Verify error handler returns generic messages in production.
- **Rate limiting**: `express-rate-limit` on auth endpoints. Configure `windowMs`, `max`, `standardHeaders`.
- **Error responses**: do not expose stack traces in production. Use generic error middleware.

## Common frameworks

- **Express**: `helmet` for headers, `cors` for CORS, `express-rate-limit` for throttling, `csurf` or `csrf-csrf` for CSRF.
- **Next.js**: middleware for auth, CSP via `next.config.js` headers, server actions security.
- **Fastify**: schema validation built-in, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors`.
- **NestJS**: guards for auth, interceptors for logging, pipes for validation, `@nestjs/throttler` for rate limiting.
