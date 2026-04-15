# Build System & Compiler/Toolchain

## Root Module Pattern

Executables take a `root_module`, created via `b.createModule()`:

```zig
const exe = b.addExecutable(.{
    .name = "app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
    }),
});
```

Or with dependencies:

```zig
.root_module = b.dependency("name").module("root"),
```

## `zig build` Commands

```
zig build              // Build default step
zig build test         // Run tests
zig build --webui      // Web UI for build progress
zig build --time-report // Detailed timing per step
```

## `zig init`

- Default template shows module + executable pattern
- `--minimal` or `-m` flag generates minimal `build.zig.zon` and `build.zig`

## UBSan Configuration

```zig
.sanitize_c = .full,   // or .trap, or .off
```

The `sanitize_c` field accepts `?std.zig.SanitizeC` (an enum: `.full`, `.trap`, `.off`).

## C Translation via Build System

Use `b.addTranslateC()` to translate C headers:

```zig
const translate_c = b.addTranslateC(.{
    .root_source_file = b.path("src/c.h"),
    .target = target,
    .optimize = optimize,
});

const exe = b.addExecutable(.{
    .name = "app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .imports = &.{
            .{ .name = "c", .module = translate_c.createModule() },
        },
    }),
});
```

Then `const c = @import("c");` in Zig source.

## Unit Test Timeouts

```
zig build test --test-timeout 500ms
```

Forcibly terminates individual test blocks that exceed the timeout.

## Build Error Style

```
zig build --error-style minimal     // compact error output
zig build --error-style verbose     // full context (default)
zig build --multiline-errors indent // align continuation lines (default)
```

Set defaults via `ZIG_BUILD_ERROR_STYLE` and `ZIG_BUILD_MULTILINE_ERRORS` environment variables.

---

## Compiler & Toolchain

### CLI Commands

- `zig test-obj`: Compile test object files for linking without creating executables
- `zig build --webui`: Web interface for build progress
- `zig build --time-report`: Detailed timing per compilation step

### Incremental Compilation

Available via `-fincremental --watch` for automatic incremental rebuilds on source changes. Both the self-hosted backends and the LLVM backend support incremental. Not yet enabled by default.

### Compression: `std.compress.flate`

```zig
var decompress_buffer: [std.compress.flate.max_window_len]u8 = undefined;
var decompress: std.compress.flate.Decompress = .init(reader, .zlib, &decompress_buffer);
const decompress_reader: *std.Io.Reader = &decompress.reader;
```

Compression and checksum calculation are separate from flate (do out-of-band).

### Inline Assembly: Typed Clobbers

```zig
// Clobbers use struct syntax:
// : .{ .rcx = true, .r11 = true }
// Run `zig fmt` for automatic formatting
```

### Integer-to-Float Coercion

Small integer types coerce to floats implicitly when all values fit without rounding:

```zig
var foo_int: u24 = 123;
var foo_float: f32 = foo_int;              // implicit, all u24 values fit in f32

var bar_int: u25 = 123;
var bar_float: f32 = @floatFromInt(bar_int); // explicit, u25 exceeds f32 precision
```

Integer literals that cannot be precisely represented as the target float type produce a compile error:

```zig
// const x: f32 = 123_456_789;  // ERROR: not representable
const x: f32 = 123_456_789.0;   // Use float literal instead
```

### Float Builtins Forward Result Type

`@sqrt`, `@sin`, `@cos`, `@tan`, `@exp`, `@exp2`, `@log`, `@log2`, `@log10`, `@floor`, `@ceil`, `@trunc`, `@round` forward result types through nested builtins:

```zig
const x: f64 = @sqrt(@floatFromInt(N));
```

### Float-to-Integer Conversion

`@floor`, `@ceil`, `@round`, `@trunc` convert floats to integers directly:

```zig
const actual: u8 = @round(12.50);
```

### `@ptrCast` for Single-Item to Slice

Single-item pointers can cast to slices (returns same byte count as operand).
