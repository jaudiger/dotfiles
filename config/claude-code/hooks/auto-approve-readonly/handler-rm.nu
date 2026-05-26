#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [deny defer is-safe-path DECISION_DENY DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if not (has-recursive-force $argv) { return (defer) }
    let unsafe = (targets $argv | where { |p| not (is-safe-path $p) } | get 0?)
    if $unsafe != null {
        return (deny $"rm -r + -f on unsafe target '($unsafe)' is forbidden. Drop -f, use a relative or temp path.")
    }
    defer
}

def has-recursive-force [argv: list<string>]: nothing -> bool {
    let shorts = ($argv | where { |t| ($t | str starts-with "-") and (not ($t | str starts-with "--")) })
    let has_r = ($shorts | any { |t| ($t | str contains "r") or ($t | str contains "R") }) or ("--recursive" in $argv)
    let has_f = ($shorts | any { |t| $t | str contains "f" }) or ("--force" in $argv)
    $has_r and $has_f
}

def targets [argv: list<string>]: nothing -> list<string> {
    $argv | skip 1 | where { |t| not ($t | str starts-with "-") }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-rm"
    for case in [
        [argv, expected];
        [["rm", "-rf", "/"], $DECISION_DENY],
        [["rm", "-rf", "/etc"], $DECISION_DENY],
        [["rm", "-fr", "/usr/local"], $DECISION_DENY],
        [["rm", "-r", "-f", "/"], $DECISION_DENY],
        [["rm", "--recursive", "--force", "/"], $DECISION_DENY],
        [["rm", "-rf", "/tmp/build"], $DECISION_DEFER],
        [["rm", "-rf", "/var/folders/x/y/z"], $DECISION_DEFER],
        [["rm", "/tmp/file"], $DECISION_DEFER],
        [["rm", "-r", "/tmp/dir"], $DECISION_DEFER],
        [["rm", "-rf", "build"], $DECISION_DEFER],
        [["rm", "file"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-rm: ($case.argv | str join ' ')"
    }

    print "handler-rm tests passed"
}
