#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer DECISION_ALLOW DECISION_DEFER]

# A w/W/e script command at the start of, or after a separator in, a sed
# script body.
const DANGEROUS_COMMAND_RE: string = '(^|[;{}\s/])[wWe](\s|$)'

# Short-flag cluster containing the in-place edit flag.
const IN_PLACE_SHORT_RE: string = '^-[A-Za-z]*[iI]'

# Short-flag cluster containing the script-from-file flag.
const FILE_SCRIPT_SHORT_RE: string = '^-[A-Za-z]*f'

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    if (has-in-place $argv) {
        return (defer "sed: -i/--in-place edits files in place; requires confirmation")
    }
    if (has-script-file $argv) {
        return (defer "sed: -f/--file loads a script we cannot inspect; requires confirmation")
    }
    let bad = ($argv | skip 1 | where { |t| ($t =~ $DANGEROUS_COMMAND_RE) } | get 0?)
    if $bad != null {
        return (defer $"sed: script token '($bad)' looks like a w/W/e command; requires confirmation")
    }
    allow "sed read-only"
}

def has-in-place [argv: list<string>]: nothing -> bool {
    $argv
        | any { |t| ($t == "--in-place") or ($t | str starts-with "--in-place=") or ($t =~ $IN_PLACE_SHORT_RE) }
}

def has-script-file [argv: list<string>]: nothing -> bool {
    $argv
        | any { |t| ($t == "--file") or ($t | str starts-with "--file=") or ($t =~ $FILE_SCRIPT_SHORT_RE) }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-sed"
    for case in [
        [argv, expected];
        [["sed"], $DECISION_ALLOW],
        [["sed", "-n", "320,400p"], $DECISION_ALLOW],
        [["sed", "-n", "1,3p"], $DECISION_ALLOW],
        [["sed", "-E", "s/a/b/g"], $DECISION_ALLOW],
        [["sed", "-e", "s/old/new/"], $DECISION_ALLOW],
        [["sed", "s/foo/bar/g", "file.txt"], $DECISION_ALLOW],
        [["sed", "/word/p"], $DECISION_ALLOW],
        [["sed", "s/\\w//g"], $DECISION_ALLOW],
        [["sed", "1,$d"], $DECISION_ALLOW],
        [["sed", "-n", "/walking dead/p"], $DECISION_ALLOW],
        [["sed", "-i", "s/a/b/", "file"], $DECISION_DEFER],
        [["sed", "-i.bak", "s/a/b/", "file"], $DECISION_DEFER],
        [["sed", "--in-place", "s/a/b/", "file"], $DECISION_DEFER],
        [["sed", "--in-place=.bak", "s/a/b/", "file"], $DECISION_DEFER],
        [["sed", "-in", "s/a/b/", "file"], $DECISION_DEFER],
        [["sed", "-ni", "s/a/b/", "file"], $DECISION_DEFER],
        [["sed", "-I", "", "s/a/b/", "file"], $DECISION_DEFER],
        [["sed", "-f", "script.sed", "file"], $DECISION_DEFER],
        [["sed", "--file=script.sed", "file"], $DECISION_DEFER],
        [["sed", "-nf", "script.sed", "file"], $DECISION_DEFER],
        [["sed", "w outfile"], $DECISION_DEFER],
        [["sed", "-e", "w outfile"], $DECISION_DEFER],
        [["sed", "s/foo/bar/w outfile"], $DECISION_DEFER],
        [["sed", "s/foo/bar/e"], $DECISION_DEFER],
        [["sed", "e ls"], $DECISION_DEFER],
        [["sed", "h;w out;g"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-sed: ($case.argv | str join ' ')"
    }

    print "handler-sed tests passed"
}
