#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "shellcheck"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-shellcheck"
    for case in [
        [argv, expected];
        [["shellcheck"], $DECISION_ALLOW],
        [["shellcheck", "x"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-shellcheck: ($case.argv | str join ' ')"
    }

    print "handler-shellcheck tests passed"
}
