---
name: lang-zig-upgrade-0.16
description: >
  Upgrade Zig 0.15 code to 0.16. Applies API migrations for I/O, build system,
  type construction, packed types, containers, and more. Provide file or directory
  targets. Run /zig-upgrade-0.16 for usage.
argument-hint: "[targets...]"
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# Zig 0.15 to 0.16 Upgrade

## Interactive mode (no arguments)

If the user did not provide targets, use Glob to find `*.zig` and `build.zig`
files in the workspace and list them as suggestions. Ask the user which files
to upgrade. Do NOT use the AskUserQuestion tool; output the list as formatted
text directly in the conversation.

## Procedure

### Step 1 -- Discover scope

Read each target file. Grep all targets for the migration markers listed in the
reference below. Build a list of required migrations per file.

### Step 2 -- Apply migrations

For each file, apply every applicable migration from the reference. Work one
migration category at a time across all files, so related changes stay
consistent. After each category, re-read affected sections to confirm
correctness.

### Step 3 -- Verify

Run `zig build` (or `zig test` if tests exist) and report results. Fix any
compile errors that stem from incomplete migration.

## Rules

- Only touch code that matches a migration pattern. Do not refactor unrelated
  code.
- Preserve existing formatting and style.
- When a migration has multiple valid approaches, pick the simplest one.
- If a file uses `@cImport`, flag it but do not auto-migrate (requires
  build.zig changes the user must review).
- If unsure whether a pattern applies, skip it and flag it for the user.

---

## Migration Reference

### I/O: `std.Io` is now required

All I/O operations require an `Io` instance.

**Main function**

```zig
// 0.15
pub fn main() !void { ... }

// 0.16
pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;
    ...
}
```

When `Io` is unavailable outside main:

```zig
var threaded: std.Io.Threaded = .init_single_threaded;
const io = threaded.io();
```

In tests: `const io = std.testing.io;`

### Namespace: `std.fs` to `std.Io`

| 0.15 | 0.16 |
|------|------|
| `std.fs.File` | `std.Io.File` |
| `std.fs.Dir` | `std.Io.Dir` |
| `std.fs.cwd()` | `std.Io.Dir.cwd()` |
| `std.fs.File.stdout()` | `std.Io.File.stdout()` |
| `std.fs.File.Mode` | `std.Io.File.Permissions` |
| `std.fs.path` | `std.Io.Dir.path` |

Most file/dir methods now take an `io` parameter:

```zig
// 0.15
file.close();
dir.makeDir("foo");

// 0.16
file.close(io);
dir.createDir(io, "foo");
```

Key method renames:

| 0.15 | 0.16 |
|------|------|
| `Dir.makeDir` | `Dir.createDir` |
| `Dir.makePath` | `Dir.createDirPath` |
| `File.setEndPos` | `File.setLength` |
| `File.getEndPos` | `File.length` |
| `File.read` | `File.readStreaming` |
| `File.writeAll` | `File.writeStreamingAll` |

### Writer/Reader

Writer creation now takes `io`:

```zig
// 0.15
var w = file.writer(&buffer);

// 0.16
var w = file.writer(io, &buffer);
```

`FixedBufferStream` is gone. Use `.fixed()`:

```zig
// 0.15
var fbs = std.io.fixedBufferStream(data);
const reader = fbs.reader();

// 0.16
var reader: std.Io.Reader = .fixed(data);
var writer: std.Io.Writer = .fixed(buffer);
```

`std.io` namespace is now `std.Io`.

### `@Type` to individual builtins

| 0.15 | 0.16 |
|------|------|
| `@Type(.{ .int = .{ .signedness = s, .bits = b } })` | `@Int(s, b)` |
| `@Type(.{ .@"struct" = ... })` | `@Struct(layout, BackingInt, &names, &types, &attrs)` |
| `@Type(.{ .@"union" = ... })` | `@Union(layout, ArgType, &names, &types, &attrs)` |
| `@Type(.{ .@"enum" = ... })` | `@Enum(TagInt, mode, &names, &values)` |
| `@Type(.{ .@"fn" = ... })` | `@Fn(&param_types, &param_attrs, ReturnType, attrs)` |
| `@Type(.{ .pointer = ... })` | `@Pointer(size, attrs, Element, sentinel)` |
| `@Type(.enum_literal)` | `@EnumLiteral()` |
| `std.meta.Int(s, b)` | `@Int(s, b)` |
| `std.meta.Tuple(types)` | `@Tuple(types)` |

Use `&@splat(.{})` for default field attributes.

For types without a builtin, use literal syntax: `opaque {}`, `?T`, `E!T`,
`error{ ... }`, `[len]Elem`.

Error set reification via `@Type` is no longer possible; use `error{ ... }`
syntax.

### `@intFromFloat` to `@trunc`

```zig
// 0.15
const n: u8 = @intFromFloat(val);

// 0.16
const n: u8 = @trunc(val);
```

`@floor`, `@ceil`, `@round`, `@trunc` all convert floats to integers directly.

### `@cImport` to build system

Flag any `@cImport` usage. The migration requires build.zig changes:

```zig
// build.zig
const translate_c = b.addTranslateC(.{
    .root_source_file = b.path("src/c.h"),
    .target = target,
    .optimize = optimize,
});
// then add .imports = &.{ .{ .name = "c", .module = translate_c.createModule() } }
// to the root module

// source.zig: @cImport(...) becomes @import("c")
```

### Packed types

Packed unions need an explicit backing integer. All fields must match its
`@bitSizeOf`:

```zig
// 0.15
const U = packed union { x: u8, y: u16 };

// 0.16
const U = packed union(u16) {
    x: packed struct(u16) { data: u8, padding: u8 = 0 },
    y: u16,
};
```

Pointers in `packed struct`/`packed union` fields are not allowed. Use `usize`
with `@ptrFromInt`/`@intFromPtr`.

Enums and packed types with implicit backing types cannot be exported. Add an
explicit backing type:

```zig
// 0.15
const E = enum { a, b };
export var e: E = .a;

// 0.16
const E = enum(u8) { a, b };
export var e: E = .a;
```

### Containers: managed to unmanaged

| 0.15 | 0.16 |
|------|------|
| `std.ArrayHashMap(K, V, ctx, max)` | `std.array_hash_map.Custom(K, V, ctx, max)` |
| `std.AutoArrayHashMap(K, V)` | `std.array_hash_map.Auto(K, V)` |
| `std.StringArrayHashMap(V)` | `std.array_hash_map.String(V)` |

`PriorityQueue` and `PriorityDequeue` no longer store an allocator. Pass it at
each call site.

| 0.15 | 0.16 |
|------|------|
| `.init(allocator, ...)` | `.empty` (then pass allocator to `push`, etc.) |
| `.add(item)` | `.push(allocator, item)` |
| `.remove()` / `.removeOrNull()` | `.pop(allocator)` |

### Entropy

```zig
// 0.15
std.crypto.random.bytes(&buffer);

// 0.16
io.random(&buffer);
```

For `std.Random` interface:

```zig
const rng_impl: std.Random.IoSource = .{ .io = io };
const rng = rng_impl.interface();
```

### Time

| 0.15 | 0.16 |
|------|------|
| `std.time.Instant` | `std.Io.Timestamp` |
| `std.time.Timer` | `std.Io.Timestamp` |
| `std.time.timestamp` | `std.Io.Timestamp.now` |

### Process

```zig
// 0.15
var child = std.process.Child.init(argv, gpa);
child.stdin_behavior = .Pipe;
try child.spawn();

// 0.16
var child = try std.process.spawn(io, .{
    .argv = argv,
    .stdin = .pipe,
});
```

`std.process.execv` is now `std.process.replace(io, .{ .argv = argv })`.

Environment variables are no longer global. Access them via
`init.environ_map` from Juicy Main, or accept `*const process.Environ.Map` as
a parameter.

### Sync primitives

| 0.15 | 0.16 |
|------|------|
| `std.Thread.ResetEvent` | `std.Io.Event` |
| `std.Thread.WaitGroup` | `std.Io.Group` |
| `std.Thread.Futex` | `std.Io.Futex` |
| `std.Thread.Mutex` | `std.Io.Mutex` |
| `std.Thread.Condition` | `std.Io.Condition` |
| `std.Thread.Semaphore` | `std.Io.Semaphore` |
| `std.Thread.RwLock` | `std.Io.RwLock` |
| `std.Thread.Pool` | `std.Io.Group` (with `io.async`) |

Lock-free primitives (`std.atomic`) do not need `Io`.

### HTTP client

```zig
// 0.15
var client = std.http.Client{ .allocator = gpa };
var req = try client.request(.GET, uri, .{});

// 0.16
var client: std.http.Client = .{ .allocator = gpa, .io = io };
var req = try client.request(.HEAD, .{
    .scheme = "http",
    .host = .{ .percent_encoded = host_name.bytes },
    .port = 80,
    .path = .{ .percent_encoded = "/" },
}, .{});
```

### fmt renames

| 0.15 | 0.16 |
|------|------|
| `std.fmt.Formatter` | `std.fmt.Alt` |
| `std.fmt.format(writer, ...)` | `writer.print(...)` |
| `std.fmt.FormatOptions` | `std.fmt.Options` |
| `std.fmt.bufPrintZ` | `std.fmt.bufPrintSentinel` |

### mem renames

"index of" functions are now "find":

| 0.15 | 0.16 |
|------|------|
| `std.mem.indexOf` | `std.mem.find` |
| `std.mem.indexOfScalar` | `std.mem.findScalar` |
| `std.mem.lastIndexOf` | `std.mem.findLast` |
| `std.mem.lastIndexOfScalar` | `std.mem.findLastScalar` |

New: `std.mem.cut`, `cutPrefix`, `cutSuffix`, `cutScalar`, `cutLast`,
`cutLastScalar`.

### BitSet / EnumSet initialization

```zig
// 0.15
var set = std.BitSet.initEmpty();

// 0.16
var set: std.BitSet = .{};
```

### Miscellaneous

| 0.15 | 0.16 |
|------|------|
| `std.process.getCwd(buf)` | `std.process.currentPath(io, buf)` |
| `std.process.getCwdAlloc(a)` | `std.process.currentPathAlloc(io, a)` |
| `std.fs.openSelfExe()` | `std.process.openExecutable()` |
| `std.fs.selfExePathAlloc(a)` | `std.process.executablePathAlloc(a)` |
| `std.fs.getAppDataDir(...)` | use third-party `known-folders` package |
| `LLVM 20` | `LLVM 21` (Clang 21.1.8) |

### Grep patterns for discovery

Use these patterns to find code that needs migration:

```
std\.fs\.File
std\.fs\.Dir
std\.fs\.cwd
std\.io\.
@Type\(
@intFromFloat
@cImport
std\.crypto\.random
std\.time\.Instant
std\.time\.Timer
std\.process\.Child
std\.Thread\.Pool
std\.Thread\.Mutex[^.]
std\.Thread\.ResetEvent
std\.Thread\.WaitGroup
std\.fmt\.Formatter
std\.fmt\.format\(
std\.fmt\.FormatOptions
std\.fmt\.bufPrintZ
std\.mem\.indexOf
std\.mem\.lastIndexOf
std\.meta\.Int
std\.meta\.Tuple
std\.ArrayHashMap
std\.AutoArrayHashMap
std\.StringArrayHashMap
SegmentedList
initEmpty\(\)
initFull\(\)
std\.process\.getCwd
std\.process\.execv
std\.os\.environ
heap\.ThreadSafe
```
