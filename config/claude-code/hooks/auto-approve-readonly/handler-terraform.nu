#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

const TERRAFORM_SUBS: list<string> = ["fmt", "init", "plan", "test", "validate"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer "terraform: subcommand required") }
    if $sub in $TERRAFORM_SUBS { return (allow $"terraform ($sub)") }
    defer $"terraform ($sub) not auto-approved; allowed: ($TERRAFORM_SUBS | str join ', ')"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-terraform"
    for case in [
        [argv, expected];
        [["terraform", "fmt"], $DECISION_ALLOW],
        [["terraform", "unknown-sub"], $DECISION_DEFER],
        [["terraform"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-terraform: ($case.argv | str join ' ')"
    }

    print "handler-terraform tests passed"
}
