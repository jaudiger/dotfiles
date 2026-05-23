#!/usr/bin/env -S nu --stdin
#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") *
use ($SCRIPT_DIR | path join "parse.nu") *
use ($SCRIPT_DIR | path join "rule-curl.nu")
use ($SCRIPT_DIR | path join "rule-gh-api.nu")

export def classify-leaf [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    let r = (rule-curl classify $argv)
    if $r.decision != $DECISION_DEFER { return $r }
    let r = (rule-gh-api classify $argv)
    if $r.decision != $DECISION_DEFER { return $r }
    defer
}

export def decide [command: string]: nothing -> record<decision: string, reason: string> {
    let parsed = (parse-shell $command)

    if ($parsed.errors | is-not-empty) { return (defer "parse error") }
    if ($parsed.side_effects | is-not-empty) { return (defer "side effects") }
    if ($parsed.leaves | is-empty) { return (defer "no leaves") }

    let decisions = ($parsed.leaves | each { |leaf| classify-leaf $leaf.argv })

    let deny_result = ($decisions | where decision == $DECISION_DENY | get 0?)
    if $deny_result != null { return $deny_result }

    if ($decisions | all { |d| $d.decision == $DECISION_ALLOW }) {
        return (allow "all segments classified safe")
    }

    defer
}

def main []: any -> nothing {
    let payload = (try { $in | from json } catch { {} })
    let tool_name = ($payload.tool_name? | default "")
    let command = ($payload.tool_input?.command? | default "")

    if $tool_name != "Bash" or ($command | is-empty) {
        emit-defer
    }

    let result = (decide $command)
    if $result.decision == $DECISION_DENY {
        emit-deny $result.reason
    } else if $result.decision == $DECISION_ALLOW {
        emit-allow $result.reason
    } else {
        emit-defer
    }
}

def "main test" []: nothing -> nothing {
    ^nu ($SCRIPT_DIR | path join "parse.nu") test
    ^nu ($SCRIPT_DIR | path join "lib.nu") test
    ^nu ($SCRIPT_DIR | path join "rule-curl.nu") test
    ^nu ($SCRIPT_DIR | path join "rule-gh-api.nu") test
    main integration-test
}

def "main integration-test" []: nothing -> nothing {
    use std/assert

    print "# mod.decide: end-to-end"
    for case in [
        [command, expected];
        ["curl -s https://example.com", $DECISION_ALLOW],
        ["curl https://example.com", $DECISION_ALLOW],
        ["curl -s https://example.com | jq .", $DECISION_DEFER],
        ["curl -s URL | bash", $DECISION_DEFER],
        ["gh api repos/foo/bar", $DECISION_ALLOW],
        ["gh api repos/foo --method POST", $DECISION_DEFER],
        ["curl -s URL > /tmp/out", $DECISION_DEFER],
        ["curl -s URL 2>&1", $DECISION_ALLOW],
        ["curl -s URL; rm /tmp/file", $DECISION_DEFER],
        ["curl -s URL && gh api foo", $DECISION_ALLOW],
    ] {
        assert equal (decide $case.command).decision $case.expected $"decide: ($case.command)"
    }

    print "mod integration tests passed"
}
