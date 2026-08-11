#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer]

const SUBCOMMANDS: list<string> = ["post-result", "approve", "comments", "merge", "pr", "rev", "wip"]
const HELP_FLAGS: list<string> = ["--help", "-h"]
const READ_ONLY_SUBCOMMANDS: list<string> = ["comments"]
const LOCAL_BUILD_SUBCOMMANDS: list<string> = ["rev", "wip"]
const REMOTE_ACTION_FLAGS: list<string> = ["--approve-pr", "--merge-pr", "--post-result", "--run"]

def has-flag [args: list<string>, flags: list<string>]: nothing -> bool {
    $args | any { |arg|
        ($arg in $flags) or ($flags | any { |flag| $arg | str starts-with $"($flag)=" })
    }
}

def has-option-value [args: list<string>, option: string, value: string]: nothing -> bool {
    mut index = 0
    while $index < ($args | length) {
        let arg = ($args | get $index)
        if $arg == $"($option)=($value)" { return true }
        if $arg == $option and ($index + 1) < ($args | length) and ($args | get ($index + 1)) == $value {
            return true
        }
        $index = $index + 1
    }
    false
}

def is-help-request [args: list<string>]: nothing -> bool {
    ($args | length) == 1 and (($args | get 0) in ($HELP_FLAGS ++ ["--version"]))
}

def is-subcommand-help [args: list<string>]: nothing -> bool {
    let subcommand = ($args | get 0?)
    ($subcommand in $SUBCOMMANDS) and ($args | any { |arg| $arg in $HELP_FLAGS })
}

def is-local-build [args: list<string>]: nothing -> bool {
    let subcommand = ($args | get 0?)
    if (has-flag $args $REMOTE_ACTION_FLAGS) { return false }
    ($subcommand in $LOCAL_BUILD_SUBCOMMANDS) or (
        $subcommand == "pr" and (has-option-value $args "--eval" "local")
    )
}

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let args = ($argv | skip 1)
    let subcommand = ($args | get 0?)

    if $subcommand in $READ_ONLY_SUBCOMMANDS {
        return (allow "nixpkgs-review comments only reads GitHub comments")
    }
    if (is-help-request $args) {
        return (allow "nixpkgs-review help or version")
    }
    if (is-subcommand-help $args) {
        return (allow $"nixpkgs-review ($subcommand) help")
    }
    if (is-local-build $args) {
        return (allow $"nixpkgs-review ($subcommand) local build")
    }
    defer $"command '($argv | str join ' ')' requires confirmation because nixpkgs-review may perform remote actions or run commands; auto-approved cases are comments, help/version, and local builds without --approve-pr, --merge-pr, --post-result, or --run"
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-nixpkgs-review"
    for case in [
        [argv, expected];
        [["nixpkgs-review", "--help"], "allow"],
        [["nixpkgs-review", "-h"], "allow"],
        [["nixpkgs-review", "--version"], "allow"],
        [["nixpkgs-review", "pr", "--help"], "allow"],
        [["nixpkgs-review", "pr", "--no-headers", "--help"], "allow"],
        [["nixpkgs-review", "wip", "-h"], "allow"],
        [["nixpkgs-review", "wip", "--staged", "-h"], "allow"],
        [["nixpkgs-review", "merge", "--help"], "allow"],
        [["nixpkgs-review", "comments"], "allow"],
        [["nixpkgs-review", "comments", "--token", "TOKEN"], "allow"],
        [["nixpkgs-review", "rev", "HEAD"], "allow"],
        [["nixpkgs-review", "wip", "--staged"], "allow"],
        [["nixpkgs-review", "pr", "123", "--eval", "local"], "allow"],
        [["nixpkgs-review", "rev", "HEAD", "--run", "shell command"], "defer"],
        [["nixpkgs-review", "wip", "--approve-pr"], "defer"],
        [["nixpkgs-review", "pr", "123"], "defer"],
        [["nixpkgs-review", "unknown", "--help"], "defer"],
        [["nixpkgs-review", "merge"], "defer"],
        [["nixpkgs-review"], "defer"],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-nixpkgs-review: ($case.argv | str join ' ')"
    }

    print "handler-nixpkgs-review tests passed"
}
