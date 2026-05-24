#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [deny defer DECISION_DENY DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if (targets-root-recursively $argv) { return (deny "rm targeting root forbidden") }
    defer
}

def targets-root-recursively [argv: list<string>]: nothing -> bool {
    let shorts = ($argv | where { |t| ($t | str starts-with "-") and (not ($t | str starts-with "--")) })
    let has_r = ($shorts | any { |t| ($t | str contains "r") or ($t | str contains "R") }) or ("--recursive" in $argv)
    let has_f = ($shorts | any { |t| $t | str contains "f" }) or ("--force" in $argv)
    let has_root = ($argv | skip 1 | any { |t|
        (not ($t | str starts-with "-")) and (($t == "/") or ($t | str starts-with "/"))
    })
    $has_r and $has_f and $has_root
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
        [["rm", "/tmp/file"], $DECISION_DEFER],
        [["rm", "-r", "/tmp/dir"], $DECISION_DEFER],
        [["rm", "-rf", "build"], $DECISION_DEFER],
        [["rm", "file"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-rm: ($case.argv | str join ' ')"
    }

    print "handler-rm tests passed"
}
