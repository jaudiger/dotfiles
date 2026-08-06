#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if "-v" in $argv or "-V" in $argv {
        return (allow "command -v only looks up command names")
    }
    defer "command without -v or -V may execute a command; requires confirmation"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-command"
    for case in [
        [argv, expected];
        [["command", "-v", "nix"], $DECISION_ALLOW],
        [["command", "-V", "nix"], $DECISION_ALLOW],
        [["command", "-p", "-v", "nix"], $DECISION_ALLOW],
        [["command", "nix"], $DECISION_DEFER],
        [["command", "-v"], $DECISION_ALLOW],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-command: ($case.argv | str join ' ')"
    }

    print "handler-command tests passed"
}
