#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer argv-has-mutation-method argv-matches-any DECISION_ALLOW DECISION_DEFER]

const GH_SUB_PREFIXES: list<list<string>> = [
    ["auth", "status"],
    ["issue", "list"],
    ["issue", "status"],
    ["issue", "view"],
    ["pr", "checks"],
    ["pr", "diff"],
    ["pr", "list"],
    ["pr", "status"],
    ["pr", "view"],
    ["release", "list"],
    ["release", "view"],
    ["repo", "view"],
    ["run", "list"],
    ["run", "view"],
    ["search"],
    ["workflow", "list"],
    ["workflow", "view"],
]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let sub = ($argv | get 1?)
    if $sub == null { return (defer "gh: subcommand required") }
    if $sub == "api" { return (handler-api $argv) }
    let tail = ($argv | skip 1)
    if (argv-matches-any $tail $GH_SUB_PREFIXES) { return (allow $"gh ($sub)") }
    defer $"gh ($tail | str join ' ') not auto-approved; allowed: ($GH_SUB_PREFIXES | each { |p| $p | str join ' ' } | str join ', '), api"
}

def handler-api [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if (argv-has-mutation-method $argv) { return (defer "gh api: mutation method (POST/PUT/DELETE/PATCH) requires confirmation. Use GET or omit --method.") }
    if (has-field-flag $argv) { return (defer "gh api: -f/-F/--field/--raw-field/--input sends a request body, requires confirmation") }
    allow "gh api read"
}

def has-field-flag [argv: list<string>]: nothing -> bool {
    let flags = ["-f", "--raw-field", "-F", "--field", "--input"]
    let prefixes = ["--raw-field=", "--field=", "--input="]
    $argv | any { |t|
        ($t in $flags) or ($prefixes | any { |p| ($t | str starts-with $p) })
    }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-gh"
    for case in [
        [argv, expected];
        [["gh", "api", "repos/foo/bar"], $DECISION_ALLOW],
        [["gh", "api", "foo", "--jq", ".tag_name"], $DECISION_ALLOW],
        [["gh", "api", "foo", "--paginate"], $DECISION_ALLOW],
        [["gh", "api", "foo", "-H", "Accept: application/json"], $DECISION_ALLOW],
        [["gh", "api", "foo", "-f", "title=hello"], $DECISION_DEFER],
        [["gh", "api", "foo", "--field", "title=hello"], $DECISION_DEFER],
        [["gh", "api", "foo", "-F", "title=hello"], $DECISION_DEFER],
        [["gh", "api", "foo", "--raw-field", "title=hello"], $DECISION_DEFER],
        [["gh", "api", "foo", "--input", "file"], $DECISION_DEFER],
        [["gh", "api", "foo", "--method", "POST"], $DECISION_DEFER],
        [["gh", "api", "foo", "--method", "GET"], $DECISION_ALLOW],
        [["gh", "pr", "view"], $DECISION_ALLOW],
        [["gh", "pr", "view", "42"], $DECISION_ALLOW],
        [["gh", "issue", "list"], $DECISION_ALLOW],
        [["gh", "search", "code", "foo"], $DECISION_ALLOW],
        [["gh", "auth", "status"], $DECISION_ALLOW],
        [["gh", "pr", "merge"], $DECISION_DEFER],
        [["gh", "unknown-sub"], $DECISION_DEFER],
        [["gh"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-gh: ($case.argv | str join ' ')"
    }

    print "handler-gh tests passed"
}
