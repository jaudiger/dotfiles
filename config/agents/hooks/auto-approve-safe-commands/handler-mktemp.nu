#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer is-safe-path SAFE_PATH DECISION_ALLOW DECISION_DEFER]

export def handler [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let parsed = (parse-args $argv)
    if $parsed.error != null {
        return (defer $"mktemp: ($parsed.error)")
    }

    let candidates = if $parsed.tmpdir != null {
        [($parsed.tmpdir | path join ".mktemp")] ++ ($parsed.paths | each { |p| $parsed.tmpdir | path join $p })
    } else {
        $parsed.paths
    }
    let unsafe = ($candidates | where { |p| not (is-safe-path $p) } | get 0?)
    if $unsafe != null {
        return (defer $"mktemp: path '($unsafe)' is outside cwd and not in ($SAFE_PATH | str join ', ')")
    }

    allow "mktemp creates a private temporary file or directory"
}

def parse-args [argv: list<string>]: nothing -> record<paths: list<string>, tmpdir: any, error: any> {
    mut paths: list<string> = []
    mut tmpdir: any = null
    mut index = 1
    mut after_options = false

    while $index < ($argv | length) {
        let arg = ($argv | get $index)
        if $after_options or not ($arg | str starts-with "-") {
            $paths = ($paths | append $arg)
            $index = $index + 1
            continue
        }
        if $arg == "--" {
            $after_options = true
            $index = $index + 1
            continue
        }
        if $arg == "-p" or $arg == "--tmpdir" {
            if $index + 1 >= ($argv | length) {
                return { paths: $paths, tmpdir: $tmpdir, error: $"option ($arg) needs an argument" }
            }
            $tmpdir = ($argv | get ($index + 1))
            $index = $index + 2
            continue
        }
        if $arg =~ '^--tmpdir=' {
            let equals = ($arg | str index-of "=")
            $tmpdir = ($arg | str substring ($equals + 1)..)
            $index = $index + 1
            continue
        }
        if $arg == "-t" {
            if $index + 1 >= ($argv | length) {
                return { paths: $paths, tmpdir: $tmpdir, error: "option -t needs an argument" }
            }
            let prefix = ($argv | get ($index + 1))
            if ($prefix | str contains "/") or ($prefix | str contains "$") or ($prefix | str contains "`") {
                return { paths: $paths, tmpdir: $tmpdir, error: "-t prefix must not contain a path or expansion" }
            }
            $index = $index + 2
            continue
        }
        if $arg in ["-d", "--directory", "-q", "--quiet", "-u", "--dry-run"] {
            $index = $index + 1
            continue
        }
        return { paths: $paths, tmpdir: $tmpdir, error: $"unsupported option ($arg)" }
    }

    { paths: $paths, tmpdir: $tmpdir, error: null }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# handler-mktemp"
    for case in [
        [argv, expected];
        [["mktemp"], $DECISION_ALLOW],
        [["mktemp", "-d"], $DECISION_ALLOW],
        [["mktemp", "-t", "agent"], $DECISION_ALLOW],
        [["mktemp", "-p", "/tmp", "agent.XXXXXX"], $DECISION_ALLOW],
        [["mktemp", "--tmpdir=/private/tmp", "agent.XXXXXX"], $DECISION_ALLOW],
        [["mktemp", "agent.XXXXXX"], $DECISION_ALLOW],
        [["mktemp", "-u", "agent.XXXXXX"], $DECISION_ALLOW],
        [["mktemp", "/tmp/agent.XXXXXX"], $DECISION_ALLOW],
        [["mktemp", "/etc/agent.XXXXXX"], $DECISION_DEFER],
        [["mktemp", "-p", "/etc", "agent.XXXXXX"], $DECISION_DEFER],
        [["mktemp", "-t", "/etc/agent"], $DECISION_DEFER],
        [["mktemp", "--unknown"], $DECISION_DEFER],
    ] {
        assert equal (handler $case.argv).decision $case.expected $"handler-mktemp: ($case.argv | str join ' ')"
    }

    print "handler-mktemp tests passed"
}
