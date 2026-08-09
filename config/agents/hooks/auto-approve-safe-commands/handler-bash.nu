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

def unwrap-shell [argv: list<string>]: nothing -> list<string> {
    if ($argv | get 0?) != "bash" { return $argv }
    let rest = ($argv | skip 1)
    mut index = 0
    while $index < ($rest | length) {
        let arg = ($rest | get $index)
        if $arg in $SAFE_OPTIONS {
            $index = $index + 1
            continue
        }
        if $arg != "-c" or ($index + 1) != (($rest | length) - 1) {
            return $argv
        }
        let parsed = (parse-shell ($rest | get ($index + 1)))
        if ($parsed.errors | is-not-empty) or ($parsed.side_effects | is-not-empty) or ($parsed.leaves | length) != 1 {
            return $argv
        }
        return ($parsed.leaves | get 0 | get argv)
    }
    $argv
}

export def unwrap-bash [argv: list<string>]: nothing -> list<string> {
    unwrap-shell $argv
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-bash"
    for case in [
        [argv, expected];
        [["bash", "-c", "cat file"], ["cat", "file"]],
        [["bash", "--noprofile", "-c", "tail -20 file"], ["tail", "-20", "file"]],
        [["bash", "-c", "cat file; tail -20 file"], ["bash", "-c", "cat file; tail -20 file"]],
        [["bash", "-c", "rm file"], ["rm", "file"]],
        [["bash", "-c"], ["bash", "-c"]],
        [["bash", "script.sh"], ["bash", "script.sh"]],
    ] {
        assert equal (unwrap-bash $case.argv) $case.expected $"handler-bash: ($case.argv | str join ' ')"
    }

    print "handler-bash tests passed"
}
