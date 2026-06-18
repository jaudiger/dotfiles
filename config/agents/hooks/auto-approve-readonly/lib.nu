#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

export const DECISION_ALLOW: string = "allow"
export const DECISION_DENY: string = "deny"
export const DECISION_DEFER: string = "defer"

export const SAFE_PATH: list<string> = [
    "/dev/null",
    "/dev/stderr",
    "/dev/stdout",
    "/private/tmp/",
    "/private/var/folders/",
    "/tmp/",
    "/var/folders/",
]

export def allow [reason: string]: nothing -> record<decision: string, reason: string> {
    { decision: $DECISION_ALLOW, reason: $reason }
}

export def deny [reason: string]: nothing -> record<decision: string, reason: string> {
    { decision: $DECISION_DENY, reason: $reason }
}

export def defer [reason: string = ""]: nothing -> record<decision: string, reason: string> {
    { decision: $DECISION_DEFER, reason: $reason }
}

export def emit-allow [reason: string]: nothing -> nothing {
    {
        hookSpecificOutput: {
            hookEventName: "PreToolUse"
            permissionDecision: "allow"
            permissionDecisionReason: $reason
        }
    } | to json | print
    exit 0
}

export def emit-deny [reason: string]: nothing -> nothing {
    {
        hookSpecificOutput: {
            hookEventName: "PreToolUse"
            permissionDecision: "deny"
            permissionDecisionReason: $reason
        }
    } | to json | print
    exit 0
}

export def emit-defer [reason: string = ""]: nothing -> nothing {
    {
        hookSpecificOutput: {
            hookEventName: "PreToolUse"
            permissionDecision: "defer"
            permissionDecisionReason: $reason
        }
    } | to json | print
    exit 0
}

export def argv-has-prefix [argv: list<string>, prefix: list<string>]: nothing -> bool {
    let n = ($prefix | length)
    if $n > ($argv | length) { return false }
    ($argv | take $n) == $prefix
}

export def argv-matches-any [argv: list<string>, prefixes: list<list<string>>]: nothing -> bool {
    $prefixes | any { |p| argv-has-prefix $argv $p }
}

export def is-safe-path [path: string]: nothing -> bool {
    if ($path | is-empty) { return false }
    if ($path | str contains "$") or ($path | str contains "`") { return false }
    let expanded = ($path | path expand --no-symlink)
    if ($SAFE_PATH | any { |p|
        if ($p | str ends-with "/") { $expanded | str starts-with $p } else { $expanded == $p }
    }) { return true }
    $"($expanded)/" | str starts-with $"((pwd))/"
}

export def argv-has-mutation-method [argv: list<string>]: nothing -> bool {
    let methods = ["POST", "PUT", "DELETE", "PATCH"]
    let n = ($argv | length)
    $argv | enumerate | any { |it|
        let t = $it.item
        let is_separate_flag = (
            ($t == "--request") or ($t == "--method") or ($t =~ '^-[A-Za-z]*X$')
        )
        let separate_match = (
            $is_separate_flag
            and ($it.index + 1) < $n
            and (($argv | get ($it.index + 1)) in $methods)
        )
        let inline_match = if ($t =~ '^(--request|--method)=') {
            let eq = ($t | str index-of "=")
            ($t | str substring ($eq + 1)..) in $methods
        } else {
            false
        }
        $separate_match or $inline_match
    }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# argv-has-prefix"
    for case in [
        [argv, prefix, expected];
        [["cat"], ["cat"], true],
        [["cat", "foo.txt"], ["cat"], true],
        [["catx"], ["cat"], false],
        [["git", "diff"], ["git", "diff"], true],
        [["git", "diff", "--cached"], ["git", "diff"], true],
        [["git"], ["git", "diff"], false],
        [["git", "log"], ["git", "diff"], false],
        [[], ["cat"], false],
        [["cat"], [], true],
    ] {
        assert equal (argv-has-prefix $case.argv $case.prefix) $case.expected $"argv-has-prefix ($case.argv | str join ' ') | ($case.prefix | str join ' ')"
    }

    print "# argv-matches-any"
    for case in [
        [argv, prefixes, expected];
        [["cat", "foo"], [["cat"], ["ls"]], true],
        [["ls", "-la"], [["cat"], ["ls"]], true],
        [["rm", "-rf"], [["cat"], ["ls"]], false],
        [["git", "log", "--oneline"], [["git", "diff"], ["git", "log"]], true],
        [["gh", "pr", "view", "42"], [["gh", "pr", "view"], ["gh", "issue", "view"]], true],
        [["gh", "pr", "create"], [["gh", "pr", "view"], ["gh", "issue", "view"]], false],
        [[], [["cat"]], false],
        [["cat"], [], false],
    ] {
        assert equal (argv-matches-any $case.argv $case.prefixes) $case.expected $"argv-matches-any ($case.argv | str join ' ')"
    }

    print "# is-safe-path"
    for case in [
        [path, expected];
        ["", false],
        [".", true],
        ["foo", true],
        ["foo/bar", true],
        ["./foo", true],
        ["foo/../bar", true],
        ["../foo", false],
        ["foo/../../bar", false],
        ["/foo", false],
        ["/etc/passwd", false],
        ["/tmp/foo", true],
        ["/private/tmp/foo", true],
        ["/tmp/../etc/passwd", false],
        ["/var/folders/abc/xyz", true],
        ["/private/var/folders/abc/xyz", true],
        ["/dev/null", true],
        ["/dev/stdout", true],
        ["/dev/stderr", true],
        ["/dev/sda", false],
        ["~/foo", false],
        ["~", false],
        ["$HOME/foo", false],
        ["${HOME}/foo", false],
        ["`pwd`/foo", false],
    ] {
        assert equal (is-safe-path $case.path) $case.expected $"is-safe-path ($case.path)"
    }

    print "# argv-has-mutation-method"
    for case in [
        [argv, expected];
        [["curl", "-X", "POST", "URL"], true],
        [["curl", "-sX", "PUT", "URL"], true],
        [["curl", "-LX", "DELETE", "URL"], true],
        [["curl", "--request", "PATCH", "URL"], true],
        [["curl", "--method", "POST", "URL"], true],
        [["curl", "--request=POST", "URL"], true],
        [["curl", "--method=DELETE", "URL"], true],
        [["curl", "-X", "GET", "URL"], false],
        [["curl", "-X", "HEAD", "URL"], false],
        [["curl", "URL"], false],
        [["gh", "api", "foo", "--method", "POST"], true],
        [["gh", "api", "foo", "--method", "GET"], false],
        [["gh", "api", "foo"], false],
    ] {
        assert equal (argv-has-mutation-method $case.argv) $case.expected $"argv-has-mutation-method ($case.argv | str join ' ')"
    }

    print "lib tests passed"
}
