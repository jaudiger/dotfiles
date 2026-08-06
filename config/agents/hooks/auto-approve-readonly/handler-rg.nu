#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const EXEC_OPTIONS: list<string> = ["--pre", "--hostname-bin", "--search-zip"]
const SHORT_EXEC_OPTION_RE: string = '^-[A-Za-z]*z'

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let exec_option = ($argv | skip 1 | where { |option|
        ($option =~ $SHORT_EXEC_OPTION_RE) or ($EXEC_OPTIONS | any { |flag|
            $option == $flag or ($option | str starts-with ($flag + "="))
        })
    } | get 0?)
    if $exec_option != null {
        return (defer $"rg ($exec_option) invokes an external command; requires confirmation")
    }
    allow "rg read-only"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-rg"
    for case in [
        [argv, expected];
        [["rg"], $DECISION_ALLOW],
        [["rg", "-n", "pattern", "."], $DECISION_ALLOW],
        [["rg", "--glob", "!flake.lock", "pattern", "."], $DECISION_ALLOW],
        [["rg", "--pre", "formatter", "pattern", "."], $DECISION_DEFER],
        [["rg", "--pre=formatter", "pattern", "."], $DECISION_DEFER],
        [["rg", "--hostname-bin", "hostname", "pattern", "."], $DECISION_DEFER],
        [["rg", "--search-zip", "pattern", "."], $DECISION_DEFER],
        [["rg", "-uz", "pattern", "."], $DECISION_DEFER],
        [["rg", "--hostname-bin=hostname", "pattern", "."], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-rg: ($case.argv | str join ' ')"
    }

    print "handler-rg tests passed"
}
