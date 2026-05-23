#!/usr/bin/env -S nu --stdin
#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") *
use ($SCRIPT_DIR | path join "rule-curl.nu")
use ($SCRIPT_DIR | path join "rule-gh-api.nu")

def main []: any -> nothing {
    let payload = (try { $in | from json } catch { {} })
    let tool_name = (try { $payload.tool_name } catch { "" })
    let command = (try { $payload.tool_input.command } catch { "" })

    if $tool_name != "Bash" or ($command | is-empty) {
        emit-defer
    }

    if (is-pipe-to-shell $command) {
        emit-deny "pipe to shell interpreter"
    }

    let shape_is_unsafe = (
        (has-command-separator $command)
        or (has-command-substitution $command)
        or (has-process-substitution $command)
        or (has-output-redirect $command)
    )
    if $shape_is_unsafe {
        emit-defer
    }

    rule-curl $command
    rule-gh-api $command

    emit-defer
}

def "main test" []: nothing -> nothing {
    ^nu ($SCRIPT_DIR | path join "rule-curl.nu") test
    ^nu ($SCRIPT_DIR | path join "rule-gh-api.nu") test
}
