#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const RUFF_SUBS: list<string> = ["check", "format"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer "ruff: subcommand required") }
    if $sub in $RUFF_SUBS { return (allow $"ruff ($sub)") }
    defer $"ruff ($sub) not auto-approved; allowed: ($RUFF_SUBS | str join ', ')"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-ruff"
    for case in [
        [argv, expected];
        [["ruff", "check"], $DECISION_ALLOW],
        [["ruff", "unknown-sub"], $DECISION_DEFER],
        [["ruff"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-ruff: ($case.argv | str join ' ')"
    }

    print "handler-ruff tests passed"
}
