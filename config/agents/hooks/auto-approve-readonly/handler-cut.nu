#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    allow "cut read-only"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-cut"
    for case in [
        [argv, expected];
        [["cut"], "allow"],
        [["cut", "-d:", "-f1"], "allow"],
        [["cut", "-f", "1", "file"], "allow"],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-cut: ($case.argv | str join ' ')"
    }

    print "handler-cut tests passed"
}
