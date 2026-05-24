#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const RUSTC_SUBS: list<string> = ["check"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer) }
    if $sub in $RUSTC_SUBS { return (allow $"rustc ($sub)") }
    defer
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-rustc"
    for case in [
        [argv, expected];
        [["rustc", "check"], $DECISION_ALLOW],
        [["rustc", "unknown-sub"], $DECISION_DEFER],
        [["rustc"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-rustc: ($case.argv | str join ' ')"
    }

    print "handler-rustc tests passed"
}
