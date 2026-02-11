# Authorization & Access Control

## Scope

Server-side authorization enforcement, insecure direct object references (IDOR), privilege escalation (horizontal and vertical), default-deny patterns, role/permission enforcement, path-based bypass, and mass assignment / overposting.

## Systematic Procedure

### Step 1 — Identify authorization decision points

Scan the file for every location that:

1. Checks whether the current user is allowed to perform an action or access a resource.
2. Maps a request to an object using a user-supplied identifier (ID, slug, path).
3. Assigns, modifies, or checks roles or permissions.
4. Controls access to admin, internal, or privileged functionality.

Record each with its line number and the authorization logic used.

### Step 2 — Verify server-side enforcement

For every action that should be restricted:

1. Is authorization checked on the server for every request, or only enforced by hiding UI elements?
2. Is the check performed before the action is executed (not after)?
3. Does the check use the authenticated user's identity from the session/token, not from a client-supplied field?

### Step 3 — Check for insecure direct object references (IDOR)

For every endpoint that accesses an object by user-supplied identifier:

1. Does the code verify that the authenticated user is authorized to access that specific object?
2. Can a user access another user's resources by changing the ID in the request?
3. Are sequential / predictable IDs used without authorization checks?

### Step 4 — Check for privilege escalation

1. **Horizontal**: can a user access resources belonging to another user at the same privilege level?
2. **Vertical**: can a regular user access admin-level functionality by manipulating requests?
3. Are role checks consistent across all endpoints for the same resource?
4. Can a user self-assign elevated roles or permissions?

### Step 5 — Verify default-deny

1. Is the default behavior to deny access unless explicitly granted?
2. Are new endpoints protected by default, or do they require explicit authorization configuration?
3. Is there a catch-all / fallback that denies unrecognized routes?

### Step 6 — Check for path-based bypass

1. Can authorization be bypassed via URL encoding (e.g., `%2F` for `/`, `%2e%2e` for `..`)?
2. Can authorization be bypassed via parameter pollution or duplicate parameters?
3. Are route parameters validated and normalized before authorization checks?
4. Is path traversal possible to reach protected resources?

### Step 7 — Check for mass assignment / overposting

1. Does the code bind request parameters directly to internal objects without an allowlist?
2. Can a user set fields they should not control (role, isAdmin, price, balance) by adding extra parameters?
3. Are DTOs / schemas used to restrict which fields are accepted from user input?

## Reporting

For each finding, state:
- The authorization decision point (file, line, function).
- The specific weakness (e.g., "no ownership check on object retrieval by ID").
- A concrete attack scenario (e.g., "user A can access user B's records by changing the ID parameter").
- Suggested fix (add ownership check, use default-deny middleware, restrict bindable fields).

If no issues are found, state: "No authorization issues found in [file]" and briefly explain why the code is correct for this domain.
