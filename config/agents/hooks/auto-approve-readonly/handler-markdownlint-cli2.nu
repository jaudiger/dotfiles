#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "markdownlint-cli2"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-markdownlint-cli2"
    for case in [
        [argv, expected];
        [["markdownlint-cli2"], $DECISION_ALLOW],
        [["markdownlint-cli2", "x"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-markdownlint-cli2: ($case.argv | str join ' ')"
    }

    print "handler-markdownlint-cli2 tests passed"
}
