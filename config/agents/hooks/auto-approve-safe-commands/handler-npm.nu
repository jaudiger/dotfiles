#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const NPM_SUBS: list<string> = ["info", "ls", "outdated", "update", "view"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer "npm: subcommand required") }
    if $sub in $NPM_SUBS { return (allow $"npm ($sub)") }
    defer $"npm ($sub) not auto-approved; allowed: ($NPM_SUBS | str join ', ')"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-npm"
    for case in [
        [argv, expected];
        [["npm", "info"], $DECISION_ALLOW],
        [["npm", "unknown-sub"], $DECISION_DEFER],
        [["npm"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-npm: ($case.argv | str join ' ')"
    }

    print "handler-npm tests passed"
}
