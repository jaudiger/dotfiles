#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer argv-has-mutation-method is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DEFER]

const OUTPUT_FLAGS: list<string> = ["-o", "--output"]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if (argv-has-mutation-method $argv) { return (defer "curl: mutation method (POST/PUT/DELETE/PATCH) requires confirmation") }
    if (has-body-or-upload $argv) { return (defer "curl: -d/--data/-T/--upload-file/-F/--form sends a request body, requires confirmation") }
    let unsafe = (output-targets $argv | where { |p| not (is-safe-path $p) } | get 0?)
    if $unsafe != null {
        return (defer $"curl: -o/--output target '($unsafe)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }
    allow "curl read-only fetch"
}

def has-body-or-upload [argv: list<string>]: nothing -> bool {
    let flags = ["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "-T", "--upload-file", "-F", "--form"]
    let prefixes = ["--data=", "--data-raw=", "--data-binary=", "--data-urlencode=", "--upload-file=", "--form="]
    $argv | any { |t|
        ($t in $flags) or ($prefixes | any { |p| ($t | str starts-with $p) })
    }
}

def output-targets [argv: list<string>]: nothing -> list<string> {
    let n = ($argv | length)
    $argv | enumerate | each { |it|
        let t = $it.item
        if ($t in $OUTPUT_FLAGS) and ($it.index + 1) < $n {
            $argv | get ($it.index + 1)
        } else {
            $OUTPUT_FLAGS
            | where { |f| ($f | str starts-with "--") and ($t | str starts-with ($f + "=")) }
            | each { |_| let eq = ($t | str index-of "="); $t | str substring ($eq + 1).. }
            | get 0?
        }
    } | compact
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
        [["curl", "-o", "/tmp/file", "URL"], $DECISION_ALLOW],
        [["curl", "--output", "/tmp/file", "URL"], $DECISION_ALLOW],
        [["curl", "-o", "/dev/null", "URL"], $DECISION_ALLOW],
        [["curl", "--output=/tmp/file", "URL"], $DECISION_ALLOW],
        [["curl", "-o", "/etc/passwd", "URL"], $DECISION_DEFER],
        [["curl", "--output=/etc/passwd", "URL"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-curl: ($case.argv | str join ' ')"
    }

    print "handler-curl tests passed"
}
