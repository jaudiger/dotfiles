#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow deny defer DECISION_ALLOW DECISION_DENY DECISION_DEFER]

const GIT_SUBS: list<string> = [
    "branch",
    "diff",
    "fetch",
    "grep",
    "log",
    "ls-files",
    "ls-remote",
    "ls-tree",
    "rev-parse",
    "show",
    "status",
]

const GIT_STASH_DENY: list<string> = ["clear", "drop"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer "git: subcommand required") }
    if $sub == "reset" { return (deny "git reset forbidden: can lose local commits or rewrite history") }
    if $sub == "push" {
        if "--force" in ($argv | skip 2) { return (deny "git push --force forbidden: overwrites remote history. Push without --force to defer to user.") }
        return (defer "git push: writes to remote, requires confirmation")
    }
    if $sub == "stash" {
        let arg = ($argv | get 2?)
        if $arg in $GIT_STASH_DENY { return (deny $"git stash ($arg) forbidden: discards stash entries") }
        return (allow "git stash")
    }
    if $sub in $GIT_SUBS { return (allow $"git ($sub)") }
    defer $"git ($sub) not auto-approved; allowed: ($GIT_SUBS | str join ', '), stash, push without --force"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-git"
    for case in [
        [argv, expected];
        [["git", "diff"], $DECISION_ALLOW],
        [["git", "diff", "--cached"], $DECISION_ALLOW],
        [["git", "log"], $DECISION_ALLOW],
        [["git", "status"], $DECISION_ALLOW],
        [["git", "branch"], $DECISION_ALLOW],
        [["git", "ls-files"], $DECISION_ALLOW],
        [["git", "stash"], $DECISION_ALLOW],
        [["git", "stash", "list"], $DECISION_ALLOW],
        [["git", "stash", "push"], $DECISION_ALLOW],
        [["git", "stash", "clear"], $DECISION_DENY],
        [["git", "stash", "drop"], $DECISION_DENY],
        [["git", "reset"], $DECISION_DENY],
        [["git", "reset", "--hard"], $DECISION_DENY],
        [["git", "push", "--force"], $DECISION_DENY],
        [["git", "push", "origin", "main", "--force"], $DECISION_DENY],
        [["git", "push", "origin", "main"], $DECISION_DEFER],
        [["git", "commit"], $DECISION_DEFER],
        [["git"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-git: ($case.argv | str join ' ')"
    }

    print "handler-git tests passed"
}
