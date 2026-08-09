#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const PNPM_SUBS: list<string> = ["build", "info", "lint", "list", "outdated", "test", "update", "view", "why"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer "pnpm: subcommand required") }
    if $sub in $PNPM_SUBS { return (allow $"pnpm ($sub)") }
    defer $"pnpm ($sub) not auto-approved; allowed: ($PNPM_SUBS | str join ', ')"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-pnpm"
    for case in [
        [argv, expected];
        [["pnpm", "build"], $DECISION_ALLOW],
        [["pnpm", "unknown-sub"], $DECISION_DEFER],
        [["pnpm"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-pnpm: ($case.argv | str join ' ')"
    }

    print "handler-pnpm tests passed"
}
