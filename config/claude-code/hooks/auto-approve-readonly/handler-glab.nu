#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer argv-matches-any DECISION_ALLOW DECISION_DEFER]

const GLAB_SUB_PREFIXES: list<list<string>> = [
    ["auth", "status"],
    ["issue", "list"],
    ["issue", "view"],
    ["mr", "checks"],
    ["mr", "diff"],
    ["mr", "list"],
    ["mr", "view"],
    ["pipeline", "list"],
    ["pipeline", "view"],
    ["release", "list"],
    ["release", "view"],
    ["repo", "view"],
]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer) }
    let tail = ($argv | skip 1)
    if (argv-matches-any $tail $GLAB_SUB_PREFIXES) { return (allow $"glab ($sub)") }
    defer
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-glab"
    for case in [
        [argv, expected];
        [["glab", "auth", "status"], $DECISION_ALLOW],
        [["glab", "mr", "view", "42"], $DECISION_ALLOW],
        [["glab", "pipeline", "list"], $DECISION_ALLOW],
        [["glab", "mr", "create"], $DECISION_DEFER],
        [["glab", "unknown"], $DECISION_DEFER],
        [["glab"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-glab: ($case.argv | str join ' ')"
    }

    print "handler-glab tests passed"
}
