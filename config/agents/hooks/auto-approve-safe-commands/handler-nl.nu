#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "nl read"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-nl"
    for case in [
        [argv, expected];
        [["nl"], $DECISION_ALLOW],
        [["nl", "-ba", "file.txt"], $DECISION_ALLOW],
        [["nl", "-ba"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-nl: ($case.argv | str join ' ')"
    }

    print "handler-nl tests passed"
}
