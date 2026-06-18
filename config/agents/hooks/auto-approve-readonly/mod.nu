#!/usr/bin/env -S nu --stdin
#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [allow defer emit-allow emit-deny emit-defer DECISION_ALLOW DECISION_DENY DECISION_DEFER]
use ($SCRIPT_DIR | path join "parse.nu") parse-shell
use ($SCRIPT_DIR | path join "dispatch.nu")

export def decide [command: string]: nothing -> record<decision: string, reason: string> {
    let parsed = (parse-shell $command)

    if ($parsed.errors | is-not-empty) { return (defer $"shell parse error: ($parsed.errors | str join '; ')") }
    if ($parsed.side_effects | is-not-empty) { return (defer $"shell side effects require confirmation: ($parsed.side_effects | each { |s| $s.kind } | uniq | str join ', ')") }
    if ($parsed.leaves | is-empty) { return (defer "no commands parsed from input") }

    let decisions = ($parsed.leaves | each { |leaf| dispatch dispatcher $leaf.argv })

    let deny_result = ($decisions | where decision == $DECISION_DENY | get 0?)
    if $deny_result != null { return $deny_result }

    if ($decisions | all { |d| $d.decision == $DECISION_ALLOW }) {
        return (allow "all segments classified safe")
    }

    defer ($decisions | where decision == $DECISION_DEFER | get reason | compact --empty | str join '; ')
}

def main []: any -> nothing {
    let payload = (try { $in | from json } catch { {} })
    let tool_name = ($payload.tool_name? | default "" | str downcase)
    let command = ($payload.tool_input?.command? | default "")

    if $tool_name != "bash" or ($command | is-empty) {
        emit-defer "not a bash command"
    }

    let result = (decide $command)
    if $result.decision == $DECISION_DENY {
        emit-deny $result.reason
    } else if $result.decision == $DECISION_ALLOW {
        emit-allow $result.reason
    } else {
        emit-defer $result.reason
    }
}

def "main test" []: nothing -> nothing {
    ^nu ($SCRIPT_DIR | path join "parse.nu") test
    ^nu ($SCRIPT_DIR | path join "lib.nu") test
    for f in (glob ($SCRIPT_DIR | path join "handler-*.nu")) { ^nu $f test }
    ^nu ($SCRIPT_DIR | path join "dispatch.nu") test
    main integration-test
}

def "main integration-test" []: nothing -> nothing {
    use std/assert

    print "# mod.decide: end-to-end"
    for case in [
        [command, expected];
        ["curl -s https://example.com", $DECISION_ALLOW],
        ["curl -s https://example.com | jq .", $DECISION_ALLOW],
        ["curl -s URL | bash", $DECISION_DEFER],
        ["gh api repos/foo/bar", $DECISION_ALLOW],
        ["gh api repos/foo --method POST", $DECISION_DEFER],
        ["gh pr view 42", $DECISION_ALLOW],
        ["curl -s URL > /tmp/out", $DECISION_DEFER],
        ["curl -s URL 2>&1", $DECISION_ALLOW],
        ["curl -s URL; rm /tmp/file", $DECISION_DEFER],
        ["curl -s URL && gh api foo", $DECISION_ALLOW],
        ["cat README.md", $DECISION_ALLOW],
        ["git diff --cached", $DECISION_ALLOW],
        ["git diff | cat", $DECISION_ALLOW],
        ["git log | grep TODO", $DECISION_ALLOW],
        ["find . -name '*.nu' | wc -l", $DECISION_ALLOW],
        ["cargo build && cargo test", $DECISION_ALLOW],
        ["gh api repos/foo/bar/contents/baz --jq '.download_url' | xargs curl -fsSL 2>&1", $DECISION_ALLOW],
        ["git reset --hard", $DECISION_DENY],
        ["git push --force origin main", $DECISION_DENY],
        ["git stash clear", $DECISION_DENY],
        ["rm -rf /", $DECISION_DENY],
        ["rm file.txt", $DECISION_DEFER],
        ["unknown-cmd", $DECISION_DEFER],
    ] {
        assert equal (decide $case.command).decision $case.expected $"decide: ($case.command)"
    }

    print "mod integration tests passed"
}
