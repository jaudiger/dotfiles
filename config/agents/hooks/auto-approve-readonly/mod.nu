#!/usr/bin/env -S nu --stdin
#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_PATH = path self
const SCRIPT_DIR = $SCRIPT_PATH | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [agents-hook-debug allow defer emit-allow emit-deny emit-defer DECISION_ALLOW DECISION_DENY DECISION_DEFER]
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

def main [protocol: string]: any -> nothing {
    let payload = (try { $in | from json } catch { {} })
    let tool_name = ($payload.tool_name? | default "" | str lowercase)
    let command = ($payload.tool_input?.command? | default "")

    agents-hook-debug $"request=($payload)"

    if $tool_name != "bash" or ($command | is-empty) {
        emit-defer $protocol "not a bash command"
    }

    let result = (decide $command)
    if $result.decision == $DECISION_DENY {
        emit-deny $protocol $result.reason
    } else if $result.decision == $DECISION_ALLOW {
        emit-allow $protocol $result.reason
    } else {
        emit-defer $protocol $result.reason
    }
}

def "main test" []: nothing -> nothing {
    ^nu ($SCRIPT_DIR | path join "parse.nu") test
    ^nu ($SCRIPT_DIR | path join "lib.nu") test
    for f in (glob ($SCRIPT_DIR | path join "handler-*.nu")) { ^nu $f test }
    ^nu ($SCRIPT_DIR | path join "dispatch.nu") test
    main integration-test
    main protocol-test
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
        ["printf '%s\\n' value", $DECISION_ALLOW],
        ["printf '%s\\n' value > /tmp/output", $DECISION_DEFER],
        ["printf -v value '%s' text", $DECISION_DEFER],
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

def "main protocol-test" []: nothing -> nothing {
    use std/assert

    def run-hook [protocol: string, payload: record]: nothing -> record {
        $payload | to json | ^nu --stdin $SCRIPT_PATH $protocol | complete
    }

    print "# mod.protocol: response contracts"

    let claude = (run-hook "claude" { tool_name: "Bash", tool_input: { command: "git diff" } })
    assert equal $claude.exit_code 0 "Claude hook exits successfully"
    assert equal (($claude.stdout | from json).hookSpecificOutput.permissionDecision) $DECISION_ALLOW "Claude allow response"

    let codex = (run-hook "codex" { tool_name: "Bash", tool_input: { command: "git diff" } })
    assert equal $codex.exit_code 0 "Codex hook exits successfully"
    assert equal (($codex.stdout | from json).hookSpecificOutput.permissionDecision) $DECISION_ALLOW "Codex allow response"

    let codex_deny = (run-hook "codex" { tool_name: "Bash", tool_input: { command: "git reset --hard" } })
    assert equal $codex_deny.exit_code 0 "Codex deny exits successfully"
    assert equal (($codex_deny.stdout | from json).hookSpecificOutput.permissionDecision) $DECISION_DENY "Codex deny response"

    let codex_defer = (run-hook "codex" { tool_name: "Bash", tool_input: { command: "unknown-cmd" } })
    assert equal $codex_defer.exit_code 0 "Codex defer exits successfully"
    assert equal $codex_defer.stdout "" "Codex defer has no response"

    let mistral = (run-hook "mistral" { tool_name: "Bash", tool_input: { command: "git diff" } })
    assert equal $mistral.exit_code 0 "Mistral hook exits successfully"
    assert equal (($mistral.stdout | from json).decision) $DECISION_ALLOW "Mistral allow response"

    let mistral_defer = (run-hook "mistral" { tool_name: "Bash", tool_input: { command: "unknown-cmd" } })
    assert equal $mistral_defer.exit_code 0 "Mistral defer exits successfully"
    assert equal $mistral_defer.stdout "" "Mistral defer has no response"

    let pi = (run-hook "pi" { tool_name: "Bash", tool_input: { command: "git diff" } })
    assert equal $pi.exit_code 0 "Pi hook exits successfully"
    assert equal (($pi.stdout | from json).decision) $DECISION_ALLOW "Pi allow response"

    let pi_defer = (run-hook "pi" { tool_name: "Bash", tool_input: { command: "unknown-cmd" } })
    assert equal $pi_defer.exit_code 0 "Pi defer exits successfully"
    assert equal (($pi_defer.stdout | from json).decision) $DECISION_DEFER "Pi defer response"

    print "mod protocol tests passed"
}
