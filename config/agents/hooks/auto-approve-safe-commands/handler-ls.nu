#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "ls read"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-ls"
    for case in [
        [argv, expected];
        [["ls"], $DECISION_ALLOW],
        [["ls", "-la"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-ls: ($case.argv | str join ' ')"
    }

    print "handler-ls tests passed"
}
