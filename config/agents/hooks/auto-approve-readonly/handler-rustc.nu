#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow DECISION_ALLOW]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "rustc"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-rustc"
    for case in [
        [argv, expected];
        [["rustc"], $DECISION_ALLOW],
        [["rustc", "src/main.rs"], $DECISION_ALLOW],
        [["rustc", "--version"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-rustc: ($case.argv | str join ' ')"
    }

    print "handler-rustc tests passed"
}
