#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const ZIG_SUBS: list<string> = ["build", "build-exe", "build-lib", "env", "fmt", "test"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer) }
    if $sub in $ZIG_SUBS { return (allow $"zig ($sub)") }
    defer
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-zig"
    for case in [
        [argv, expected];
        [["zig", "build"], $DECISION_ALLOW],
        [["zig", "unknown-sub"], $DECISION_DEFER],
        [["zig"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-zig: ($case.argv | str join ' ')"
    }

    print "handler-zig tests passed"
}
