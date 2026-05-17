# Build System

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

## Compile-time Zig Version Pin

Reject builds run against an unexpected compiler version. Place near the top of `build.zig` so the error fires before any other compilation work:

```zig
const std = @import("std");
const builtin = @import("builtin");

const required_zig = std.SemanticVersion{ .major = 0, .minor = 16, .patch = 0 };

comptime {
    const match =
        required_zig.major == builtin.zig_version.major and
        required_zig.minor == builtin.zig_version.minor and
        required_zig.patch == builtin.zig_version.patch;
    if (!match) @compileError(std.fmt.comptimePrint(
        "unsupported zig version: expected {}, found {}",
        .{ required_zig, builtin.zig_version },
    ));
}
```

## `zig build` Commands

```
zig build              // Build default step
zig build test         // Run tests
```

## `zig init`

- Default template shows module + executable pattern
- `--minimal` or `-m` flag generates minimal `build.zig.zon` and `build.zig`

## UBSan Configuration

```zig
.sanitize_c = .full,   // or .trap, or .off
```

The `sanitize_c` field accepts `?std.zig.SanitizeC` (an enum: `.full`, `.trap`, `.off`).

## Build Options as Importable Module

Pipe build-time values into Zig source by attaching a generated options module:

```zig
const options = b.addOptions();
options.addOption(bool, "enable_metrics", b.option(
    bool,
    "metrics",
    "Enable metrics",
) orelse false);
options.addOption([]const u8, "git_commit", git_commit_sha);

const exe_module = b.createModule(.{ .root_source_file = b.path("src/main.zig") });
exe_module.addOptions("build_options", options);
```

Then import it in Zig source:

```zig
const build_options = @import("build_options");
if (build_options.enable_metrics) { ... }
```

Each `addOption` takes a type, a name, and a comptime-known value. The generated module exposes them as public constants.

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

## Platform-conditional System Linking

Switch on `target.result.os.tag` to pick system libraries per platform:

```zig
const exe = b.addExecutable(.{
    .name = "app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    }),
});
exe.linkLibC();
switch (target.result.os.tag) {
    .windows => {
        exe.linkSystemLibrary("ws2_32");
        exe.linkSystemLibrary("advapi32");
    },
    .macos => exe.linkFramework("CoreFoundation"),
    .linux => {},
    else => {},
}
```

Use `builtin.os.tag` instead of `target.result.os.tag` when the decision concerns the build host rather than the compile target.

## Comptime Platform Dispatch

When a module needs an OS-specific implementation behind a uniform API, dispatch at the top of the module with a comptime `switch` on `builtin.target.os.tag` and re-export the chosen type. The selected branch is resolved at compile time, so the rest of the codebase sees a single name with no runtime cost.

```zig
const std = @import("std");
const builtin = @import("builtin");

const Backend_Linux = @import("backend/linux.zig").Backend;
const Backend_Darwin = @import("backend/darwin.zig").Backend;
const Backend_Windows = @import("backend/windows.zig").Backend;

pub const Backend = switch (builtin.target.os.tag) {
    .linux => Backend_Linux,
    .macos, .ios, .tvos, .watchos => Backend_Darwin,
    .windows => Backend_Windows,
    else => @compileError("Backend is not supported for this platform"),
};
```

The same shape works for any platform-varying value, not just types. A common companion when code reaches below `std.Io` to call `posix.pread` or `posix.pwrite` directly: a single read or write syscall has a platform-specific maximum byte count, and handing the kernel a larger slice can silently short-write. Clamp the slice length at the boundary with the same dispatch:

```zig
pub fn buffer_limit(buffer_len: usize) usize {
    const limit = switch (builtin.target.os.tag) {
        .linux => 0x7ffff000,
        .macos, .ios, .tvos, .watchos => std.math.maxInt(i32),
        else => std.math.maxInt(isize),
    };
    return @min(limit, buffer_len);
}
```

The pattern generalizes well beyond I/O: path separators, threading primitives, and clock sources all use the same module-top dispatch.

## CPU Feature Gating

Encode required CPU features in the target query and restrict allowed targets to a closed allowlist. This rejects unsupported hardware at build time rather than crashing at runtime on a missing instruction:

```zig
const supported = [_]struct { triple: []const u8, features: []const u8 }{
    .{ .triple = "aarch64-linux", .features = "baseline+aes+neon" },
    .{ .triple = "x86_64-linux", .features = "x86_64_v3+aes" },
};

const requested = b.option([]const u8, "target", "Build target") orelse host_triple;

const entry = inline for (supported) |s| {
    if (std.mem.eql(u8, requested, s.triple)) break s;
} else return error.UnsupportedTarget;

const target = b.resolveTargetQuery(try std.Target.Query.parse(.{
    .arch_os_abi = entry.triple,
    .cpu_features = entry.features,
}));
```

Encoding features inside the query removes the need for a runtime feature check; the resolved target is guaranteed to have them.

## Custom Build Steps

When a step does not map onto compile, run, or install (codegen, manifest validation, custom artifact placement), embed `std.Build.Step` in a struct and recover it inside `makeFn` via `@fieldParentPtr`:

```zig
const Generate = struct {
    step: std.Build.Step,
    output_path: []const u8,

    fn make(step: *std.Build.Step, _: std.Build.Step.MakeOptions) !void {
        const self: *@This() = @fieldParentPtr("step", step);
        _ = self;
        // Real work goes here; surface failures with step.fail.
    }
};

fn addGenerate(b: *std.Build, output_path: []const u8) *Generate {
    const gen = b.allocator.create(Generate) catch @panic("OOM");
    gen.* = .{
        .step = std.Build.Step.init(.{
            .id = .custom,
            .name = "generate",
            .owner = b,
            .makeFn = Generate.make,
        }),
        .output_path = output_path,
    };
    return gen;
}
```

The `Step.MakeFn` signature takes a `std.Build.Step.MakeOptions` as its second parameter. Surface a build error with `step.fail("...", .{...})` from inside `make`.

## Unit Test Timeouts

```
zig build test --test-timeout 500ms
```

Forcibly terminates individual test blocks that exceed the timeout.

### Defeating the Test Cache

`run.has_side_effects = true` on a test run step prevents the build cache from skipping it when inputs are unchanged.

```zig
const run_tests = b.addRunArtifact(tests);
if (b.args != null) run_tests.has_side_effects = true;
```

Setting it conditionally on `b.args` defeats the cache when a test filter is supplied, so the same filter actually re-executes. Setting it unconditionally on tests that touch the filesystem, network, or any external state ensures they never get cached.

## Build Error Style

```
zig build --error-style minimal     // compact error output
zig build --error-style verbose     // full context (default)
zig build --multiline-errors indent // align continuation lines (default)
```

Set defaults via `ZIG_BUILD_ERROR_STYLE` and `ZIG_BUILD_MULTILINE_ERRORS` environment variables.

## Incremental Compilation

Available via `-fincremental --watch` for automatic incremental rebuilds on source changes. Both the self-hosted backends and the LLVM backend support incremental. Not yet enabled by default.
