#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") *

export def classify [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if (($argv | get 0?) != "gh") { return (defer) }
    if (($argv | get 1?) != "api") { return (defer) }
    if (argv-has-mutation-method $argv) { return (defer) }
    if (has-field-flag $argv) { return (defer) }
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

    print "# rule-gh-api: classify"
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
        [["gh", "api", "foo", "--method", "PUT"], $DECISION_DEFER],
        [["gh", "api", "foo", "--method", "DELETE"], $DECISION_DEFER],
        [["gh", "api", "foo", "-X", "POST"], $DECISION_DEFER],
        [["gh", "api", "foo", "--request", "DELETE"], $DECISION_DEFER],
        [["gh", "api", "foo", "--method", "GET"], $DECISION_ALLOW],
        [["gh", "api", "foo", "-X", "GET"], $DECISION_ALLOW],
        [["gh", "pr", "view"], $DECISION_DEFER],
        [["gh"], $DECISION_DEFER],
    ] {
        assert equal (classify $case.argv).decision $case.expected $"rule-gh-api: ($case.argv | str join ' ')"
    }

    print "rule-gh-api tests passed"
}
