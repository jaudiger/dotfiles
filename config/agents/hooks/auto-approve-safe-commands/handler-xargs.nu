#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const XARGS_NO_VALUE_OPTIONS: list<string> = ["-0", "-r", "-x", "-o", "-t"]
const XARGS_VALUE_OPTIONS: list<string> = ["-a", "-E", "-I", "-J", "-L", "-n", "-P", "-R", "-S", "-s"]
const XARGS_INLINE_VALUE_PREFIXES: list<string> = ["-E", "-I", "-J", "-n", "-P", "-L", "-s"]

# Unwrap xargs after validating options that do not add command side effects.
export def unwrap-xargs [argv: list<string>]: nothing -> list<string> {
    if ($argv | get 0?) != "xargs" { return $argv }
    let rest = ($argv | skip 1)
    if ($rest | is-empty) { return ["echo"] }
    let first = ($rest | get 0)

    if $first == "--" {
        if ($rest | length) == 1 { return ["echo"] }
        return ($rest | skip 1)
    }
    if $first in $XARGS_NO_VALUE_OPTIONS {
        return (unwrap-xargs (["xargs"] ++ ($rest | skip 1)))
    }
    if $first in $XARGS_VALUE_OPTIONS {
        let value = ($rest | get 1?)
        if $value == null or ($value | str starts-with "-") { return $argv }
        return (unwrap-xargs (["xargs"] ++ ($rest | skip 2)))
    }
    for prefix in $XARGS_INLINE_VALUE_PREFIXES {
        if ($first | str starts-with $prefix) and ($first | str length) > ($prefix | str length) {
            return (unwrap-xargs (["xargs"] ++ ($rest | skip 1)))
        }
    }
    if ($first | str starts-with "-") { return $argv }
    $rest
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-xargs"
    for case in [
        [argv, expected];
        [["xargs"], ["echo"]],
        [["xargs", "cut", "-d:", "-f1"], ["cut", "-d:", "-f1"]],
        [["xargs", "-r", "-n1", "cut"], ["cut"]],
        [["xargs", "-n", "2", "-I{}", "cut"], ["cut"]],
        [["xargs", "--", "cut"], ["cut"]],
        [["xargs", "-p", "cut"], ["xargs", "-p", "cut"]],
        [["xargs", "-n"], ["xargs", "-n"]],
    ] {
        assert equal (unwrap-xargs $case.argv) $case.expected $"handler-xargs: ($case.argv | str join ' ')"
    }

    print "handler-xargs tests passed"
}
