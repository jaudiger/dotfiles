#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

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

export def is-pipe-to-shell [cmd: string]: nothing -> bool {
    $cmd =~ '\|\s*(sh|bash|zsh|fish|tcsh|csh|dash|ksh)(\s|$)'
}

export def has-mutation-method [cmd: string]: nothing -> bool {
    $cmd =~ '(^|\s)(-[a-zA-Z]*X|--request|--method)\s+(POST|PUT|DELETE|PATCH)'
}

export def has-command-separator [cmd: string]: nothing -> bool {
    ($cmd =~ ';') or ($cmd =~ '&&') or ($cmd =~ '\|\|') or ($cmd =~ '\n')
}

export def has-command-substitution [cmd: string]: nothing -> bool {
    ($cmd =~ '\$\(') or ($cmd =~ '`')
}

export def has-process-substitution [cmd: string]: nothing -> bool {
    ($cmd =~ '<\(') or ($cmd =~ '>\(')
}

export def has-output-redirect [cmd: string]: nothing -> bool {
    let redirects = ($cmd | parse -r '[0-9&]?>>?\s*(?<target>\S+)')
    if ($redirects | is-empty) {
        return false
    }
    for r in $redirects {
        let target = $r.target
        if (not ($target =~ '^&[0-9]+$')) and ($target != '/dev/null') {
            return true
        }
    }
    false
}
