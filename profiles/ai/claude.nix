# NOTE: Claude desktop app is only available on macOS
{
  config,
  lib,
  ...
}:

let
  host = config.modules.host;
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "claude" ];
  };

  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;

        skills = {
          code-audit = ../../config/claude-code/skills/code-audit;
          code-review = ../../config/claude-code/skills/code-review;
          code-security = ../../config/claude-code/skills/code-security;
          code-test = ../../config/claude-code/skills/code-test;
          deep-resolve = ../../config/claude-code/skills/deep-resolve;
          deep-review = ../../config/claude-code/skills/deep-review;
          meta-learn = ''
            ---
            name: meta-learn
            description: >
              Review the current session for skill/project-config gaps and
              stale patterns, then update the relevant files.
            allowed-tools: Read, Grep, Glob, Edit, Write
            ---

            # Self-Improve

            Review what was accomplished in this session. Identify any patterns,
            methodologies, or language-specific knowledge that were used but are
            NOT currently captured in:

            **Global skills** — `${host.dotfilesDirectory}/config/claude-code/skills/`:
            - `code-audit/` — bug hunting (methodology/ + lang/)
            - `code-review/` — changeset review (aspects/)
            - `code-security/` — vulnerability analysis (domain/ + lang/)
            - `code-test/` — test quality audit (practice/ + lang/)
            - `deep-review/` — orchestrated multi-skill analysis

            **Project-level Claude files** — in the current working repository:
            - `CLAUDE.md` at the repo root
            - `.claude/settings.json`
            - `.claude/commands/`
            - `.claude/rules/`
            - `.claude/agents/`

            ## Phase 1 — Gap detection

            For each gap found:
            1. State which file should be updated and why
            2. Show the proposed addition
            3. Apply the edit after confirmation

            When adding a new concern/aspect/domain to a skill, update both
            the SKILL.md coverage matrix and create the corresponding sub-file.

            ## Phase 2 — Staleness detection

            Read through all skill files and project Claude files that were
            relevant to this session. Flag any content that is out of date:
            - Deprecated API patterns, removed functions, renamed tools
            - Language version assumptions that no longer hold
            - References to files, modules, or dependencies absent from the repo
            - Checklist items now redundant with modern compiler/linter defaults

            For each stale item:
            1. Quote the outdated content
            2. Explain why it is stale
            3. Propose the updated replacement
            4. Apply the edit after confirmation

            If any out-of-date content is detected, suggest concrete modifications
            to update it — even if the current task did not require that knowledge.
            Do not silently ignore stale guidance.

            If no gaps or stale content are found, say so explicitly.
          '';
        };

        settings = {
          alwaysThinkingEnabled = true;
          attribution = {
            commit = "";
            pr = "";
          };
          defaultMode = "acceptEdits";
          env = {
            CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY = 1;
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1;
            CLAUDE_CODE_HIDE_ACCOUNT_INFO = 1;
            FORCE_AUTOUPDATE_PLUGINS = 1;
          };
          permissions = {
            allow = [
              "Bash(cargo bench:*)"
              "Bash(cargo build:*)"
              "Bash(cargo check:*)"
              "Bash(cargo clean:*)"
              "Bash(cargo clippy:*)"
              "Bash(cargo doc:*)"
              "Bash(cargo fmt:*)"
              "Bash(cargo init:*)"
              "Bash(cargo metadata:*)"
              "Bash(cargo rustc:*)"
              "Bash(cargo test:*)"
              "Bash(cargo tree:*)"
              "Bash(cargo update:*)"
              "Bash(cargo upgrade:*)"
              "Bash(cat:*)"
              "Bash(cd:*)"
              "Bash(diff:*)"
              "Bash(echo:*)"
              "Bash(eslint:*)"
              "Bash(file:*)"
              "Bash(find:*)"
              "Bash(gh * list:*)"
              "Bash(gh * view:*)"
              "Bash(gh search:*)"
              "Bash(git branch:*)"
              "Bash(git diff:*)"
              "Bash(git fetch:*)"
              "Bash(git grep:*)"
              "Bash(git log:*)"
              "Bash(git ls-files:*)"
              "Bash(git ls-remote:*)"
              "Bash(git ls-tree:*)"
              "Bash(git rev-parse:*)"
              "Bash(git show:*)"
              "Bash(git stash:*)"
              "Bash(git status:*)"
              "Bash(glab * list:*)"
              "Bash(glab * view:*)"
              "Bash(grep:*)"
              "Bash(head:*)"
              "Bash(helm show:*)"
              "Bash(helm template:*)"
              "Bash(jq:*)"
              "Bash(ls:*)"
              "Bash(markdownlint-cli2:*)"
              "Bash(npm info:*)"
              "Bash(npm ls:*)"
              "Bash(npm outdated:*)"
              "Bash(npm update:*)"
              "Bash(npm view:*)"
              "Bash(pnpm build:*)"
              "Bash(pnpm info:*)"
              "Bash(pnpm lint:*)"
              "Bash(pnpm list:*)"
              "Bash(pnpm test:*)"
              "Bash(pnpm view:*)"
              "Bash(pnpm outdated:*)"
              "Bash(pnpm update:*)"
              "Bash(pnpm why:*)"
              "Bash(prettier:*)"
              "Bash(pwd:*)"
              "Bash(readlink:*)"
              "Bash(robocop check:*)"
              "Bash(robocop docs:*)"
              "Bash(robocop format:*)"
              "Bash(ruff check:*)"
              "Bash(ruff format:*)"
              "Bash(rustc check:*)"
              "Bash(shellcheck:*)"
              "Bash(shfmt:*)"
              "Bash(sort:*)"
              "Bash(stat:*)"
              "Bash(tail:*)"
              "Bash(tar:*)"
              "Bash(tee:*)"
              "Bash(terraform init:*)"
              "Bash(terraform fmt:*)"
              "Bash(terraform plan:*)"
              "Bash(terraform test:*)"
              "Bash(terraform validate:*)"
              "Bash(tflint:*)"
              "Bash(tr:*)"
              "Bash(tree:*)"
              "Bash(uname:*)"
              "Bash(uniq:*)"
              "Bash(wc:*)"
              "Bash(which:*)"
              "Bash(xxd:*)"
              "Bash(zig build:*)"
              "Bash(zig build-exe:*)"
              "Bash(zig build-lib:*)"
              "Bash(zig env:*)"
              "Bash(zig fmt:*)"
              "Bash(zig test:*)"
              "Glob"
              "Grep"
              "Read"
              "WebFetch"
              "WebSearch"
            ];
            deny = [
              "Bash(git push --force:*)"
              "Bash(git reset:*)"
              "Bash(git stash clear:*)"
              "Bash(git stash drop:*)"
              "Bash(rm -rf /:*)"
              "Edit(.env*)"
              "Read(.env*)"
              "Write(.env*)"
            ];
          };
          showTurnDuration = false;
          spinnerTipsEnabled = false;
          statusLine = {
            type = "command";
            command = "${host.homeDirectory}/.claude/scripts/status-line";
            padding = 0;
          };
        };
      };

      home = {
        file."claudeCodeStatusLine" = {
          source = ../../config/claude-code/status-line;
          target = ".claude/scripts/status-line";
        };
      };
    };
  };
}
