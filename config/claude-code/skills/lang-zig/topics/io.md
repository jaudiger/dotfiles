# I/O System, Format Strings & HTTP

> **Source**: [Zig 0.15.1 Release Notes](https://ziglang.org/download/0.15.1/release-notes.html)

## I/O System

The I/O paradigm is **"buffer in the interface"**: the caller provides the buffer, not the implementation.

### Writer Pattern

```zig
var stdout_buffer: [4096]u8 = undefined;
var stdout_writer = std.fs.File.stdout().writer(&stdout_buffer);
const stdout: *std.Io.Writer = &stdout_writer.interface;
try stdout.print("Hello {s}\n", .{"world"});
try stdout.flush();
```

### Reader Pattern

```zig
var recv_buffer: [4096]u8 = undefined;
var file_reader = file.reader(&recv_buffer);
const reader: *std.Io.Reader = &file_reader.interface;
```

### Key Concepts

- **`std.Io.Reader`** and **`std.Io.Writer`** are **non-generic concrete types**
- The caller provides the buffer via the `reader()`/`writer()` call
- Access the interface via the `.interface` field
- Always call `.flush()` when done writing

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

---

## HTTP Client & Server

HTTP client and server operate on I/O streams (`std.Io.Reader` / `std.Io.Writer`), not `std.net` directly.

### Server Pattern

```zig
var recv_buffer: [4000]u8 = undefined;
var send_buffer: [4000]u8 = undefined;
var conn_reader = connection.stream.reader(&recv_buffer);
var conn_writer = connection.stream.writer(&send_buffer);
var server = std.http.Server.init(&conn_reader.interface, &conn_writer.interface);
```

### Client Pattern

```zig
var req = try client.request(.GET, uri, .{});
try req.sendBodiless();
var redirect_buffer: [4096]u8 = undefined;
var response = try req.receiveHead(&redirect_buffer);
var reader_buffer: [4096]u8 = undefined;
const body_reader = response.reader(&reader_buffer);
```

### TLS Client

Operates only on `std.Io.Reader` / `std.Io.Writer`, independent of `std.net` or `std.fs`.
