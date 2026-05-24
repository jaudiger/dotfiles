#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const HELM_SUBS: list<string> = ["show", "template"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer) }
    if $sub in $HELM_SUBS { return (allow $"helm ($sub)") }
    defer
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-helm"
    for case in [
        [argv, expected];
        [["helm", "show"], $DECISION_ALLOW],
        [["helm", "unknown-sub"], $DECISION_DEFER],
        [["helm"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-helm: ($case.argv | str join ' ')"
    }

    print "handler-helm tests passed"
}
