#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") *

export def has-silent-flag [cmd: string]: nothing -> bool {
    ($cmd =~ '(^|\s)-[SLI]*s[sSLI]*(\s|$)') or ($cmd =~ '(^|\s)--silent(\s|$)')
}

export def has-body-or-upload [cmd: string]: nothing -> bool {
    $cmd =~ '(^|\s)(-d|--data|--data-raw|--data-binary|--data-urlencode|-T|--upload-file|-F|--form)(\s|=)'
}

export def has-file-write [cmd: string]: nothing -> bool {
    let matches = ($cmd | parse -r '(?:^|\s)(?:-o|--output)\s+(?<target>\S+)')
    if ($matches | is-empty) {
        return false
    }
    ($matches | get 0.target) != "/dev/null"
}

export def main [cmd: string]: nothing -> nothing {
    if not ($cmd =~ '^curl\s') { return }
    if not (has-silent-flag $cmd) { return }
    if (has-mutation-method $cmd) { return }
    if (has-body-or-upload $cmd) { return }
    if (has-file-write $cmd) { return }
    emit-allow "curl read-only fetch"
}

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# rule-curl: has-silent-flag"
    for case in [
        [input, expected];
        ["curl -s URL", true],
        ["curl -sS URL", true],
        ["curl -sL URL", true],
        ["curl -sI URL", true],
        ["curl -sSL URL", true],
        ["curl -sLI URL", true],
        ["curl -Ss URL", true],
        ["curl --silent URL", true],
        ["curl URL", false],
        ["curl -L URL", false],
        ["curl -X POST URL", false],
        ["curl -sX POST URL", false],
        ["curl -so file URL", false],
        ["curl -sd data URL", false],
        ["curl -sf URL", false],
    ] {
        assert equal (has-silent-flag $case.input) $case.expected $"has-silent-flag: ($case.input)"
    }

    print "# rule-curl: has-body-or-upload"
    for case in [
        [input, expected];
        ["curl -d body URL", true],
        ["curl --data foo URL", true],
        ["curl --data-raw=foo URL", true],
        ["curl --data-binary @file URL", true],
        ["curl -F field=val URL", true],
        ["curl --form field=val URL", true],
        ["curl -T file URL", true],
        ["curl --upload-file file URL", true],
        ["curl -s URL", false],
        ["curl URL", false],
    ] {
        assert equal (has-body-or-upload $case.input) $case.expected $"has-body-or-upload: ($case.input)"
    }

    print "# rule-curl: has-file-write"
    for case in [
        [input, expected];
        ["curl -s -o /tmp/file URL", true],
        ["curl -s --output /tmp/file URL", true],
        ["curl -s -o ./out URL", true],
        ["curl -s -o /dev/null URL", false],
        ["curl -s URL", false],
        ["curl URL", false],
    ] {
        assert equal (has-file-write $case.input) $case.expected $"has-file-write: ($case.input)"
    }

    print "# rule-curl: has-mutation-method"
    for case in [
        [input, expected];
        ["curl -X POST URL", true],
        ["curl -X PUT URL", true],
        ["curl -X DELETE URL", true],
        ["curl -X PATCH URL", true],
        ["curl --request POST URL", true],
        ["curl -sX POST URL", true],
        ["curl -LX PUT URL", true],
        ["curl -X GET URL", false],
        ["curl -X HEAD URL", false],
        ["curl URL", false],
        ["curl -s URL", false],
    ] {
        assert equal (has-mutation-method $case.input) $case.expected $"has-mutation-method: ($case.input)"
    }

    print "# rule-curl: is-pipe-to-shell"
    for case in [
        [input, expected];
        ["curl -s URL | sh", true],
        ["curl -s URL | bash", true],
        ["curl -s URL|sh", true],
        ["curl -s URL | zsh", true],
        ["curl -s URL | jq .", false],
        ["curl -s URL | head", false],
        ["curl -s URL", false],
    ] {
        assert equal (is-pipe-to-shell $case.input) $case.expected $"is-pipe-to-shell: ($case.input)"
    }

    print "# rule-curl: has-command-separator"
    for case in [
        [input, expected];
        ["curl -s URL; rm /tmp/file", true],
        ["curl -s URL && rm /tmp/file", true],
        ["curl -s URL || echo fallback", true],
        ["curl -s URL | jq .", false],
        ["curl -s 'https://x.com?a=b&c=d'", false],
        ["curl -s URL", false],
    ] {
        assert equal (has-command-separator $case.input) $case.expected $"has-command-separator: ($case.input)"
    }

    print "# rule-curl: has-command-substitution"
    for case in [
        [input, expected];
        ["curl -s \"$(echo URL)\"", true],
        ["curl -s `echo URL`", true],
        ["curl -s URL", false],
        ["curl -s 'https://x.com?a=b'", false],
    ] {
        assert equal (has-command-substitution $case.input) $case.expected $"has-command-substitution: ($case.input)"
    }

    print "# rule-curl: has-process-substitution"
    for case in [
        [input, expected];
        ["curl -s URL <(echo data)", true],
        ["curl -s URL >(grep foo)", true],
        ["curl -s URL", false],
        ["curl -s URL | jq .", false],
    ] {
        assert equal (has-process-substitution $case.input) $case.expected $"has-process-substitution: ($case.input)"
    }

    print "# rule-curl: has-output-redirect"
    for case in [
        [input, expected];
        ["curl -s URL > /tmp/file", true],
        ["curl -s URL >> /tmp/log", true],
        ["curl -s URL 2> /tmp/err", true],
        ["curl -s URL &> /tmp/all", true],
        ["curl -s URL 2>&1 | jq .", false],
        ["curl -s URL >/dev/null", false],
        ["curl -s URL 2>/dev/null", false],
        ["curl -s URL", false],
    ] {
        assert equal (has-output-redirect $case.input) $case.expected $"has-output-redirect: ($case.input)"
    }

    print "rule-curl tests passed"
}
