#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer argv-matches-any DECISION_ALLOW DECISION_DEFER]

const NIX_SUB_PREFIXES: list<list<string>> = [
    ["derivation", "show"],
    ["eval"],
    ["flake", "metadata"],
    ["flake", "show"],
    ["log"],
    ["path-info"],
    ["search"],
    ["store", "cat"],
    ["store", "diff-closures"],
    ["store", "dump-path"],
    ["store", "ls"],
    ["store", "path-info"],
    ["why-depends"],
]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let tail = ($argv | skip 1)
    if (argv-matches-any $tail $NIX_SUB_PREFIXES) {
        return (allow $"nix ($tail | take 2 | str join ' ')")
    }
    defer $"nix ($tail | str join ' ') not auto-approved; allowed: ($NIX_SUB_PREFIXES | each { |p| $p | str join ' ' } | str join ', ')"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-nix"
    for case in [
        [argv, expected];
        [["nix", "log", "result"], $DECISION_ALLOW],
        [["nix", "eval", ".#package"], $DECISION_ALLOW],
        [["nix", "path-info", "result"], $DECISION_ALLOW],
        [["nix", "flake", "metadata", "."], $DECISION_ALLOW],
        [["nix", "flake", "show", "."], $DECISION_ALLOW],
        [["nix", "store", "cat", "result"], $DECISION_ALLOW],
        [["nix", "store", "delete", "result"], $DECISION_DEFER],
        [["nix", "build", ".#package"], $DECISION_DEFER],
        [["nix", "unknown-sub"], $DECISION_DEFER],
        [["nix"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-nix: ($case.argv | str join ' ')"
    }

    print "handler-nix tests passed"
}
