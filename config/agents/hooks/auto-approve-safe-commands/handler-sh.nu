#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SAFE_OPTIONS: list<string> = [
    "--noediting",
    "--noprofile",
    "--norc",
    "--posix",
    "--restricted",
    "--verbose",
    "-e",
    "-n",
    "-u",
    "-v",
    "-x",
]

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "parse.nu") parse-shell

export def extract-sh [argv: list<string>]: nothing -> record<is_shell: bool, script: string> {
    if ($argv | get 0?) != "sh" { return { is_shell: false, script: "" } }

    let rest = ($argv | skip 1)
    mut index = 0
    while $index < ($rest | length) {
        let arg = ($rest | get $index)
        if $arg in $SAFE_OPTIONS {
            $index = $index + 1
            continue
        }
        if $arg == "-c" and ($index + 1) == (($rest | length) - 1) {
            return { is_shell: true, script: ($rest | get ($index + 1)) }
        }
        return { is_shell: true, script: "" }
    }
    { is_shell: true, script: "" }
}

export def unwrap-sh [argv: list<string>]: nothing -> list<string> {
    let extracted = (extract-sh $argv)
    if not $extracted.is_shell or ($extracted.script | is-empty) { return $argv }
    let parsed = (parse-shell $extracted.script)
    if ($parsed.errors | is-not-empty) or ($parsed.side_effects | is-not-empty) or ($parsed.leaves | length) != 1 {
        return $argv
    }
    $parsed.leaves.0.argv
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-sh"
    for case in [
        [argv, expected];
        [["sh", "-c", "cat file"], ["cat", "file"]],
        [["sh", "--norc", "-c", "tail -20 file"], ["tail", "-20", "file"]],
        [["sh", "-c", "cat file; tail -20 file"], ["sh", "-c", "cat file; tail -20 file"]],
        [["sh", "-c", "rm file"], ["rm", "file"]],
        [["sh", "-c"], ["sh", "-c"]],
        [["sh", "script.sh"], ["sh", "script.sh"]],
    ] {
        assert equal (unwrap-sh $case.argv) $case.expected $"handler-sh: ($case.argv | str join ' ')"
    }

    let extracted = (extract-sh ["sh", "-e", "--norc", "-c", "cat; tail file"])
    assert $extracted.is_shell "sh -c is recognized"
    assert equal $extracted.script "cat; tail file" "sh script is extracted"
    assert ((extract-sh ["sh", "-c", "cat", "name"]).script == "") "trailing arguments are rejected"
    assert ((extract-sh ["sh", "-f", "-c", "cat"]).script == "") "unsafe flags are rejected"

    print "handler-sh tests passed"
}
