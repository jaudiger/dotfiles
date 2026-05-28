#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let unsafe = ($argv | skip 1 | where { |t| not ($t | str starts-with "-") } | where { |p| not (is-safe-path $p) } | get 0?)
    if $unsafe != null {
        return (defer $"mkdir: target '($unsafe)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }
    allow "mkdir"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-mkdir"
    for case in [
        [argv, expected];
        [["mkdir"], $DECISION_ALLOW],
        [["mkdir", "-p"], $DECISION_ALLOW],
        [["mkdir", "newdir"], $DECISION_ALLOW],
        [["mkdir", "nested/dir"], $DECISION_ALLOW],
        [["mkdir", "-p", "nested/dir"], $DECISION_ALLOW],
        [["mkdir", "-p", "/tmp/foo"], $DECISION_ALLOW],
        [["mkdir", "-p", "/tmp/7z-linux"], $DECISION_ALLOW],
        [["mkdir", "-pv", "/tmp/x"], $DECISION_ALLOW],
        [["mkdir", "-m", "0755", "/tmp/foo"], $DECISION_ALLOW],
        [["mkdir", "/tmp/a", "/tmp/b"], $DECISION_ALLOW],
        [["mkdir", "/etc/foo"], $DECISION_DEFER],
        [["mkdir", "-p", "/etc/foo"], $DECISION_DEFER],
        [["mkdir", "/tmp/foo", "/etc/bar"], $DECISION_DEFER],
        [["mkdir", "-p", "~/foo"], $DECISION_DEFER],
        [["mkdir", "$HOME/foo"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-mkdir: ($case.argv | str join ' ')"
    }

    print "handler-mkdir tests passed"
}
