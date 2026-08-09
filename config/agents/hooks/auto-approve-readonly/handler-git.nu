#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow deny defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DENY DECISION_DEFER]

const GIT_SUBS: list<string> = [
    "blame",
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
    "show-ref",
    "status",
]
const GIT_GUARDED_SUBS: list<string> = [
    "config",
    "remote",
    "reset",
    "push",
    "stash",
]

const GIT_STASH_DENY: list<string> = ["clear", "drop"]
const GIT_CONFIG_MUTATION_SUBS: list<string> = ["add", "edit", "remove-section", "rename-section", "replace-all", "set", "unset"]
const GIT_PATH_FLAGS: list<string> = ["-C", "--git-dir", "--work-tree"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let unsafe = (path-args $argv | where { |p| not (is-safe-path $p.value) } | get 0?)
    if $unsafe != null {
        return (defer $"git ($unsafe.flag) target '($unsafe.value)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }
    let sub_index = (find-subcommand-index $argv)
    if $sub_index < 0 { return (defer "git: subcommand required") }
    let sub = ($argv | get $sub_index)
    if $sub in $GIT_GUARDED_SUBS {
        if $sub == "config" { return (handler-config $argv $sub_index) }
        if $sub == "remote" {
            let options = ($argv | skip ($sub_index + 1))
            if ($options | all { |option| $option in ["-v", "--verbose"] }) {
                return (allow "git remote")
            }
            return (defer "git remote: only listing remotes is auto-approved")
        }
        if $sub == "reset" { return (deny "git reset forbidden: can lose local commits or rewrite history") }
        if $sub == "push" {
            if "--force" in ($argv | skip ($sub_index + 1)) { return (deny "git push --force forbidden: overwrites remote history. Push without --force to defer to user.") }
            return (defer "git push: writes to remote, requires confirmation")
        }
        if $sub == "stash" {
            let arg = ($argv | get ($sub_index + 1) -o)
            if $arg in $GIT_STASH_DENY { return (deny $"git stash ($arg) forbidden: discards stash entries") }
            return (allow "git stash")
        }
    }
    if $sub in $GIT_SUBS { return (allow $"git ($sub)") }
    defer $"git ($sub) not auto-approved"
}

def handler-config [argv: list<string>, sub_index: int]: nothing -> record<decision: string, reason: string> {
    let args = ($argv | skip ($sub_index + 1))
    let mutation = ($args | get 0? | default "")
    if $mutation in $GIT_CONFIG_MUTATION_SUBS {
        return (defer $"git config ($mutation) changes configuration; requires confirmation")
    }
    let operands = ($args | where { |arg| not ($arg | str starts-with "-") })
    if ($operands | length) == 1 {
        return (allow "git config reads one configuration value")
    }
    defer "git config command is not a read-only single-value query"
}

def path-args [argv: list<string>]: nothing -> list<record<flag: string, value: string>> {
    let n = ($argv | length)
    $argv | enumerate | each { |it|
        let t = $it.item
        if ($t in $GIT_PATH_FLAGS) and ($it.index + 1) < $n {
            { flag: $t, value: ($argv | get ($it.index + 1)) }
        } else {
            let matched = ($GIT_PATH_FLAGS | where { |f| ($f | str starts-with "--") and ($t | str starts-with ($f + "=")) } | get 0?)
            if $matched != null {
                { flag: $matched, value: ($t | str substring (($t | str index-of "=") + 1)..) }
            }
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
        [["git", "blame", "-L", "1,100", "--", "profiles/ai/pi-coding-agent.nix"], $DECISION_ALLOW],
        [["git", "status"], $DECISION_ALLOW],
        [["git", "branch"], $DECISION_ALLOW],
        [["git", "remote"], $DECISION_ALLOW],
        [["git", "remote", "-v"], $DECISION_ALLOW],
        [["git", "remote", "--verbose"], $DECISION_ALLOW],
        [["git", "remote", "add", "origin", "url"], $DECISION_DEFER],
        [["git", "remote", "set-url", "origin", "url"], $DECISION_DEFER],
        [["git", "ls-files"], $DECISION_ALLOW],
        [["git", "show-ref"], $DECISION_ALLOW],
        [["git", "config", "user.name"], $DECISION_ALLOW],
        [["git", "config", "user.email"], $DECISION_ALLOW],
        [["git", "config", "commit.gpgsign"], $DECISION_ALLOW],
        [["git", "config", "--get", "user.name"], $DECISION_ALLOW],
        [["git", "config", "set", "user.name", "name"], $DECISION_DEFER],
        [["git", "config", "user.name", "name"], $DECISION_DEFER],
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
