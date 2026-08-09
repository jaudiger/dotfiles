#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "uniq"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-uniq"
    for case in [
        [argv, expected];
        [["uniq"], $DECISION_ALLOW],
        [["uniq", "x"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-uniq: ($case.argv | str join ' ')"
    }

    print "handler-uniq tests passed"
}
