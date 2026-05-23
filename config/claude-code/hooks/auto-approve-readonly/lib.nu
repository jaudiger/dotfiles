#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

export const DECISION_ALLOW: string = "allow"
export const DECISION_DENY: string = "deny"
export const DECISION_DEFER: string = "defer"

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

export def emit-defer []: nothing -> nothing {
    exit 0
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
