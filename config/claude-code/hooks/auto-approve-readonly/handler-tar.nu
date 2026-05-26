#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DEFER]

const TAR_PATH_FLAGS: list<string> = ["-f", "-C", "--file", "--directory"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let unsafe = (path-args $argv | where { |p| not (is-safe-path $p.value) } | get 0?)
    if $unsafe != null {
        return (defer $"tar: ($unsafe.flag) target '($unsafe.value)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }
    allow "tar"
}

def path-args [argv: list<string>]: nothing -> list<record<flag: string, value: string>> {
    let n = ($argv | length)
    $argv | enumerate | each { |it|
        let t = $it.item
        if ($t in $TAR_PATH_FLAGS) and ($it.index + 1) < $n {
            { flag: $t, value: ($argv | get ($it.index + 1)) }
        } else if ($t =~ '^-[a-zA-Z]*f$') and ($it.index + 1) < $n {
            { flag: "-f", value: ($argv | get ($it.index + 1)) }
        } else {
            $TAR_PATH_FLAGS
            | where { |f| ($f | str starts-with "--") and ($t | str starts-with ($f + "=")) }
            | each { |f| let eq = ($t | str index-of "="); { flag: $f, value: ($t | str substring ($eq + 1)..) } }
            | get 0?
        }
    } | compact
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-tar"
    for case in [
        [argv, expected];
        [["tar"], $DECISION_ALLOW],
        [["tar", "-tf", "archive.tar"], $DECISION_ALLOW],
        [["tar", "-cf", "/tmp/out.tar", "src"], $DECISION_ALLOW],
        [["tar", "-cvzf", "out.tar.gz", "src"], $DECISION_ALLOW],
        [["tar", "--file=/tmp/out.tar", "-c", "src"], $DECISION_ALLOW],
        [["tar", "-xf", "archive.tar", "-C", "/tmp/dest"], $DECISION_ALLOW],
        [["tar", "-xf", "archive.tar", "--directory=/tmp/dest"], $DECISION_ALLOW],
        [["tar", "-cf", "/etc/out.tar", "src"], $DECISION_DEFER],
        [["tar", "-xf", "archive.tar", "-C", "/etc"], $DECISION_DEFER],
        [["tar", "--file=/etc/out.tar", "-c", "src"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-tar: ($case.argv | str join ' ')"
    }

    print "handler-tar tests passed"
}
