#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "shfmt"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-shfmt"
    for case in [
        [argv, expected];
        [["shfmt"], $DECISION_ALLOW],
        [["shfmt", "x"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-shfmt: ($case.argv | str join ' ')"
    }

    print "handler-shfmt tests passed"
}
