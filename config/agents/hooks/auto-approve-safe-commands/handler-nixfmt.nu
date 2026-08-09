#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if "--check" in $argv or "-c" in $argv {
        return (allow "nixfmt --check does not modify files")
    }
    defer "nixfmt without --check may modify files; requires confirmation"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-nixfmt"
    for case in [
        [argv, expected];
        [["nixfmt", "--check", "file.nix"], $DECISION_ALLOW],
        [["nixfmt", "-c", "file.nix"], $DECISION_ALLOW],
        [["nixfmt", "--check", "one.nix", "two.nix"], $DECISION_ALLOW],
        [["nixfmt", "file.nix"], $DECISION_DEFER],
        [["nixfmt", "--width", "120", "file.nix"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-nixfmt: ($case.argv | str join ' ')"
    }

    print "handler-nixfmt tests passed"
}
