#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let options = ($argv | skip 1)
    let variable_option = ($options | where { |option|
        $option == "-v" or ($option | str starts-with "-v")
    } | get 0?)
    if $variable_option != null {
        return (defer "printf -v assigns a shell variable; requires confirmation")
    }
    allow "printf read-only"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-printf"
    for case in [
        [argv, expected];
        [["printf"], $DECISION_ALLOW],
        [["printf", "%s\\n", "value"], $DECISION_ALLOW],
        [["printf", "%s", "one", "two"], $DECISION_ALLOW],
        [["printf", "--", "%s", "value"], $DECISION_ALLOW],
        [["printf", "-e", "%s\\n", "value"], $DECISION_ALLOW],
        [["printf", "-v", "value", "%s", "text"], $DECISION_DEFER],
        [["printf", "-vname", "%s", "text"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-printf: ($case.argv | str join ' ')"
    }

    print "handler-printf tests passed"
}
