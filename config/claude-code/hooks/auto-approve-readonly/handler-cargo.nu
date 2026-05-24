#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const CARGO_SUBS: list<string> = ["bench", "build", "check", "clean", "clippy", "doc", "fmt", "init", "metadata", "rustc", "test", "tree", "update", "upgrade"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer) }
    if $sub in $CARGO_SUBS { return (allow $"cargo ($sub)") }
    defer
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-cargo"
    for case in [
        [argv, expected];
        [["cargo", "bench"], $DECISION_ALLOW],
        [["cargo", "unknown-sub"], $DECISION_DEFER],
        [["cargo"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-cargo: ($case.argv | str join ' ')"
    }

    print "handler-cargo tests passed"
}
