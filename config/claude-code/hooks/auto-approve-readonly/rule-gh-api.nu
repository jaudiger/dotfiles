#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") *

export def has-gh-api-field-flag [cmd: string]: nothing -> bool {
    $cmd =~ '(^|\s)(-f|--raw-field|-F|--field|--input)(\s|=)'
}

export def main [cmd: string]: nothing -> nothing {
    if not ($cmd =~ '^gh\s+api\s') { return }
    if (has-mutation-method $cmd) { return }
    if (has-gh-api-field-flag $cmd) { return }
    emit-allow "gh api read"
}

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# rule-gh-api: has-gh-api-field-flag"
    for case in [
        [input, expected];
        ["gh api foo -f title=hello", true],
        ["gh api foo --field title=hello", true],
        ["gh api foo -F title=hello", true],
        ["gh api foo --raw-field title=hello", true],
        ["gh api foo --input file", true],
        ["gh api foo", false],
        ["gh api foo --jq '.tag_name'", false],
        ["gh api foo --paginate", false],
        ["gh api foo -H 'Accept: application/json'", false],
    ] {
        assert equal (has-gh-api-field-flag $case.input) $case.expected $"has-gh-api-field-flag: ($case.input)"
    }

    print "# rule-gh-api: has-mutation-method"
    for case in [
        [input, expected];
        ["gh api foo --method POST", true],
        ["gh api foo --method PUT", true],
        ["gh api foo --method DELETE", true],
        ["gh api foo --method PATCH", true],
        ["gh api foo -X POST", true],
        ["gh api foo --request DELETE", true],
        ["gh api foo --method GET", false],
        ["gh api foo -X GET", false],
        ["gh api foo", false],
    ] {
        assert equal (has-mutation-method $case.input) $case.expected $"has-mutation-method: ($case.input)"
    }

    print "# rule-gh-api: is-pipe-to-shell"
    for case in [
        [input, expected];
        ["gh api foo | sh", true],
        ["gh api foo | bash", true],
        ["gh api foo|sh", true],
        ["gh api foo | zsh", true],
        ["gh api foo | jq .", false],
        ["gh api foo | head", false],
        ["gh api foo", false],
    ] {
        assert equal (is-pipe-to-shell $case.input) $case.expected $"is-pipe-to-shell: ($case.input)"
    }

    print "# rule-gh-api: has-command-separator"
    for case in [
        [input, expected];
        ["gh api foo; gh api bar", true],
        ["gh api foo && echo done", true],
        ["gh api foo || echo fallback", true],
        ["gh api foo | jq .", false],
        ["gh api foo", false],
    ] {
        assert equal (has-command-separator $case.input) $case.expected $"has-command-separator: ($case.input)"
    }

    print "# rule-gh-api: has-command-substitution"
    for case in [
        [input, expected];
        ["gh api \"repos/$(echo foo)\"", true],
        ["gh api `echo foo`", true],
        ["gh api foo", false],
    ] {
        assert equal (has-command-substitution $case.input) $case.expected $"has-command-substitution: ($case.input)"
    }

    print "# rule-gh-api: has-process-substitution"
    for case in [
        [input, expected];
        ["gh api foo <(echo data)", true],
        ["gh api foo >(grep bar)", true],
        ["gh api foo", false],
        ["gh api foo | jq .", false],
    ] {
        assert equal (has-process-substitution $case.input) $case.expected $"has-process-substitution: ($case.input)"
    }

    print "# rule-gh-api: has-output-redirect"
    for case in [
        [input, expected];
        ["gh api foo > /tmp/file", true],
        ["gh api foo >> /tmp/log", true],
        ["gh api foo 2> /tmp/err", true],
        ["gh api foo 2>&1 | jq .", false],
        ["gh api foo >/dev/null", false],
        ["gh api foo", false],
    ] {
        assert equal (has-output-redirect $case.input) $case.expected $"has-output-redirect: ($case.input)"
    }

    print "rule-gh-api tests passed"
}
