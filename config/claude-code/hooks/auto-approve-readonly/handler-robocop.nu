#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const ROBOCOP_SUBS: list<string> = ["check", "docs", "format"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer) }
    if $sub in $ROBOCOP_SUBS { return (allow $"robocop ($sub)") }
    defer
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-robocop"
    for case in [
        [argv, expected];
        [["robocop", "check"], $DECISION_ALLOW],
        [["robocop", "unknown-sub"], $DECISION_DEFER],
        [["robocop"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-robocop: ($case.argv | str join ' ')"
    }

    print "handler-robocop tests passed"
}
