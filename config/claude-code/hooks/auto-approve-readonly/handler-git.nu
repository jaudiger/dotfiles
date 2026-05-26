#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow deny defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DENY DECISION_DEFER]

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
const GIT_PATH_FLAGS: list<string> = ["-C", "--git-dir", "--work-tree"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let unsafe = (path-args $argv | where { |p| not (is-safe-path $p.value) } | get 0?)
    if $unsafe != null {
        return (defer $"git ($unsafe.flag) target '($unsafe.value)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }
    let sub_index = (find-subcommand-index $argv)
    let sub = if $sub_index >= 0 { $argv | get $sub_index } else { null }
    if $sub == null { return (defer "git: subcommand required") }
    if $sub == "reset" { return (deny "git reset forbidden: can lose local commits or rewrite history") }
    if $sub == "push" {
        if "--force" in ($argv | skip ($sub_index + 1)) { return (deny "git push --force forbidden: overwrites remote history. Push without --force to defer to user.") }
        return (defer "git push: writes to remote, requires confirmation")
    }
    if $sub == "stash" {
        let arg = if ($sub_index + 1) < ($argv | length) { $argv | get ($sub_index + 1) } else { null }
        if $arg in $GIT_STASH_DENY { return (deny $"git stash ($arg) forbidden: discards stash entries") }
        return (allow "git stash")
    }
    if $sub in $GIT_SUBS { return (allow $"git ($sub)") }
    defer $"git ($sub) not auto-approved; allowed: ($GIT_SUBS | str join ', '), stash, push without --force"
}

def path-args [argv: list<string>]: nothing -> list<record<flag: string, value: string>> {
    let n = ($argv | length)
    $argv | enumerate | each { |it|
        let t = $it.item
        if ($t in $GIT_PATH_FLAGS) and ($it.index + 1) < $n {
            { flag: $t, value: ($argv | get ($it.index + 1)) }
        } else {
            $GIT_PATH_FLAGS
            | where { |f| ($f | str starts-with "--") and ($t | str starts-with ($f + "=")) }
            | each { |f| let eq = ($t | str index-of "="); { flag: $f, value: ($t | str substring ($eq + 1)..) } }
            | get 0?
        }
    } | compact
}

def find-subcommand-index [argv: list<string>]: nothing -> int {
    let n = ($argv | length)
    mut i = 1
    while $i < $n {
        let t = ($argv | get $i)
        if $t in $GIT_PATH_FLAGS {
            $i = $i + 2
            continue
        }
        if ($t | str starts-with "-") {
            $i = $i + 1
            continue
        }
        return $i
    }
    -1
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
        [["git", "-C", "/tmp/repo", "status"], $DECISION_ALLOW],
        [["git", "-C", "/etc", "status"], $DECISION_DEFER],
        [["git", "--git-dir=/tmp/r/.git", "log"], $DECISION_ALLOW],
        [["git", "--git-dir=/etc/.git", "log"], $DECISION_DEFER],
        [["git", "-C", "/etc", "reset"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-git: ($case.argv | str join ' ')"
    }

    print "handler-git tests passed"
}
