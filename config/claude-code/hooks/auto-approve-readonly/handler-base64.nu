#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DEFER]

const OUTPUT_FLAGS: list<string> = ["-o", "--output"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let unsafe = (output-targets $argv | where { |p| not (is-safe-path $p) } | get 0?)
    if $unsafe != null {
        return (defer $"base64: -o/--output target '($unsafe)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }
    allow "base64"
}

def output-targets [argv: list<string>]: nothing -> list<string> {
    let n = ($argv | length)
    $argv | enumerate | each { |it|
        let t = $it.item
        if ($t in $OUTPUT_FLAGS) and ($it.index + 1) < $n {
            $argv | get ($it.index + 1)
        } else {
            $OUTPUT_FLAGS
            | where { |f| ($f | str starts-with "--") and ($t | str starts-with ($f + "=")) }
            | each { |_| let eq = ($t | str index-of "="); $t | str substring ($eq + 1).. }
            | get 0?
        }
    } | compact
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
        [["base64", "-o", "/tmp/x"], $DECISION_ALLOW],
        [["base64", "-o", "/etc/passwd"], $DECISION_DEFER],
        [["base64", "--output", "/tmp/x"], $DECISION_ALLOW],
        [["base64", "--output", "/etc/passwd"], $DECISION_DEFER],
        [["base64", "--output=/tmp/x"], $DECISION_ALLOW],
        [["base64", "--output=/etc/passwd"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-base64: ($case.argv | str join ' ')"
    }

    print "handler-base64 tests passed"
}
