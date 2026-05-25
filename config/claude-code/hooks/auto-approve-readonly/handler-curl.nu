#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer argv-has-mutation-method DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if (argv-has-mutation-method $argv) { return (defer "curl: mutation method (POST/PUT/DELETE/PATCH) requires confirmation") }
    if (has-body-or-upload $argv) { return (defer "curl: -d/--data/-T/--upload-file/-F/--form sends a request body, requires confirmation") }
    if (has-file-write $argv) { return (defer "curl: -o/--output writes to disk, requires confirmation (use /dev/null to discard)") }
    allow "curl read-only fetch"
}

def has-body-or-upload [argv: list<string>]: nothing -> bool {
    let flags = ["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "-T", "--upload-file", "-F", "--form"]
    let prefixes = ["--data=", "--data-raw=", "--data-binary=", "--data-urlencode=", "--upload-file=", "--form="]
    $argv | any { |t|
        ($t in $flags) or ($prefixes | any { |p| ($t | str starts-with $p) })
    }
}

def has-file-write [argv: list<string>]: nothing -> bool {
    let n = ($argv | length)
    $argv | enumerate | any { |it|
        let t = $it.item
        if ($t == "-o" or $t == "--output") and ($it.index + 1) < $n {
            ($argv | get ($it.index + 1)) != "/dev/null"
        } else if ($t | str starts-with "--output=") {
            let eq = ($t | str index-of "=")
            ($t | str substring ($eq + 1)..) != "/dev/null"
        } else {
            false
        }
    }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-curl"
    for case in [
        [argv, expected];
        [["curl", "URL"], $DECISION_ALLOW],
        [["curl", "-s", "URL"], $DECISION_ALLOW],
        [["curl", "-L", "URL"], $DECISION_ALLOW],
        [["curl", "-sSL", "URL"], $DECISION_ALLOW],
        [["curl", "--silent", "URL"], $DECISION_ALLOW],
        [["curl", "-X", "POST", "URL"], $DECISION_DEFER],
        [["curl", "-d", "body", "URL"], $DECISION_DEFER],
        [["curl", "--data", "foo", "URL"], $DECISION_DEFER],
        [["curl", "--data-binary", "@file", "URL"], $DECISION_DEFER],
        [["curl", "-F", "field=val", "URL"], $DECISION_DEFER],
        [["curl", "-T", "file", "URL"], $DECISION_DEFER],
        [["curl", "-o", "/tmp/file", "URL"], $DECISION_DEFER],
        [["curl", "--output", "/tmp/file", "URL"], $DECISION_DEFER],
        [["curl", "-o", "/dev/null", "URL"], $DECISION_ALLOW],
        [["curl", "--output=/tmp/file", "URL"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-curl: ($case.argv | str join ' ')"
    }

    print "handler-curl tests passed"
}
