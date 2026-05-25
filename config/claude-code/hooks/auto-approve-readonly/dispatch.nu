#
# Copyright (c) Jérémy Audiger.
# All rights reserved.
#

const SCRIPT_DIR = path self | path dirname
use ($SCRIPT_DIR | path join "lib.nu") [defer DECISION_ALLOW DECISION_DENY DECISION_DEFER]
use ($SCRIPT_DIR | path join "handler-base64.nu")
use ($SCRIPT_DIR | path join "handler-cargo.nu")
use ($SCRIPT_DIR | path join "handler-cat.nu")
use ($SCRIPT_DIR | path join "handler-cd.nu")
use ($SCRIPT_DIR | path join "handler-curl.nu")
use ($SCRIPT_DIR | path join "handler-diff.nu")
use ($SCRIPT_DIR | path join "handler-echo.nu")
use ($SCRIPT_DIR | path join "handler-eslint.nu")
use ($SCRIPT_DIR | path join "handler-file.nu")
use ($SCRIPT_DIR | path join "handler-find.nu")
use ($SCRIPT_DIR | path join "handler-gh.nu")
use ($SCRIPT_DIR | path join "handler-git.nu")
use ($SCRIPT_DIR | path join "handler-glab.nu")
use ($SCRIPT_DIR | path join "handler-grep.nu")
use ($SCRIPT_DIR | path join "handler-head.nu")
use ($SCRIPT_DIR | path join "handler-helm.nu")
use ($SCRIPT_DIR | path join "handler-jq.nu")
use ($SCRIPT_DIR | path join "handler-ls.nu")
use ($SCRIPT_DIR | path join "handler-markdownlint-cli2.nu")
use ($SCRIPT_DIR | path join "handler-npm.nu")
use ($SCRIPT_DIR | path join "handler-pnpm.nu")
use ($SCRIPT_DIR | path join "handler-prettier.nu")
use ($SCRIPT_DIR | path join "handler-pwd.nu")
use ($SCRIPT_DIR | path join "handler-readlink.nu")
use ($SCRIPT_DIR | path join "handler-rm.nu")
use ($SCRIPT_DIR | path join "handler-robocop.nu")
use ($SCRIPT_DIR | path join "handler-ruff.nu")
use ($SCRIPT_DIR | path join "handler-rustc.nu")
use ($SCRIPT_DIR | path join "handler-shellcheck.nu")
use ($SCRIPT_DIR | path join "handler-shfmt.nu")
use ($SCRIPT_DIR | path join "handler-sort.nu")
use ($SCRIPT_DIR | path join "handler-stat.nu")
use ($SCRIPT_DIR | path join "handler-tail.nu")
use ($SCRIPT_DIR | path join "handler-tar.nu")
use ($SCRIPT_DIR | path join "handler-tee.nu")
use ($SCRIPT_DIR | path join "handler-terraform.nu")
use ($SCRIPT_DIR | path join "handler-tflint.nu")
use ($SCRIPT_DIR | path join "handler-tr.nu")
use ($SCRIPT_DIR | path join "handler-tree.nu")
use ($SCRIPT_DIR | path join "handler-uname.nu")
use ($SCRIPT_DIR | path join "handler-uniq.nu")
use ($SCRIPT_DIR | path join "handler-wc.nu")
use ($SCRIPT_DIR | path join "handler-which.nu")
use ($SCRIPT_DIR | path join "handler-xxd.nu")
use ($SCRIPT_DIR | path join "handler-zig.nu")

export def dispatcher [argv: list<string>]: nothing -> record<decision: string, reason: string> {
    match ($argv | get 0?) {
        "base64" => (handler-base64 handler $argv),
        "cargo" => (handler-cargo handler $argv),
        "cat" => (handler-cat handler $argv),
        "cd" => (handler-cd handler $argv),
        "curl" => (handler-curl handler $argv),
        "diff" => (handler-diff handler $argv),
        "echo" => (handler-echo handler $argv),
        "eslint" => (handler-eslint handler $argv),
        "file" => (handler-file handler $argv),
        "find" => (handler-find handler $argv),
        "gh" => (handler-gh handler $argv),
        "git" => (handler-git handler $argv),
        "glab" => (handler-glab handler $argv),
        "grep" => (handler-grep handler $argv),
        "head" => (handler-head handler $argv),
        "helm" => (handler-helm handler $argv),
        "jq" => (handler-jq handler $argv),
        "ls" => (handler-ls handler $argv),
        "markdownlint-cli2" => (handler-markdownlint-cli2 handler $argv),
        "npm" => (handler-npm handler $argv),
        "pnpm" => (handler-pnpm handler $argv),
        "prettier" => (handler-prettier handler $argv),
        "pwd" => (handler-pwd handler $argv),
        "readlink" => (handler-readlink handler $argv),
        "rm" => (handler-rm handler $argv),
        "robocop" => (handler-robocop handler $argv),
        "ruff" => (handler-ruff handler $argv),
        "rustc" => (handler-rustc handler $argv),
        "shellcheck" => (handler-shellcheck handler $argv),
        "shfmt" => (handler-shfmt handler $argv),
        "sort" => (handler-sort handler $argv),
        "stat" => (handler-stat handler $argv),
        "tail" => (handler-tail handler $argv),
        "tar" => (handler-tar handler $argv),
        "tee" => (handler-tee handler $argv),
        "terraform" => (handler-terraform handler $argv),
        "tflint" => (handler-tflint handler $argv),
        "tr" => (handler-tr handler $argv),
        "tree" => (handler-tree handler $argv),
        "uname" => (handler-uname handler $argv),
        "uniq" => (handler-uniq handler $argv),
        "wc" => (handler-wc handler $argv),
        "which" => (handler-which handler $argv),
        "xxd" => (handler-xxd handler $argv),
        "zig" => (handler-zig handler $argv),
        _ => (defer),
    }
}

export def main []: nothing -> nothing { }

export def "main test" []: nothing -> nothing {
    use std/assert

    print "# dispatch: dispatcher tree"
    for case in [
        [argv, expected];
        [["cat"], $DECISION_ALLOW],
        [["curl", "-s", "URL"], $DECISION_ALLOW],
        [["cargo", "build"], $DECISION_ALLOW],
        [["git", "reset"], $DECISION_DENY],
        [["unknown-cmd"], $DECISION_DEFER],
        [[], $DECISION_DEFER],
    ] {
        assert equal (dispatcher $case.argv).decision $case.expected $"dispatch: ($case.argv | str join ' ')"
    }

    print "dispatch tests passed"
}
