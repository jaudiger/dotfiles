#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let unsafe = ($argv | skip 1 | where { |t| not ($t | str starts-with "-") } | where { |p| not (is-safe-path $p) } | get 0?)
    if $unsafe != null {
        return (defer $"tee: output target '($unsafe)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }
    allow "tee"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-tee"
    for case in [
        [argv, expected];
        [["tee"], $DECISION_ALLOW],
        [["tee", "-a"], $DECISION_ALLOW],
        [["tee", "/tmp/out"], $DECISION_ALLOW],
        [["tee", "-a", "/tmp/out"], $DECISION_ALLOW],
        [["tee", "out.log"], $DECISION_ALLOW],
        [["tee", "a.log", "/tmp/b.log"], $DECISION_ALLOW],
        [["tee", "/etc/passwd"], $DECISION_DEFER],
        [["tee", "a.log", "/etc/passwd"], $DECISION_DEFER],
        [["tee", "~/secrets"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-tee: ($case.argv | str join ' ')"
    }

    print "handler-tee tests passed"
}
