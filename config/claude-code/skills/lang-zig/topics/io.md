# I/O System, Format Strings & HTTP

## The `std.Io` Type

All I/O requires an `Io` instance. Anything that potentially blocks control flow or introduces nondeterminism is owned by the I/O interface.

### Obtaining `Io`

In application `main` via Juicy Main:

```zig
pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;
    // init also provides: .arena, .environ_map, .preopens, .minimal.args
}
```

Workaround when `Io` is unavailable (like reaching for `page_allocator`):

```zig
const Io = std.Io;
var threaded: Io.Threaded = .init_single_threaded;
const io = threaded.io();
```

In tests:

```zig
const io = std.testing.io;
```

---

## Buffered I/O

The I/O paradigm is **"buffer in the interface"**: the caller provides the buffer, not the implementation.

### Writer Pattern

For a buffered writer backed by an in-memory buffer:

```zig
var buffer: [4096]u8 = undefined;
var writer: std.Io.Writer = .fixed(&buffer);
try writer.print("Hello {s}\n", .{"world"});
// writer.buffered() returns the written slice
```

For direct output to stdout, call the File's streaming write (vectored):

```zig
_ = try std.Io.File.stdout().writeStreaming(io, &.{"Hello, world!\n"});
```

### Reader Pattern

```zig
var recv_buffer: [4096]u8 = undefined;
var file_reader = file.reader(io, &recv_buffer);
const reader: *std.Io.Reader = &file_reader.interface;
```

### Key Concepts

- **`std.Io.Reader`** and **`std.Io.Writer`** are **non-generic concrete types**
- The caller provides the buffer (passed to `.fixed(buf)` or to `file.reader(io, buf)`)
- For wrappers over a file, access the interface via the `.interface` field
- Always call `.flush()` when done writing
- Most I/O operations include `error.Canceled` in their error sets for cancelation support

### Fixed-Buffer I/O

```zig
var reader: std.Io.Reader = .fixed(data);
var writer: std.Io.Writer = .fixed(buffer);
```

### Notable Types

- **`std.Io.Writer.Discarding`**: A writer that discards output but counts bytes written
- **`std.Io.Reader.Limited`**: A reader that limits how many bytes can be read from an underlying reader

---

## Format Strings & Custom Formatting

### Format Specifiers

| Specifier | Purpose |
|-----------|---------|
| `{f}` | Calls the value's `format` method |
| `{any}` | Skips format methods, uses default |
| `{t}` | Shorthand for `@tagName()` / `@errorName()` |
| `{d}` | Decimal (supports custom `formatNumber` method) |
| `{b64}` | Standard base64 encoding |
| `{B}` | Integer size in decimal (bytes) |
| `{Bi}` | Integer size in binary (bytes) |
| `{D}` | Duration formatting (nanoseconds) |
| `{x}` / `{X}` | Hex lower/upper (works on integers, floats, and byte slices) |
| `{b}` | Binary |
| `{o}` | Octal |
| `{e}` / `{E}` | Scientific notation lower/upper |
| `{c}` | ASCII byte as character |
| `{u}` | u21 Unicode codepoint |
| `{s}` | String (pointers, arrays) |
| `{*}` | Address/pointer value |
| `{?}` | Optional |
| `{!}` | Error union |

### Custom Format Method Signature

```zig
pub fn format(self: @This(), writer: *std.Io.Writer) std.Io.Writer.Error!void {
    try writer.print("MyType({})", .{self.value});
}
```

Use `{f}` to invoke it: `try writer.print("{f}", .{my_value});`

Code written for Zig 0.15 and earlier uses a different signature:

```zig
pub fn format(
    self: @This(),
    comptime fmt: []const u8,
    options: std.fmt.FormatOptions,
    writer: anytype,
) !void { ... }
```

When porting such code to 0.16+, change `writer: anytype` to `writer: *std.Io.Writer`, drop the `fmt` and `options` parameters, narrow the return type to `std.Io.Writer.Error!void`, and switch call sites from `{}` to `{f}`.

### Alternatives for Multiple Format Modes

Since the format signature does not accept format strings, use one of:

**1. Multiple format methods:**
```zig
pub fn format(self: @This(), writer: *std.Io.Writer) std.Io.Writer.Error!void { ... }
pub fn formatVerbose(self: @This(), writer: *std.Io.Writer) std.Io.Writer.Error!void { ... }
```

**2. `std.fmt.Alt` wrapper:**
```zig
const MyType = struct {
    number: u8,

    pub fn formatAlt(self: MyType, writer: *std.Io.Writer) std.Io.Writer.Error!void {
        try writer.writeByte(self.number);
    }
};

// Use std.fmt.alt (lowercase) to create an instance with an alternate format method:
try writer.print("{f}", .{std.fmt.alt(my_value, .formatAlt)});

// Or construct the type explicitly:
const AltFormatter = std.fmt.Alt(MyType, MyType.formatAlt);
const wrapped: AltFormatter = .{ .data = my_value };
try writer.print("{f}", .{wrapped});
```

**3. Return a struct with a format method:**
```zig
pub fn fmtDetailed(self: @This()) FmtDetailed {
    return .{ .inner = self };
}
const FmtDetailed = struct {
    inner: MyType,
    pub fn format(self: FmtDetailed, writer: *std.Io.Writer) std.Io.Writer.Error!void { ... }
};
```

### Format Utilities

- `std.ascii.hexEscape(bytes, case)`: Escape non-printable bytes as `\xNN`
- `std.zig.fmtString(bytes)`: Escape bytes as Zig string literal content
- `std.fmt.bufPrintSentinel`: Format into buffer with sentinel

---

## HTTP Client & Server

HTTP client and server operate on I/O streams (`std.Io.Reader` / `std.Io.Writer`), not `std.net` directly.

### Client Pattern

```zig
var http_client: std.http.Client = .{ .allocator = gpa, .io = io };
defer http_client.deinit();

var request = try http_client.request(.HEAD, .{
    .scheme = "http",
    .host = .{ .percent_encoded = host_name.bytes },
    .port = 80,
    .path = .{ .percent_encoded = "/" },
}, .{});
defer request.deinit();

try request.sendBodiless();

var redirect_buffer: [1024]u8 = undefined;
const response = try request.receiveHead(&redirect_buffer);
```

### Server Pattern

```zig
var recv_buffer: [4000]u8 = undefined;
var send_buffer: [4000]u8 = undefined;
var conn_reader = connection.stream.reader(&recv_buffer);
var conn_writer = connection.stream.writer(&send_buffer);
var server = std.http.Server.init(&conn_reader.interface, &conn_writer.interface);
```

### TLS Client

Operates only on `std.Io.Reader` / `std.Io.Writer`, independent of `std.net` or `std.fs`.
