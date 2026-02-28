# Build System & Compiler/Toolchain

> **Source**: [Zig 0.15.1 Release Notes](https://ziglang.org/download/0.15.1/release-notes.html)

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

---

## Compiler & Toolchain

### x86 Backend Default (Debug Mode)

The self-hosted x86_64 backend is the default for Debug builds (5x faster compilation). Pass `-fllvm` to use LLVM. This applies on most platforms except NetBSD, OpenBSD, and Windows.

### CLI Commands

- `zig test-obj`: Compile test object files for linking without creating executables
- `zig build --webui`: Web interface for build progress
- `zig build --time-report`: Detailed timing per compilation step

### Incremental Compilation (WIP)

Available via `-fincremental -fno-emit-bin` for fast error checking. Not production-ready.

### LLVM 20

Upgraded to LLVM 20.1.8. SPIR-V backend available.

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

Integer literals that cannot be precisely represented as the target float type produce a compile error:

```zig
// const x: f32 = 123_456_789;  // ERROR: not representable
const x: f32 = 123_456_789.0;   // Use float literal instead
```

### `@ptrCast` for Single-Item to Slice

Single-item pointers can cast to slices (returns same byte count as operand).
