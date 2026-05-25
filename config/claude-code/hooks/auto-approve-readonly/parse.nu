#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

export def parse-shell [cmd: string]: nothing -> record<leaves: list<record<argv: list<string>>>, side_effects: list<record<kind: string, detail: string>>, errors: list<string>> {
    parse-fragment $cmd
}

def parse-fragment [cmd: string]: nothing -> record<leaves: list<record<argv: list<string>>>, side_effects: list<record<kind: string, detail: string>>, errors: list<string>> {
    let chars = ($cmd | split chars)
    let n = ($chars | length)

    mut leaves = []
    mut side_effects = []
    mut errors = []
    mut argv = []
    mut token = ""
    mut in_token = false
    mut quote = ""
    mut pending_redir = ""
    mut i = 0

    while $i < $n {
        let c = ($chars | get $i)

        if $quote == "'" {
            if $c == "'" {
                $quote = ""
            } else {
                $token = $token + $c
            }
            $in_token = true
            $i = $i + 1
            continue
        }

        if $quote == '"' {
            if $c == '"' {
                $quote = ""
                $in_token = true
                $i = $i + 1
                continue
            }
            if $c == '\' and ($i + 1) < $n {
                $token = $token + ($chars | get ($i + 1))
                $in_token = true
                $i = $i + 2
                continue
            }
            if $c == '$' and ($i + 1) < $n and (($chars | get ($i + 1)) == '(') {
                let sub = (extract-paren $chars ($i + 2))
                if $sub.ok {
                    let inner = (parse-fragment $sub.body)
                    $leaves = $leaves ++ $inner.leaves
                    $side_effects = $side_effects ++ $inner.side_effects
                    $errors = $errors ++ $inner.errors
                    $token = $token + '$(' + $sub.body + ')'
                    $in_token = true
                    $i = $sub.next_index
                    continue
                } else {
                    $errors = $errors | append "unclosed command substitution"
                    $i = $n
                    continue
                }
            }
            $token = $token + $c
            $in_token = true
            $i = $i + 1
            continue
        }

        if $c == "'" or $c == '"' {
            $quote = $c
            $in_token = true
            $i = $i + 1
            continue
        }

        if $c == '\' and ($i + 1) < $n {
            $token = $token + ($chars | get ($i + 1))
            $in_token = true
            $i = $i + 2
            continue
        }

        if $c == '`' {
            let sub = (extract-backtick $chars ($i + 1))
            if $sub.ok {
                let inner = (parse-fragment $sub.body)
                $leaves = $leaves ++ $inner.leaves
                $side_effects = $side_effects ++ $inner.side_effects
                $errors = $errors ++ $inner.errors
                $token = $token + '`' + $sub.body + '`'
                $in_token = true
                $i = $sub.next_index
                continue
            } else {
                $errors = $errors | append "unclosed backtick substitution"
                $i = $n
                continue
            }
        }

        if $c == '$' and ($i + 1) < $n and (($chars | get ($i + 1)) == '(') {
            let sub = (extract-paren $chars ($i + 2))
            if $sub.ok {
                let inner = (parse-fragment $sub.body)
                $leaves = $leaves ++ $inner.leaves
                $side_effects = $side_effects ++ $inner.side_effects
                $errors = $errors ++ $inner.errors
                $token = $token + '$(' + $sub.body + ')'
                $in_token = true
                $i = $sub.next_index
                continue
            } else {
                $errors = $errors | append "unclosed command substitution"
                $i = $n
                continue
            }
        }

        if ($c == '<' or $c == '>') and ($i + 1) < $n and (($chars | get ($i + 1)) == '(') {
            let sub = (extract-paren $chars ($i + 2))
            if $sub.ok {
                let inner = (parse-fragment $sub.body)
                $leaves = $leaves ++ $inner.leaves
                $side_effects = $side_effects ++ $inner.side_effects
                $errors = $errors ++ $inner.errors
                $token = $token + $c + '(' + $sub.body + ')'
                $in_token = true
                $i = $sub.next_index
                continue
            } else {
                $errors = $errors | append "unclosed process substitution"
                $i = $n
                continue
            }
        }

        if $c == ' ' or $c == "\t" {
            if $in_token {
                if ($pending_redir | is-not-empty) {
                    if not (is-null-redir-target $token) {
                        $side_effects = $side_effects | append { kind: "file_redirect", detail: ($pending_redir + " " + $token) }
                    }
                    $pending_redir = ""
                } else {
                    $argv = $argv | append $token
                }
                $token = ""
                $in_token = false
            }
            $i = $i + 1
            continue
        }

        if $c == '|' {
            if $in_token {
                if ($pending_redir | is-not-empty) {
                    if not (is-null-redir-target $token) {
                        $side_effects = $side_effects | append { kind: "file_redirect", detail: ($pending_redir + " " + $token) }
                    }
                    $pending_redir = ""
                } else {
                    $argv = $argv | append $token
                }
                $token = ""
                $in_token = false
            }
            if ($argv | is-not-empty) {
                $leaves = $leaves | append { argv: $argv }
                $argv = []
            }
            if ($i + 1) < $n and (($chars | get ($i + 1)) == '|') {
                $i = $i + 2
            } else {
                $i = $i + 1
            }
            continue
        }

        if $c == '&' {
            if ($pending_redir | is-not-empty) {
                $token = $token + $c
                $in_token = true
                $i = $i + 1
                continue
            }
            if ($i + 1) < $n and (($chars | get ($i + 1)) == '&') {
                if $in_token {
                    if ($pending_redir | is-not-empty) {
                        if not (is-null-redir-target $token) {
                            $side_effects = $side_effects | append { kind: "file_redirect", detail: ($pending_redir + " " + $token) }
                        }
                        $pending_redir = ""
                    } else {
                        $argv = $argv | append $token
                    }
                    $token = ""
                    $in_token = false
                }
                if ($argv | is-not-empty) {
                    $leaves = $leaves | append { argv: $argv }
                    $argv = []
                }
                $i = $i + 2
                continue
            }
            if ($i + 1) < $n and (($chars | get ($i + 1)) == '>') {
                if $in_token {
                    $argv = $argv | append $token
                    $token = ""
                    $in_token = false
                }
                $pending_redir = "&>"
                $i = $i + 2
                continue
            }
            $side_effects = $side_effects | append { kind: "background", detail: "" }
            $i = $i + 1
            continue
        }

        if $c == ';' or $c == "\n" {
            if $in_token {
                if ($pending_redir | is-not-empty) {
                    if not (is-null-redir-target $token) {
                        $side_effects = $side_effects | append { kind: "file_redirect", detail: ($pending_redir + " " + $token) }
                    }
                    $pending_redir = ""
                } else {
                    $argv = $argv | append $token
                }
                $token = ""
                $in_token = false
            }
            if ($argv | is-not-empty) {
                $leaves = $leaves | append { argv: $argv }
                $argv = []
            }
            $i = $i + 1
            continue
        }

        if $c == '>' {
            let prefix = if $in_token and ($token == "2") { "2" } else { "" }
            if $in_token {
                if $token != "2" {
                    $argv = $argv | append $token
                }
                $token = ""
                $in_token = false
            }
            if ($i + 1) < $n and (($chars | get ($i + 1)) == '>') {
                $pending_redir = $prefix + ">>"
                $i = $i + 2
            } else {
                $pending_redir = $prefix + ">"
                $i = $i + 1
            }
            continue
        }

        if $c == '<' {
            if ($i + 1) < $n and (($chars | get ($i + 1)) == '<') {
                $side_effects = $side_effects | append { kind: "heredoc", detail: "" }
                $i = $n
                continue
            }
            if $in_token {
                $argv = $argv | append $token
                $token = ""
                $in_token = false
            }
            $pending_redir = "<"
            $i = $i + 1
            continue
        }

        $token = $token + $c
        $in_token = true
        $i = $i + 1
    }

    if ($quote | is-not-empty) {
        $errors = $errors | append "unclosed quote"
    }
    if $in_token {
        if ($pending_redir | is-not-empty) {
            if not (is-null-redir-target $token) {
                $side_effects = $side_effects | append { kind: "file_redirect", detail: ($pending_redir + " " + $token) }
            }
            $pending_redir = ""
        } else {
            $argv = $argv | append $token
        }
    }
    if ($pending_redir | is-not-empty) {
        $errors = $errors | append "redirect without target"
    }
    if ($argv | is-not-empty) {
        $leaves = $leaves | append { argv: $argv }
    }

    {
        leaves: $leaves,
        side_effects: $side_effects,
        errors: $errors,
    }
}

def extract-paren [chars: list<string>, start: int]: nothing -> record<ok: bool, body: string, next_index: int> {
    let n = ($chars | length)
    mut depth = 1
    mut i = $start
    mut body = ""
    mut quote = ""

    while $i < $n {
        let c = ($chars | get $i)

        if $quote == "'" {
            if $c == "'" { $quote = "" }
            $body = $body + $c
            $i = $i + 1
            continue
        }
        if $quote == '"' {
            if $c == '\' and ($i + 1) < $n {
                $body = $body + $c + ($chars | get ($i + 1))
                $i = $i + 2
                continue
            }
            if $c == '"' { $quote = "" }
            $body = $body + $c
            $i = $i + 1
            continue
        }

        if $c == "'" or $c == '"' {
            $quote = $c
            $body = $body + $c
            $i = $i + 1
            continue
        }
        if $c == '(' {
            $depth = $depth + 1
            $body = $body + $c
            $i = $i + 1
            continue
        }
        if $c == ')' {
            $depth = $depth - 1
            if $depth == 0 {
                return { ok: true, body: $body, next_index: ($i + 1) }
            }
            $body = $body + $c
            $i = $i + 1
            continue
        }
        $body = $body + $c
        $i = $i + 1
    }
    { ok: false, body: "", next_index: $n }
}

def extract-backtick [chars: list<string>, start: int]: nothing -> record<ok: bool, body: string, next_index: int> {
    let n = ($chars | length)
    mut i = $start
    mut body = ""

    while $i < $n {
        let c = ($chars | get $i)
        if $c == '\' and ($i + 1) < $n {
            $body = $body + ($chars | get ($i + 1))
            $i = $i + 2
            continue
        }
        if $c == '`' {
            return { ok: true, body: $body, next_index: ($i + 1) }
        }
        $body = $body + $c
        $i = $i + 1
    }
    { ok: false, body: "", next_index: $n }
}

def is-null-redir-target [target: string]: nothing -> bool {
    ($target == "/dev/null") or ($target =~ '^&[0-9]+$')
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# parse-shell: simple command"
    let r = (parse-shell "ls -la")
    assert equal ($r.leaves | length) 1 "single leaf"
    assert equal ($r.leaves | get 0.argv) ["ls", "-la"] "argv split on space"
    assert equal ($r.side_effects | length) 0 "no side effects"
    assert equal ($r.errors | length) 0 "no errors"

    print "# parse-shell: pipeline"
    let r = (parse-shell "curl -s URL | jq .")
    assert equal ($r.leaves | length) 2 "two leaves"
    assert equal ($r.leaves | get 0.argv) ["curl", "-s", "URL"] "first leaf"
    assert equal ($r.leaves | get 1.argv) ["jq", "."] "second leaf"
    assert ($r.side_effects | is-empty) "no side effects"

    print "# parse-shell: separators"
    let r = (parse-shell "git status; git log")
    assert equal ($r.leaves | length) 2 "split on ;"
    let r = (parse-shell "git status && git log")
    assert equal ($r.leaves | length) 2 "split on &&"
    let r = (parse-shell "git status || echo nope")
    assert equal ($r.leaves | length) 2 "split on ||"

    print "# parse-shell: quoting"
    let r = (parse-shell "echo 'hello world'")
    assert equal ($r.leaves | get 0.argv) ["echo", "hello world"] "single-quoted preserves spaces"
    let r = (parse-shell 'echo "hello world"')
    assert equal ($r.leaves | get 0.argv) ["echo", "hello world"] "double-quoted preserves spaces"
    let r = (parse-shell "echo 'a|b;c&&d'")
    assert equal ($r.leaves | length) 1 "operators inside quotes ignored"

    print "# parse-shell: redirects"
    let r = (parse-shell "ls > /tmp/out")
    assert equal ($r.side_effects | length) 1 "file write reported"
    assert equal ($r.side_effects | get 0.kind) "file_redirect" "kind is file_redirect"
    let r = (parse-shell "ls > /dev/null")
    assert ($r.side_effects | is-empty) "/dev/null is not a side effect"
    let r = (parse-shell "ls 2>&1 | grep foo")
    assert ($r.side_effects | is-empty) "2>&1 fd dup is not a side effect"
    let r = (parse-shell "ls 2> /tmp/err")
    assert equal ($r.side_effects | length) 1 "2> file is a side effect"

    print "# parse-shell: command substitution"
    let r = (parse-shell "gh api repos/$(echo octocat)/orgs")
    assert equal ($r.leaves | length) 2 "outer + substitution leaves"
    let inner_argvs = ($r.leaves | each { |l| $l.argv | get 0 })
    assert ("echo" in $inner_argvs) "substitution body produced echo leaf"

    print "# parse-shell: backtick substitution"
    let r = (parse-shell 'echo `date`')
    assert equal ($r.leaves | length) 2 "outer + backtick sub leaves"

    print "# parse-shell: process substitution"
    let r = (parse-shell "diff <(ls) <(cat foo)")
    assert equal ($r.leaves | length) 3 "diff + two procsub leaves"

    print "# parse-shell: pipe to shell stays parseable"
    let r = (parse-shell "curl URL | bash")
    assert equal ($r.leaves | length) 2 "shell is its own leaf, classifier denies"

    print "# parse-shell: heredoc reported as side effect"
    let r = (parse-shell "cat <<EOF")
    assert (not ($r.side_effects | is-empty)) "heredoc flagged"

    print "# parse-shell: background reported as side effect"
    let r = (parse-shell "sleep 10 &")
    assert (not ($r.side_effects | is-empty)) "background flagged"

    print "# parse-shell: escapes outside quotes"
    let r = (parse-shell 'echo hello\ world')
    assert equal ($r.leaves | get 0.argv) ["echo", "hello world"] "escaped space joins token"

    print "# parse-shell: unclosed quote reports error"
    let r = (parse-shell "echo 'unterminated")
    assert (not ($r.errors | is-empty)) "unclosed quote"

    print "# parse-shell: nested substitution"
    let r = (parse-shell 'echo $(echo $(date))')
    assert equal ($r.leaves | length) 3 "outer + 2 nested subs"

    print "parse-shell tests passed"
}
