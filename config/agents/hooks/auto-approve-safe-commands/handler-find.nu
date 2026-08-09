#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DEFER]

const FIND_EXEC_FLAGS: list<string> = ["-exec", "-execdir", "-ok", "-okdir"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let exec_flag = ($FIND_EXEC_FLAGS | where { |f| $f in $argv } | get 0?)
    if $exec_flag != null {
        return (defer $"find ($exec_flag) runs an arbitrary command; requires confirmation")
    }
    if "-delete" in $argv {
        let unsafe = (starting-paths $argv | where { |p| not (is-safe-path $p) } | get 0?)
        if $unsafe != null {
            return (defer $"find -delete on '($unsafe)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
        }
    }
    allow "find"
}

def starting-paths [argv: list<string>]: nothing -> list<string> {
    mut paths = []
    for t in ($argv | skip 1) {
        if ($t | str starts-with "-") { break }
        $paths = ($paths | append $t)
    }
    $paths
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-find"
    for case in [
        [argv, expected];
        [["find"], $DECISION_ALLOW],
        [["find", "."], $DECISION_ALLOW],
        [["find", ".", "-name", "*.nu"], $DECISION_ALLOW],
        [["find", ".", "-delete"], $DECISION_ALLOW],
        [["find", "build", "-delete"], $DECISION_ALLOW],
        [["find", "/tmp/build", "-delete"], $DECISION_ALLOW],
        [["find", "-delete"], $DECISION_ALLOW],
        [["find", ".", "-name", "*.log", "-delete"], $DECISION_ALLOW],
        [["find", "/etc", "-delete"], $DECISION_DEFER],
        [["find", ".", "/etc", "-delete"], $DECISION_DEFER],
        [["find", ".", "-exec", "rm", "{}", ";"], $DECISION_DEFER],
        [["find", ".", "-execdir", "rm", "{}", ";"], $DECISION_DEFER],
        [["find", ".", "-ok", "rm", "{}", ";"], $DECISION_DEFER],
        [["find", ".", "-name", "*.log", "-exec", "cat", "{}", ";"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-find: ($case.argv | str join ' ')"
    }

    print "handler-find tests passed"
}
