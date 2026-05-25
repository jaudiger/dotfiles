#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if (has-file-write $argv) { return (defer "base64: -o/--output writes to disk, requires confirmation (use /dev/null to discard)") }
    allow "base64"
}

def has-file-write [argv: list<string>]: nothing -> bool {
    let n = ($argv | length)
    $argv | enumerate | any { |it|
        let t = $it.item
        if ($t == "-o" or $t == "--output") and ($it.index + 1) < $n {
            ($argv | get ($it.index + 1)) != "/dev/null"
        } else if ($t | str starts-with "--output=") {
            let eq = ($t | str index-of "=")
            ($t | str substring ($eq + 1)..) != "/dev/null"
        } else {
            false
        }
    }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-base64"
    for case in [
        [argv, expected];
        [["base64"], $DECISION_ALLOW],
        [["base64", "-d"], $DECISION_ALLOW],
        [["base64", "--decode"], $DECISION_ALLOW],
        [["base64", "file"], $DECISION_ALLOW],
        [["base64", "-o", "/tmp/file"], $DECISION_DEFER],
        [["base64", "--output", "/tmp/file"], $DECISION_DEFER],
        [["base64", "-o", "/dev/null"], $DECISION_ALLOW],
        [["base64", "--output=/tmp/file"], $DECISION_DEFER],
        [["base64", "--output=/dev/null"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-base64: ($case.argv | str join ' ')"
    }

    print "handler-base64 tests passed"
}
