#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const READ_MODES: list<string> = ["--parse", "--eval", "--find-file"]
const WRITE_OPTIONS: list<string> = ["--add-root", "--read-write-mode"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let args = ($argv | skip 1)
    let write_option = ($args | where { |arg| $arg in $WRITE_OPTIONS } | get 0?)
    if $write_option != null {
        return (defer $"nix-instantiate ($write_option) can write to the store or filesystem")
    }

    let modes = ($args | where { |arg| $arg in $READ_MODES })
    if ($modes | length) == 1 {
        return (allow $"nix-instantiate ($modes | get 0) read-only")
    }
    if ($modes | is-empty) {
        return (defer "nix-instantiate requires an explicitly read-only mode")
    }
    defer "nix-instantiate: use exactly one read-only mode"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-nix-instantiate"
    for case in [
        [argv, expected];
        [["nix-instantiate", "--parse", "file.nix"], $DECISION_ALLOW],
        [["nix-instantiate", "--eval", "file.nix"], $DECISION_ALLOW],
        [["nix-instantiate", "--find-file", "file.nix"], $DECISION_ALLOW],
        [["nix-instantiate", "--parse", "--add-root", "result", "file.nix"], $DECISION_DEFER],
        [["nix-instantiate", "--eval", "--read-write-mode", "file.nix"], $DECISION_DEFER],
        [["nix-instantiate", "file.nix"], $DECISION_DEFER],
        [["nix-instantiate", "--parse", "--eval", "file.nix"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-nix-instantiate: ($case.argv | str join ' ')"
    }

    print "handler-nix-instantiate tests passed"
}
