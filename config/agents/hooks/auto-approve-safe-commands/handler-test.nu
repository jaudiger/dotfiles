#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "test only inspects its arguments and filesystem metadata"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-test"
    for case in [
        [argv, expected];
        [["test"], $DECISION_ALLOW],
        [["test", "-e", "result"], $DECISION_ALLOW],
        [["test", "-f", "result"], $DECISION_ALLOW],
        [["test", "-d", "result"], $DECISION_ALLOW],
        [["test", "-r", "result"], $DECISION_ALLOW],
        [["test", "-n", "value"], $DECISION_ALLOW],
        [["test", "left", "=", "right"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-test: ($case.argv | str join ' ')"
    }

    print "handler-test tests passed"
}
