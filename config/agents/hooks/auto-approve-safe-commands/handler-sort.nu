#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "sort"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-sort"
    for case in [
        [argv, expected];
        [["sort"], $DECISION_ALLOW],
        [["sort", "x"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-sort: ($case.argv | str join ' ')"
    }

    print "handler-sort tests passed"
}
